// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {IEntryPoint07} from "../src/interfaces/IEntryPoint07.sol";

contract MockEntryPoint07 {
    mapping(address => mapping(uint192 => uint256)) private _nonces;

    function setNonce(address sender, uint192 key, uint256 nonce) external {
        _nonces[sender][key] = nonce;
    }

    function getNonce(address sender, uint192 key) external view returns (uint256) {
        return _nonces[sender][key];
    }

    function validate(
        AgentWallet wallet,
        IEntryPoint07.PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256) {
        uint256 validationData = wallet.validateUserOp(userOp, userOpHash, missingAccountFunds);
        if (validationData != 1) {
            uint192 key = uint192(userOp.nonce >> 64);
            _nonces[address(wallet)][key]++;
        }
        return validationData;
    }

    function execute(AgentWallet wallet, bytes calldata callData) external {
        (bool success, bytes memory result) = address(wallet).call(callData);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }
}

contract AgentWalletEntryPointTest is Test {
    uint256 private constant AGENT_KEY = 0xA11CE;
    uint256 private constant OTHER_KEY = 0xB0B;

    AgentWallet private wallet;
    MockEntryPoint07 private entryPoint;
    address private recipient = makeAddr("recipient");

    function setUp() public {
        address agent = vm.addr(AGENT_KEY);
        wallet = new AgentWallet(address(this));
        entryPoint = new MockEntryPoint07();
        wallet.setEntryPoint(address(entryPoint));
        wallet.setAgent(agent, AgentWallet.Policy({
            maxPerTx: 1 ether,
            dailyLimit: 2 ether,
            validUntil: uint48(block.timestamp + 1 days)
        }));
        wallet.setAllowedRecipient(recipient, true);
        vm.deal(address(wallet), 1 ether);
    }

    function test_validateUserOp_acceptsEntryPointHashAndSessionKey() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp(0);
        bytes32 userOpHash = keccak256("standard entrypoint user operation hash");
        userOp.signature = _sign(AGENT_KEY, userOpHash);
        entryPoint.setNonce(address(wallet), 0, 0);

        uint256 validationData = entryPoint.validate(wallet, userOp, userOpHash, 0);

        assertEq(validationData, uint256(uint48(block.timestamp + 1 days)) << 160);
        assertEq(entryPoint.getNonce(address(wallet), 0), 1);
    }

    function test_validateUserOp_rejectsWrongSessionKey() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp(0);
        bytes32 userOpHash = keccak256("standard entrypoint user operation hash");
        userOp.signature = _sign(OTHER_KEY, userOpHash);
        entryPoint.setNonce(address(wallet), 0, 0);

        assertEq(entryPoint.validate(wallet, userOp, userOpHash, 0), 1);
    }

    function test_validateUserOp_rejectsRevokedAgent() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp(0);
        userOp.signature = "";
        wallet.revokeAgent();
        entryPoint.setNonce(address(wallet), 0, 0);

        assertEq(entryPoint.validate(wallet, userOp, keccak256("revoked"), 0), 1);
    }

    function test_validateUserOp_revertsOnNonceMismatch() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp(0);
        bytes32 userOpHash = keccak256("standard entrypoint user operation hash");
        userOp.signature = _sign(AGENT_KEY, userOpHash);
        entryPoint.setNonce(address(wallet), 0, 1);

        vm.expectRevert(AgentWallet.InvalidUserOpNonce.selector);
        entryPoint.validate(wallet, userOp, userOpHash, 0);
    }

    function test_validateUserOp_rejectsDirectCaller() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp(0);
        bytes32 userOpHash = keccak256("standard entrypoint user operation hash");
        userOp.signature = _sign(AGENT_KEY, userOpHash);

        vm.expectRevert(AgentWallet.NotEntryPoint.selector);
        wallet.validateUserOp(userOp, userOpHash, 0);
    }

    function test_entryPointExecutesValidatedOperation() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp(0);
        bytes32 userOpHash = keccak256("standard entrypoint user operation hash");
        userOp.signature = _sign(AGENT_KEY, userOpHash);
        entryPoint.setNonce(address(wallet), 0, 0);

        assertTrue(entryPoint.validate(wallet, userOp, userOpHash, 0) != 1);
        entryPoint.execute(wallet, userOp.callData);

        assertEq(recipient.balance, 1 wei);
        assertEq(wallet.spentToday(), 1 wei);
    }

    function _userOp(uint256 nonce)
        private
        view
        returns (IEntryPoint07.PackedUserOperation memory)
    {
        return IEntryPoint07.PackedUserOperation({
            sender: address(wallet),
            nonce: nonce,
            initCode: "",
            callData: abi.encodeCall(wallet.executeAsAgent, (recipient, 1 wei, bytes(""))),
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _sign(uint256 privateKey, bytes32 userOpHash) private returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
