// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================================
// OWNERSHIP: This file is owned by P4 (Tests, Security & Demo).
// ============================================================================

import {Test, console} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

/// @title GuardianRecoveryTest — Phase 2 guardian recovery tests
/// @notice Verifies: 3-of-5 threshold, 48h delay, owner veto, duplicate vote prevention.
contract GuardianRecoveryTest is Test {
    AgentWallet wallet;

    address owner = makeAddr("owner");
    address newOwner = makeAddr("newOwner");

    address[5] guardians;

    function setUp() public {
        vm.prank(owner);
        wallet = new AgentWallet(owner);

        for (uint i = 0; i < 5; i++) {
            guardians[i] = makeAddr(string(abi.encodePacked("guardian", i)));
        }

        vm.prank(owner);
        wallet.setGuardians(guardians);
    }

    // ── setGuardians ─────────────────────────────────────────────────────────

    function test_setGuardians_onlyOwner() public {
        address nonOwner = makeAddr("nonOwner");
        vm.prank(nonOwner);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.setGuardians(guardians);
    }

    function test_setGuardians_rejectsDuplicate() public {
        address[5] memory bad;
        for (uint i = 0; i < 5; i++) bad[i] = guardians[0]; // all same
        vm.prank(owner);
        vm.expectRevert(AgentWallet.DuplicateGuardian.selector);
        wallet.setGuardians(bad);
    }

    function test_setGuardians_rejectsZeroAddress() public {
        address[5] memory bad = guardians;
        bad[2] = address(0);
        vm.prank(owner);
        vm.expectRevert(AgentWallet.ZeroAddress.selector);
        wallet.setGuardians(bad);
    }

    function test_getGuardians_returnsCorrect() public view {
        address[5] memory g = wallet.getGuardians();
        for (uint i = 0; i < 5; i++) {
            assertEq(g[i], guardians[i]);
        }
    }

    // ── initiateRecovery ──────────────────────────────────────────────────────

    function test_initiateRecovery_byGuardian() public {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);

        (address proposed,, uint8 votes,) = wallet.recoveryStatus();
        assertEq(proposed, newOwner);
        assertEq(votes, 1);
    }

    function test_initiateRecovery_rejectsNonGuardian() public {
        address random = makeAddr("random");
        vm.prank(random);
        vm.expectRevert(AgentWallet.NotGuardian.selector);
        wallet.initiateRecovery(newOwner);
    }

    function test_initiateRecovery_rejectsZeroAddress() public {
        vm.prank(guardians[0]);
        vm.expectRevert(AgentWallet.ZeroAddress.selector);
        wallet.initiateRecovery(address(0));
    }

    function test_initiateRecovery_rejectsDuplicateVote() public {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);

        vm.prank(guardians[0]);
        vm.expectRevert(AgentWallet.AlreadyVoted.selector);
        wallet.initiateRecovery(newOwner);
    }

    // ── voteRecovery ──────────────────────────────────────────────────────────

    function test_voteRecovery_accumulates() public {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);
        vm.prank(guardians[1]);
        wallet.voteRecovery();
        vm.prank(guardians[2]);
        wallet.voteRecovery();

        (,, uint8 votes,) = wallet.recoveryStatus();
        assertEq(votes, 3);
    }

    function test_voteRecovery_rejectsNonGuardian() public {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);

        vm.prank(makeAddr("random"));
        vm.expectRevert(AgentWallet.NotGuardian.selector);
        wallet.voteRecovery();
    }

    function test_voteRecovery_rejectsDuplicate() public {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);
        vm.prank(guardians[1]);
        wallet.voteRecovery();

        vm.prank(guardians[1]);
        vm.expectRevert(AgentWallet.AlreadyVoted.selector);
        wallet.voteRecovery();
    }

    function test_voteRecovery_rejectsIfNoActiveRecovery() public {
        vm.prank(guardians[0]);
        vm.expectRevert(AgentWallet.RecoveryNotActive.selector);
        wallet.voteRecovery();
    }

    // ── finalizeRecovery ──────────────────────────────────────────────────────

    function _reach3Votes() internal {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);
        vm.prank(guardians[1]);
        wallet.voteRecovery();
        vm.prank(guardians[2]);
        wallet.voteRecovery();
    }

    function test_finalizeRecovery_succeedsAfter48h_with3votes() public {
        _reach3Votes();
        vm.warp(block.timestamp + 48 hours + 1);
        wallet.finalizeRecovery();
        assertEq(wallet.owner(), newOwner);
    }

    function test_finalizeRecovery_rejectsBeforeDelay() public {
        _reach3Votes();
        vm.warp(block.timestamp + 47 hours);
        vm.expectRevert(AgentWallet.RecoveryDelayNotElapsed.selector);
        wallet.finalizeRecovery();
    }

    function test_finalizeRecovery_rejectsInsufficientVotes() public {
        vm.prank(guardians[0]);
        wallet.initiateRecovery(newOwner);
        vm.prank(guardians[1]);
        wallet.voteRecovery();
        // only 2 votes — below threshold of 3

        vm.warp(block.timestamp + 48 hours + 1);
        vm.expectRevert(AgentWallet.RecoveryThresholdNotMet.selector);
        wallet.finalizeRecovery();
    }

    function test_finalizeRecovery_rejectsIfNoActiveRecovery() public {
        vm.expectRevert(AgentWallet.RecoveryNotActive.selector);
        wallet.finalizeRecovery();
    }

    function test_finalizeRecovery_resetsState() public {
        _reach3Votes();
        vm.warp(block.timestamp + 48 hours + 1);
        wallet.finalizeRecovery();

        (address proposed, uint256 initiatedAt, uint8 votes,) = wallet.recoveryStatus();
        assertEq(proposed, address(0));
        assertEq(initiatedAt, 0);
        assertEq(votes, 0);
    }

    // ── vetoRecovery (owner veto during delay) ────────────────────────────────

    function test_vetoRecovery_ownerCancelsWithinDelay() public {
        _reach3Votes();
        // still within 48h window
        vm.prank(owner);
        wallet.vetoRecovery();

        // state reset
        (address proposed,, uint8 votes,) = wallet.recoveryStatus();
        assertEq(proposed, address(0));
        assertEq(votes, 0);
        // owner unchanged
        assertEq(wallet.owner(), owner);
    }

    function test_vetoRecovery_onlyOwner() public {
        _reach3Votes();
        vm.prank(guardians[0]);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.vetoRecovery();
    }

    function test_vetoRecovery_rejectsIfNoActiveRecovery() public {
        vm.prank(owner);
        vm.expectRevert(AgentWallet.RecoveryNotActive.selector);
        wallet.vetoRecovery();
    }

    // ── 48h delay guarantee ───────────────────────────────────────────────────

    function test_recoveryDelay_exactly48hRequired() public {
        _reach3Votes();

        // At exactly 48h — still should fail (strict >=)
        (, uint256 initiatedAt,,) = wallet.recoveryStatus();
        vm.warp(initiatedAt + 48 hours);
        vm.expectRevert(AgentWallet.RecoveryDelayNotElapsed.selector);
        wallet.finalizeRecovery();

        // At 48h + 1 second — should succeed
        vm.warp(initiatedAt + 48 hours + 1);
        wallet.finalizeRecovery();
        assertEq(wallet.owner(), newOwner);
    }

}
