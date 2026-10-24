// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntryPoint07} from "./interfaces/IEntryPoint07.sol";

interface IAgentGasPolicy {
    function agent() external view returns (address);
}

/// @notice ERC-4337 v0.7 paymaster with lifetime sponsored-gas quotas per agent key.
contract AgentPaymaster {
    uint256 private constant POST_OP_ACCOUNTING_OVERHEAD = 35_000;

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    address public owner;
    IEntryPoint07 public immutable entryPoint;

    mapping(address => uint256) public gasQuota;
    mapping(address => uint256) public gasUsed;
    mapping(address => uint256) public reservedGas;
    mapping(address => address) public walletAgent;

    event AgentGasQuotaSet(address indexed agent, uint256 quota);
    event WalletAgentSet(address indexed wallet, address indexed agent);
    event SponsorshipCharged(address indexed agent, uint256 gasUsed, uint256 totalGasUsed);
    event Deposited(uint256 amount);
    event DepositWithdrawn(uint256 amount);
    event StakeAdded(uint256 amount, uint32 unstakeDelaySec);
    event StakeUnlockRequested();
    event StakeWithdrawn(address indexed withdrawAddress);

    error NotOwner();
    error NotEntryPoint();
    error ZeroAddress();
    error InvalidEntryPoint();
    error SponsorshipDisabled();
    error InvalidWallet();
    error InvalidOperationFee();
    error ExceedsGasQuota();
    error InvalidSponsorshipContext();
    error ZeroDeposit();

    constructor(address ownerAddress, address entryPointAddress) {
        if (ownerAddress == address(0)) revert ZeroAddress();
        if (entryPointAddress.code.length == 0) revert InvalidEntryPoint();
        owner = ownerAddress;
        entryPoint = IEntryPoint07(entryPointAddress);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        _;
    }

    receive() external payable {}

    function setAgentGasQuota(address agentAddress, uint256 quota) external onlyOwner {
        if (agentAddress == address(0)) revert ZeroAddress();
        gasQuota[agentAddress] = quota;
        emit AgentGasQuotaSet(agentAddress, quota);
    }

    function setWalletAgent(address wallet, address agentAddress) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        if (agentAddress != address(0)) {
            if (wallet.code.length == 0 || IAgentGasPolicy(wallet).agent() != agentAddress) {
                revert InvalidWallet();
            }
        }
        walletAgent[wallet] = agentAddress;
        emit WalletAgentSet(wallet, agentAddress);
    }

    function deposit() external payable onlyOwner {
        if (msg.value == 0) revert ZeroDeposit();
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.value);
    }

    function withdrawDeposit(uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(payable(owner), amount);
        emit DepositWithdrawn(amount);
    }

    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        if (msg.value == 0) revert ZeroDeposit();
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
        emit StakeAdded(msg.value, unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
        emit StakeUnlockRequested();
    }

    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        if (withdrawAddress == address(0)) revert ZeroAddress();
        entryPoint.withdrawStake(withdrawAddress);
        emit StakeWithdrawn(withdrawAddress);
    }

    function validatePaymasterUserOp(
        IEntryPoint07.PackedUserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        address agentAddress = walletAgent[userOp.sender];
        if (agentAddress == address(0) || IAgentGasPolicy(userOp.sender).agent() != agentAddress) {
            revert InvalidWallet();
        }

        uint256 quota = gasQuota[agentAddress];
        if (quota == 0) revert SponsorshipDisabled();

        uint256 maxFeePerGas = uint128(uint256(userOp.gasFees));
        if (maxFeePerGas == 0) revert InvalidOperationFee();
        uint256 maxGas = maxCost / maxFeePerGas;
        if (maxCost % maxFeePerGas != 0) maxGas++;

        uint256 alreadyUsed = gasUsed[agentAddress];
        uint256 alreadyReserved = reservedGas[agentAddress];
        if (
            alreadyUsed > quota ||
            alreadyReserved > quota - alreadyUsed ||
            maxGas > quota - alreadyUsed - alreadyReserved
        ) revert ExceedsGasQuota();

        reservedGas[agentAddress] = alreadyReserved + maxGas;
        context = abi.encode(agentAddress, maxGas);
        validationData = 0;
    }

    function postOp(
        PostOpMode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external onlyEntryPoint {
        uint256 postOpStartGas = gasleft();
        (address agentAddress, uint256 reserved) = abi.decode(context, (address, uint256));
        uint256 currentReserved = reservedGas[agentAddress];
        if (agentAddress == address(0) || reserved > currentReserved) {
            revert InvalidSponsorshipContext();
        }
        if (actualUserOpFeePerGas == 0) revert InvalidOperationFee();

        uint256 actualGas = actualGasCost / actualUserOpFeePerGas;
        if (actualGasCost % actualUserOpFeePerGas != 0) actualGas++;
        actualGas += postOpStartGas - gasleft() + POST_OP_ACCOUNTING_OVERHEAD;
        if (actualGas > reserved) revert InvalidSponsorshipContext();

        reservedGas[agentAddress] = currentReserved - reserved;
        gasUsed[agentAddress] += actualGas;
        emit SponsorshipCharged(agentAddress, actualGas, gasUsed[agentAddress]);
    }
}
