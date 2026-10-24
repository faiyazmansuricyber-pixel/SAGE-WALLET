// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================================
// OWNERSHIP: This file is owned by P4 (Tests, Security & Demo).
// ============================================================================

import {Test, console} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {MockMerchant} from "../src/MockMerchant.sol";

/// @title AgentWalletTest — Unit tests for Phase 1 policy enforcement
contract AgentWalletTest is Test {
    AgentWallet wallet;
    MockMerchant merchant;

    address owner   = makeAddr("owner");
    address agent   = makeAddr("agent");
    address attacker = makeAddr("attacker");
    address recipient = makeAddr("recipient");

    bytes4 constant BUY_CREDITS = bytes4(keccak256("buyCredits(uint256)"));

    AgentWallet.Policy defaultPolicy;

    function setUp() public {
        vm.prank(owner);
        wallet = new AgentWallet(owner);
        merchant = new MockMerchant();

        // Fund wallet
        vm.deal(address(wallet), 10 ether);

        defaultPolicy = AgentWallet.Policy({
            maxPerTx:   0.1 ether,
            dailyLimit: 0.5 ether,
            validUntil: uint48(block.timestamp + 1 days)
        });

        // Allowlisted custom calls remain disabled; ETH sends are limited to EOAs.
        vm.startPrank(owner);
        wallet.setAllowedTarget(address(merchant), BUY_CREDITS, true);
        wallet.setAllowedRecipient(recipient, true);
        wallet.setAgent(agent, defaultPolicy);
        vm.stopPrank();
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    function test_constructor_setsOwner() public view {
        assertEq(wallet.owner(), owner);
    }

    function test_constructor_rejectsZeroOwner() public {
        vm.expectRevert(AgentWallet.ZeroAddress.selector);
        new AgentWallet(address(0));
    }

    // ── setAgent ─────────────────────────────────────────────────────────────

    function test_setAgent_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.setAgent(attacker, defaultPolicy);
    }

    function test_setAgent_setsAgentAndPolicy() public view {
        assertEq(wallet.agent(), agent);
        AgentWallet.Policy memory p = wallet.getPolicy();
        assertEq(p.maxPerTx, defaultPolicy.maxPerTx);
        assertEq(p.dailyLimit, defaultPolicy.dailyLimit);
        assertEq(p.validUntil, defaultPolicy.validUntil);
    }

    function test_setAgent_rejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AgentWallet.ZeroAddress.selector);
        wallet.setAgent(address(0), defaultPolicy);
    }

    // ── revokeAgent ──────────────────────────────────────────────────────────

    function test_revokeAgent_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.revokeAgent();
    }

    function test_revokeAgent_clearsAgent() public {
        vm.prank(owner);
        wallet.revokeAgent();
        assertEq(wallet.agent(), address(0));
    }

    function test_revokeAgent_blocksExecution() public {
        vm.prank(owner);
        wallet.revokeAgent();
        vm.prank(address(0)); // zero address caller
        vm.expectRevert(AgentWallet.NotAgent.selector);
        wallet.executeAsAgent(address(merchant), 0, abi.encodeWithSelector(BUY_CREDITS, 1));
    }

    // ── setAllowedTarget ──────────────────────────────────────────────────────

    function test_setAllowedTarget_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.setAllowedTarget(address(merchant), BUY_CREDITS, true);
    }

    // ── setAllowedRecipient ───────────────────────────────────────────────────

    function test_setAllowedRecipient_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.setAllowedRecipient(recipient, true);
    }

    // ── executeAsAgent — happy path ──────────────────────────────────────────

    function test_executeAsAgent_rejectsOwnerAllowlistedCustomCall() public {
        bytes memory data = abi.encodeWithSelector(BUY_CREDITS, 10);
        vm.prank(agent);
        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(merchant), 0.01 ether, data);
    }

    function test_executeAsAgent_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit AgentWallet.AgentExecuted(recipient, 0.005 ether, bytes4(0));
        vm.prank(agent);
        wallet.executeAsAgent(recipient, 0.005 ether, "");
    }

    function test_executeAsAgent_ethSendToAllowedRecipient() public {
        uint256 before = recipient.balance;
        vm.prank(agent);
        wallet.executeAsAgent(recipient, 0.01 ether, "");
        assertEq(recipient.balance, before + 0.01 ether);
    }

    // ── executeAsAgent — per-tx limit ─────────────────────────────────────────

    function test_executeAsAgent_rejectsExceedsPerTxLimit() public {
        vm.prank(agent);
        vm.expectRevert(AgentWallet.ExceedsPerTxLimit.selector);
        wallet.executeAsAgent(recipient, 1 ether, ""); // > 0.1 ETH maxPerTx
    }

    // ── executeAsAgent — daily limit ─────────────────────────────────────────

    function test_executeAsAgent_rejectsExceedsDailyLimit() public {
        // spend up to the limit (5 × 0.1 ETH = 0.5 ETH)
        vm.startPrank(agent);
        for (uint i = 0; i < 5; i++) {
            wallet.executeAsAgent(recipient, 0.1 ether, "");
        }
        // 6th should exceed
        vm.expectRevert(AgentWallet.ExceedsDailyLimit.selector);
        wallet.executeAsAgent(recipient, 0.1 ether, "");
        vm.stopPrank();
    }

    function test_executeAsAgent_dailyLimitResetsAfter24h() public {
        AgentWallet.Policy memory extendedPolicy = defaultPolicy;
        extendedPolicy.validUntil = uint48(block.timestamp + 2 days);
        vm.prank(owner);
        wallet.setAgent(agent, extendedPolicy);

        vm.startPrank(agent);
        for (uint i = 0; i < 5; i++) {
            wallet.executeAsAgent(recipient, 0.1 ether, "");
        }
        // warp past 24h
        vm.warp(block.timestamp + 1 days + 1);
        // new window — should succeed
        wallet.executeAsAgent(recipient, 0.1 ether, "");
        vm.stopPrank();
    }

    // ── executeAsAgent — policy expiry ────────────────────────────────────────

    function test_executeAsAgent_rejectsExpiredPolicy() public {
        vm.warp(block.timestamp + 2 days); // past validUntil
        vm.prank(agent);
        vm.expectRevert(AgentWallet.PolicyExpired.selector);
        wallet.executeAsAgent(recipient, 0.01 ether, "");
    }

    // ── executeAsAgent — non-allowed target ───────────────────────────────────

    function test_executeAsAgent_rejectsNotAllowedTarget() public {
        address badTarget = makeAddr("evil");
        bytes memory data = abi.encodeWithSelector(BUY_CREDITS, 1);
        vm.prank(agent);
        vm.expectRevert(AgentWallet.NotAllowedTarget.selector);
        wallet.executeAsAgent(badTarget, 0, data);
    }

    // ── executeAsAgent — non-allowed recipient ────────────────────────────────

    function test_executeAsAgent_rejectsNotAllowedRecipient() public {
        address evil = makeAddr("evil");
        vm.prank(agent);
        vm.expectRevert(AgentWallet.NotAllowedRecipient.selector);
        wallet.executeAsAgent(evil, 0.01 ether, ""); // plain ETH send, not allowlisted
    }

    // ── executeAsAgent — self-call ────────────────────────────────────────────

    function test_executeAsAgent_rejectsSelfCall() public {
        bytes memory data = abi.encodeWithSelector(AgentWallet.freeze.selector);
        vm.prank(agent);
        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(wallet), 0, data);
    }

    // ── executeAsAgent — non-agent caller ────────────────────────────────────

    function test_executeAsAgent_rejectsNonAgent() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotAgent.selector);
        wallet.executeAsAgent(address(merchant), 0, abi.encodeWithSelector(BUY_CREDITS, 1));
    }

    // ── execute (owner) ──────────────────────────────────────────────────────

    function test_execute_ownerCanCallAnything() public {
        bytes memory data = abi.encodeWithSelector(BUY_CREDITS, 100);
        vm.prank(owner);
        wallet.execute(address(merchant), 0.1 ether, data);
        assertEq(merchant.getCredits(address(wallet)), 100);
    }

    function test_execute_rejectsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.execute(address(merchant), 0, "");
    }

    // ── spentToday ───────────────────────────────────────────────────────────

    function test_spentToday_tracksCorrectly() public {
        vm.prank(agent);
        wallet.executeAsAgent(recipient, 0.03 ether, "");
        assertEq(wallet.spentToday(), 0.03 ether);
    }

    function test_spentToday_resetsAfter24h() public {
        vm.prank(agent);
        wallet.executeAsAgent(recipient, 0.03 ether, "");
        vm.warp(block.timestamp + 1 days + 1);
        assertEq(wallet.spentToday(), 0);
    }

    // ── Freeze ───────────────────────────────────────────────────────────────

    function test_freeze_blocksAgentExecution() public {
        vm.prank(owner);
        wallet.freeze();
        assertTrue(wallet.frozen());

        vm.prank(agent);
        vm.expectRevert(AgentWallet.WalletFrozen.selector);
        wallet.executeAsAgent(recipient, 0, "");
    }

    function test_unfreeze_restoresAgentExecution() public {
        vm.prank(owner);
        wallet.freeze();
        vm.prank(owner);
        wallet.unfreeze();
        assertFalse(wallet.frozen());

        vm.prank(agent);
        wallet.executeAsAgent(recipient, 0.001 ether, "");
    }

    function test_freeze_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.freeze();
    }

    function test_autoFreeze_byAgent() public {
        vm.prank(agent);
        wallet.autoFreeze();
        assertTrue(wallet.frozen());
    }
}
