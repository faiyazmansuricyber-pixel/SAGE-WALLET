// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

contract MockSpendToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public feeBps;

    function setFeeBps(uint256 value) external {
        feeBps = value;
    }

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        uint256 fee = amount * feeBps / 10_000;
        uint256 totalDebit = amount + fee;
        require(balanceOf[msg.sender] >= totalDebit, "insufficient balance");
        balanceOf[msg.sender] -= totalDebit;
        balanceOf[recipient] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(allowance[sender][msg.sender] >= amount, "insufficient allowance");
        require(balanceOf[sender] >= amount, "insufficient balance");
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
}

interface ISpendToken {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract MockAllowanceRouter {
    function pull(address token, address sender, address recipient, uint256 amount) external {
        require(ISpendToken(token).transferFrom(sender, recipient, amount), "transfer failed");
    }
}

contract AgentWalletTokenPolicyTest is Test {
    AgentWallet private wallet;
    MockSpendToken private token;
    MockAllowanceRouter private router;

    address private constant RECIPIENT = address(0xBEEF);
    bytes4 private constant TRANSFER_SELECTOR = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 private constant APPROVE_SELECTOR = bytes4(keccak256("approve(address,uint256)"));
    bytes4 private constant TRANSFER_FROM_SELECTOR =
        bytes4(keccak256("transferFrom(address,address,uint256)"));

    function setUp() public {
        wallet = new AgentWallet(address(this));
        token = new MockSpendToken();
        router = new MockAllowanceRouter();
        token.mint(address(wallet), 1_000);

        wallet.setAgent(address(this), AgentWallet.Policy({
            maxPerTx: 1 ether,
            dailyLimit: 5 ether,
            validUntil: uint48(block.timestamp + 10 days)
        }));
        wallet.setAllowedTarget(address(token), TRANSFER_SELECTOR, true);
        wallet.setAllowedRecipient(RECIPIENT, true);
        wallet.setTokenPolicy(address(token), 100, 120);
    }

    function test_transfer_accountsTokenUnits() public {
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 40));

        assertEq(token.balanceOf(address(wallet)), 960);
        assertEq(token.balanceOf(RECIPIENT), 40);
        assertEq(wallet.tokenSpentToday(address(token)), 40);
    }

    function test_transferAccountsActualBalanceDecrease() public {
        token.setFeeBps(1_000);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 90));

        assertEq(token.balanceOf(address(wallet)), 901);
        assertEq(token.balanceOf(RECIPIENT), 90);
        assertEq(wallet.tokenSpentToday(address(token)), 99);
    }

    function test_transferRevertsIfActualDebitExceedsTransactionLimit() public {
        token.setFeeBps(1_000);

        vm.expectRevert(AgentWallet.ExceedsPerTxLimit.selector);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 92));

        assertEq(token.balanceOf(address(wallet)), 1_000);
        assertEq(token.balanceOf(RECIPIENT), 0);
        assertEq(wallet.tokenSpentToday(address(token)), 0);
    }

    function test_transfer_rejectsAmountAbovePerTransactionLimit() public {
        vm.expectRevert(AgentWallet.ExceedsPerTxLimit.selector);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 101));
    }

    function test_transfer_rejectsUnapprovedRecipient() public {
        vm.expectRevert(AgentWallet.NotAllowedRecipient.selector);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, address(0xBAD), 1));
    }

    function test_transfer_enforcesPerTokenDailyLimit() public {
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 100));

        vm.expectRevert(AgentWallet.ExceedsDailyLimit.selector);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 21));
    }

    function test_tokenSpentTodayResetsAfterPolicyWindow() public {
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 40));
        vm.warp(block.timestamp + 1 days + 1);

        assertEq(wallet.tokenSpentToday(address(token)), 0);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 40));
        assertEq(wallet.tokenSpentToday(address(token)), 40);
    }

    function test_transferRequiresConfiguredTokenPolicy() public {
        MockSpendToken unconfiguredToken = new MockSpendToken();
        unconfiguredToken.mint(address(wallet), 10);
        wallet.setAllowedTarget(address(unconfiguredToken), TRANSFER_SELECTOR, true);

        vm.expectRevert(AgentWallet.TokenPolicyNotSet.selector);
        wallet.executeAsAgent(
            address(unconfiguredToken),
            0,
            abi.encodeWithSelector(TRANSFER_SELECTOR, RECIPIENT, 1)
        );
    }

    function test_agentCannotCreateTokenAllowance() public {
        wallet.setAllowedTarget(address(token), APPROVE_SELECTOR, true);

        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(token), 0, abi.encodeWithSelector(APPROVE_SELECTOR, RECIPIENT, 100));
    }

    function test_agentCannotSpendThroughExistingTokenAllowance() public {
        wallet.setAllowedTarget(address(token), TRANSFER_FROM_SELECTOR, true);

        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(
            address(token),
            0,
            abi.encodeWithSelector(TRANSFER_FROM_SELECTOR, address(wallet), RECIPIENT, 1)
        );
    }

    function test_agentCannotUseAllowlistedRouterWithExistingTokenAllowance() public {
        bytes4 pullSelector = MockAllowanceRouter.pull.selector;
        wallet.execute(
            address(token),
            0,
            abi.encodeWithSelector(APPROVE_SELECTOR, address(router), 500)
        );
        wallet.setAllowedTarget(address(router), pullSelector, true);

        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(
            address(router),
            0,
            abi.encodeWithSelector(
                pullSelector,
                address(token),
                address(wallet),
                RECIPIENT,
                100
            )
        );

        assertEq(token.balanceOf(address(wallet)), 1_000);
        assertEq(token.balanceOf(RECIPIENT), 0);
        assertEq(token.allowance(address(wallet), address(router)), 500);
    }

    function test_agentCannotInvokeContractFallbackWithEmptyCalldata() public {
        wallet.setAllowedRecipient(address(router), true);

        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(router), 1 wei, "");
    }

    function test_agentCannotInvokeContractWithShortCalldata() public {
        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(router), 0, hex"010203");
    }
}
