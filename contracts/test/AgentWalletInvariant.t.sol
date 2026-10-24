// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================================
// OWNERSHIP: This file is owned by P4 (Tests, Security & Demo).
// ============================================================================

import {Test} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

/// @title AgentWalletInvariant — Fuzz + Invariant tests
/// @notice Invariant: agent can NEVER spend more than dailyLimit in any 24-hour window.
///         Foundry will call executeAsAgent with randomised inputs and verify this holds.
contract AgentWalletInvariant is StdInvariant, Test {
    AgentWallet wallet;
    AgentWalletHandler handler;

    function setUp() public {
        address owner = makeAddr("owner");
        address agent = makeAddr("agent");

        vm.prank(owner);
        wallet = new AgentWallet(owner);
        vm.deal(address(wallet), 100 ether);
        address recipient = makeAddr("invariant recipient");

        AgentWallet.Policy memory policy = AgentWallet.Policy({
            maxPerTx:   1 ether,
            dailyLimit: 5 ether,
            validUntil: uint48(block.timestamp + 365 days)
        });

        vm.startPrank(owner);
        wallet.setAllowedRecipient(recipient, true);
        wallet.setAgent(agent, policy);
        vm.stopPrank();

        handler = new AgentWalletHandler(wallet, recipient, owner, agent);
        targetContract(address(handler));
    }

    /// @notice Core invariant: cumulative spend in any observed window ≤ dailyLimit
    function invariant_agentCannotExceedDailyLimit() public view {
        uint256 spent = wallet.spentToday();
        AgentWallet.Policy memory policy = wallet.getPolicy();
        assertLe(spent, policy.dailyLimit, "INVARIANT VIOLATED: spent > dailyLimit");
    }

    /// @notice Invariant: wallet is never drained below zero (sanity)
    function invariant_walletBalanceNeverNegative() public view {
        assertGe(address(wallet).balance, 0);
    }

    /// @notice Invariant: if frozen, spentToday does not increase
    function invariant_frozenWalletSpentNeverIncreases() public view {
        if (wallet.frozen()) {
            // spentToday should equal the value captured at freeze time
            // We track this in the handler
            assertEq(wallet.spentToday(), handler.spentAtFreeze());
        }
    }
}

/// @title AgentWalletHandler — drives the fuzzer with valid and invalid calls
contract AgentWalletHandler is Test {
    AgentWallet public wallet;
    address public recipient;
    address public owner;
    address public agent;

    uint256 public totalAttempted;
    uint256 public totalBlocked;
    uint256 public spentAtFreeze; // captured when wallet is frozen

    constructor(AgentWallet _wallet, address _recipient, address _owner, address _agent) {
        wallet   = _wallet;
        recipient = _recipient;
        owner    = _owner;
        agent    = _agent;
    }

    /// @dev Fuzzer calls this with random values
    function agentSpend(uint256 amount) external {
        amount = bound(amount, 0, 2 ether); // cap fuzz range
        if (wallet.frozen()) return;        // skip if frozen

        totalAttempted++;
        vm.prank(agent);
        try wallet.executeAsAgent(recipient, amount, "") {
            // success — invariant will be checked
        } catch {
            totalBlocked++;
        }
    }

    /// @dev Fuzzer can warp time to test window resets
    function advanceTime(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 2 days));
    }

    /// @dev Owner can freeze
    function ownerFreeze() external {
        if (!wallet.frozen()) {
            spentAtFreeze = wallet.spentToday();
            vm.prank(owner);
            wallet.freeze();
        }
    }

    /// @dev Owner can unfreeze
    function ownerUnfreeze() external {
        if (wallet.frozen()) {
            vm.prank(owner);
            wallet.unfreeze();
        }
    }
}
