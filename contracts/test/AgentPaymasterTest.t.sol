// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {AgentPaymaster} from "../src/AgentPaymaster.sol";
import {IEntryPoint07} from "../src/interfaces/IEntryPoint07.sol";

contract MockPaymasterEntryPoint {
    function validate(
        AgentPaymaster paymaster,
        IEntryPoint07.PackedUserOperation calldata userOp,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        return paymaster.validatePaymasterUserOp(userOp, bytes32(0), maxCost);
    }

    function postOp(
        AgentPaymaster paymaster,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        paymaster.postOp(
            AgentPaymaster.PostOpMode.opSucceeded,
            context,
            actualGasCost,
            actualUserOpFeePerGas
        );
    }
}

contract AgentPaymasterTest is Test {
    AgentWallet private wallet;
    AgentPaymaster private paymaster;
    MockPaymasterEntryPoint private entryPoint;
    address private agent = makeAddr("agent");

    function setUp() public {
        wallet = new AgentWallet(address(this));
        entryPoint = new MockPaymasterEntryPoint();
        paymaster = new AgentPaymaster(address(this), address(entryPoint));
        wallet.setAgent(agent, AgentWallet.Policy({
            maxPerTx: 1 ether,
            dailyLimit: 5 ether,
            validUntil: uint48(block.timestamp + 1 days)
        }));
        paymaster.setAgentGasQuota(agent, 100_000);
        paymaster.setWalletAgent(address(wallet), agent);
    }

    function test_paymasterReservesAndChargesActualGas() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp();
        uint256 maxCost = 100_000 * 10 gwei;
        (bytes memory context, uint256 validationData) =
            entryPoint.validate(paymaster, userOp, maxCost);

        assertEq(validationData, 0);
        assertEq(paymaster.reservedGas(agent), 100_000);

        entryPoint.postOp(paymaster, context, 25_000 * 2 gwei, 2 gwei);

        assertEq(paymaster.reservedGas(agent), 0);
        assertGt(paymaster.gasUsed(agent), 25_000);
        assertLe(paymaster.gasUsed(agent), 100_000);
    }

    function test_paymasterRejectsReservationAboveAgentQuota() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp();

        vm.expectRevert(AgentPaymaster.ExceedsGasQuota.selector);
        entryPoint.validate(paymaster, userOp, 100_001 * 10 gwei);
    }

    function test_paymasterIncludesPendingReservationsInQuotaCheck() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp();
        entryPoint.validate(paymaster, userOp, 60_000 * 10 gwei);

        vm.expectRevert(AgentPaymaster.ExceedsGasQuota.selector);
        entryPoint.validate(paymaster, userOp, 60_000 * 10 gwei);
    }

    function test_paymasterRejectsUnconfiguredQuota() public {
        paymaster.setAgentGasQuota(agent, 0);

        vm.expectRevert(AgentPaymaster.SponsorshipDisabled.selector);
        entryPoint.validate(paymaster, _userOp(), 1 gwei);
    }

    function test_paymasterRejectsUnregisteredWallet() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp();
        userOp.sender = makeAddr("unregistered wallet");

        vm.expectRevert(AgentPaymaster.InvalidWallet.selector);
        entryPoint.validate(paymaster, userOp, 1 gwei);
    }

    function test_paymasterRejectsWalletWhoseAgentChanged() public {
        wallet.setAgent(makeAddr("new agent"), AgentWallet.Policy({
            maxPerTx: 1 ether,
            dailyLimit: 5 ether,
            validUntil: uint48(block.timestamp + 1 days)
        }));

        vm.expectRevert(AgentPaymaster.InvalidWallet.selector);
        entryPoint.validate(paymaster, _userOp(), 1 gwei);
    }

    function test_paymasterRejectsDirectValidationCaller() public {
        vm.expectRevert(AgentPaymaster.NotEntryPoint.selector);
        paymaster.validatePaymasterUserOp(_userOp(), bytes32(0), 1 gwei);
    }

    function test_paymasterRejectsActualGasAboveReservation() public {
        IEntryPoint07.PackedUserOperation memory userOp = _userOp();
        (bytes memory context,) = entryPoint.validate(paymaster, userOp, 60_000 * 10 gwei);

        vm.expectRevert(AgentPaymaster.InvalidSponsorshipContext.selector);
        entryPoint.postOp(paymaster, context, 60_001 * 2 gwei, 2 gwei);
    }

    function _userOp() private view returns (IEntryPoint07.PackedUserOperation memory) {
        return IEntryPoint07.PackedUserOperation({
            sender: address(wallet),
            nonce: 0,
            initCode: "",
            callData: "",
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32((uint256(1 gwei) << 128) | uint256(10 gwei)),
            paymasterAndData: "",
            signature: ""
        });
    }
}
