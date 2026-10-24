// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAccount} from "@account-abstraction/interfaces/IAccount.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS, _packValidationData} from "@account-abstraction/core/Helpers.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ============================================================================
// OWNERSHIP: This file is owned by P1 (Wallet Developer).
// ============================================================================

/// @title AgentWallet ΓÇö ERC-4337 smart wallet with policy-constrained agent key
/// @notice Implements owner management, agent policy restrictions, allowlists, and ERC-4337 v0.8 validation.
contract AgentWallet is IAccount, ReentrancyGuard {
    using ECDSA for bytes32;

    // ΓöÇΓöÇ Structs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    struct Policy {
        uint256 maxPerTx;   // max ETH per single agent transaction (wei)
        uint256 dailyLimit; // max ETH agent can spend in any 24-hour window (wei)
        uint48  validUntil; // unix timestamp after which agent key expires
    }

<<<<<<< HEAD
    // ΓöÇΓöÇ Events ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
=======
    struct TokenPolicy {
        uint256 maxPerTx;   // max token units per single agent transaction
        uint256 dailyLimit; // max token units per agent window
    }

    // ── Constants ────────────────────────────────────────────────────────────

    uint256 public constant DAY = 1 days;
    uint256 public constant RECOVERY_DELAY = 48 hours;
    uint8   public constant GUARDIAN_COUNT = 5;
    uint8   public constant GUARDIAN_THRESHOLD = 3;
    bytes4  private constant TRANSFER_SELECTOR = bytes4(keccak256("transfer(address,uint256)"));

    // ── State: ownership ─────────────────────────────────────────────────────

    address public owner;
    address public agent;
    address public entryPoint;
    Policy  private _policy;

    // ── State: allowlists ────────────────────────────────────────────────────

    // keccak256(abi.encodePacked(target, selector)) => allowed
    mapping(bytes32 => bool) private _allowedTargets;
    // recipient address => allowed for plain ETH sends and ERC-20 transfers
    mapping(address => bool) private _allowedRecipients;

    mapping(address => TokenPolicy) public tokenPolicies;
    mapping(address => uint256) private _tokenSpentThisDay;
    mapping(address => uint256) private _tokenWindowStart;
    mapping(address => uint256) private _tokenPolicyGeneration;
    uint256 private _policyGeneration;

    // ── State: daily-limit tracking ──────────────────────────────────────────

    uint256 private _dayStart;       // start of current 24-h window
    uint256 private _spentThisDay;   // cumulative agent spend in window

    // ── State: freeze ────────────────────────────────────────────────────────

    bool public frozen;
    bool private _agentExecutionInProgress;

    // ── State: guardian recovery ─────────────────────────────────────────────

    address[GUARDIAN_COUNT] private _guardians;
    mapping(address => bool) private _isGuardian;
    address  private _recoveryTarget;    // proposed new owner
    uint256  private _recoveryInitiated; // timestamp when recovery was kicked off
    uint8    private _voteCount;
    mapping(address => bool) private _voted;

    // ── Events ───────────────────────────────────────────────────────────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    event AgentSet(address agent);
    event AgentRevoked();
    event EntryPointSet(address entryPoint);
    event AgentExecuted(address target, uint256 value, bytes4 selector);
    event OwnerExecuted(address target, uint256 value);
<<<<<<< HEAD
    event PolicyUpdated(uint256 perTxLimit, uint256 dailyLimit, uint48 validUntil);
    event RecipientSet(address indexed recipient, bool allowed);
    event ApprovalSet(bytes32 indexed callHash, uint48 expiry);
    event CallAllowedSet(address indexed target, bytes4 indexed selector, bool allowed);
=======
    event Frozen(address by);
    event Unfrozen();
    event RecoveryInitiated(address proposedOwner, address guardian, uint256 unlockAt);
    event RecoveryVoted(address guardian, uint8 votes);
    event RecoveryFinalized(address newOwner);
    event RecoveryCancelled(address by);
    event GuardiansSet(address[GUARDIAN_COUNT] guardians);
    event TokenPolicySet(address indexed token, uint256 maxPerTx, uint256 dailyLimit);
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    // ΓöÇΓöÇ Custom Errors ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    error NotImplemented();
    error NotAllowedTarget();
    error NotAllowedRecipient();
    error ExceedsPerTxLimit();
    error ExceedsDailyLimit();
    error PolicyExpired();
    error ForbiddenCall();
    error NotOwner();
    error NotAgent();

    // ΓöÇΓöÇ Constants & Immutables ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    IEntryPoint private immutable _entryPoint;

    // Standard ERC20 / ERC721 / ERC1155 approval selectors blocked for agent
    bytes4 private constant ERC20_APPROVE = 0x095ea7b3; // approve(address,uint256)
    bytes4 private constant ERC20_INCREASE_ALLOWANCE = 0x3950935b; // increaseAllowance(address,uint256)
    bytes4 private constant SET_APPROVAL_FOR_ALL = 0xa2223247; // setApprovalForAll(address,bool)

    // ΓöÇΓöÇ State Variables ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    address private _owner;
    address private _agent;
    Policy private _policy;

    // Daily spending accounting (fixed UTC day window: timestamp / 86400)
    uint256 private _currentDay;
    uint256 private _spentOnCurrentDay;

    // Allowlists
    // target => selector => allowed
    mapping(address => mapping(bytes4 => bool)) private _allowedTargets;
    // recipient => allowed (for ETH transfers with empty calldata)
    mapping(address => bool) private _allowedRecipients;
    // callHash => expiry for one-time owner overrides
    mapping(bytes32 => uint48) public approvalExpiry;

    // ΓöÇΓöÇ Modifiers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert NotOwner();
        }
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(_entryPoint), "account: not from EntryPoint");
        _;
    }

    // ΓöÇΓöÇ Constructor & Receive ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    constructor(IEntryPoint entryPoint_, address owner_) {
        require(address(entryPoint_) != address(0), "Invalid EntryPoint");
        require(owner_ != address(0), "Invalid owner");
        _entryPoint = entryPoint_;
        _owner = owner_;
    }

    receive() external payable {}

    // ΓöÇΓöÇ Owner-only functions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    /// @notice Set the agent address and its spending policy. Owner only.
    function setAgent(address agent_, Policy calldata policy_) external onlyOwner {
        _agent = agent_;
        _policy = policy_;
        emit AgentSet(agent_);
    }

    /// @notice Revoke the current agent. Owner only.
    function revokeAgent() external onlyOwner {
        _agent = address(0);
        delete _policy;
        emit AgentRevoked();
    }

    /// @notice Allow or disallow a target+selector pair for the agent. Owner only.
    function setAllowedTarget(address target, bytes4 selector, bool allowed) external onlyOwner {
        _allowedTargets[target][selector] = allowed;
    }

    /// @notice Allow or disallow a recipient address for the agent. Owner only.
    function setAllowedRecipient(address recipient, bool allowed) external onlyOwner {
        _allowedRecipients[recipient] = allowed;
    }

<<<<<<< HEAD
    /// @notice Compatibility function for dashboard to update policy. Owner only.
    function setPolicy(uint256 maxPerTx, uint256 dailyLimit_, uint48 validUntil_) external onlyOwner {
        _policy = Policy(maxPerTx, dailyLimit_, validUntil_);
        emit PolicyUpdated(maxPerTx, dailyLimit_, validUntil_);
    }
=======
    // ── Execution functions (Phase 1 interface — signatures frozen) ──────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    /// @notice Compatibility function for dashboard to set allowed recipient. Owner only.
    function setRecipient(address recipient, bool allowed) external onlyOwner {
        _allowedRecipients[recipient] = allowed;
        emit RecipientSet(recipient, allowed);
    }

    /// @notice Compatibility function to deposit ETH to EntryPoint for gas prefunding.
    function addDeposit() external payable {
        _entryPoint.depositTo{value: msg.value}(address(this));
    }

    /// @notice Compatibility function to allow a call selector. Owner only.
    function setCallAllowed(address target, bytes4 selector, bool allowed) external onlyOwner {
        _allowedTargets[target][selector] = allowed;
        emit CallAllowedSet(target, selector, allowed);
    }

    /// @notice Compatibility function to approve a specific one-time call. Owner only.
    function approveCall(address target, uint256 value, bytes calldata data, uint48 expiry) external onlyOwner {
        require(expiry > block.timestamp, "EXPIRY_NOT_FUTURE");
        bytes32 h = keccak256(abi.encode(target, value, data));
        approvalExpiry[h] = expiry;
        emit ApprovalSet(h, expiry);
    }

    /// @notice Owner withdraw function.
    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "WITHDRAW_FAILED");
    }

    // ΓöÇΓöÇ Execution functions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    /// @notice Execute a call as the agent. Policy-constrained. Called via EntryPoint or agent.
    function executeAsAgent(address target, uint256 value, bytes calldata data) external nonReentrant {
        // Must be called either by EntryPoint or directly by agent
        if (msg.sender != address(_entryPoint) && msg.sender != _agent) {
            revert NotAgent();
        }
        if (_agent == address(0)) {
            revert NotAgent();
        }

        // 1. Blocked calls: self-call, entrypoint call
        if (target == address(this) || target == address(_entryPoint)) {
            revert ForbiddenCall();
        }

        // 2. Policy expiry check (if validUntil is set)
        if (_policy.validUntil != 0 && block.timestamp > _policy.validUntil) {
            revert PolicyExpired();
        }

        // 3. Per-transaction limit check
        if (value > _policy.maxPerTx) {
            revert ExceedsPerTxLimit();
        }

        // 4. Daily limit check & UTC-day window tracking
        uint256 today = block.timestamp / 1 days;
        uint256 currentSpent = (today == _currentDay) ? _spentOnCurrentDay : 0;
        if (currentSpent + value > _policy.dailyLimit) {
            revert ExceedsDailyLimit();
        }

        // 5. Target / Selector / Recipient allowlist check
        bytes4 selector = bytes4(0);
        if (data.length >= 4) {
            selector = bytes4(data[:4]);

            // Block token approvals / operator approvals
            if (selector == ERC20_APPROVE || selector == ERC20_INCREASE_ALLOWANCE || selector == SET_APPROVAL_FOR_ALL) {
                revert ForbiddenCall();
            }

            // Check target + selector allowlist
            if (!_allowedTargets[target][selector]) {
                revert NotAllowedTarget();
            }
        } else {
            // Direct ETH transfer (no calldata) -> must be in allowed recipients
            if (!_allowedRecipients[target]) {
                revert NotAllowedRecipient();
            }
        }

        // Update daily spending state BEFORE external call
        if (today != _currentDay) {
            _currentDay = today;
            _spentOnCurrentDay = value;
        } else {
            _spentOnCurrentDay += value;
        }

        emit AgentExecuted(target, value, selector);

        // Perform external call (call, never delegatecall)
        (bool success, bytes memory retData) = target.call{value: value}(data);
        if (!success) {
            // Bubble revert reason
            assembly ("memory-safe") {
                revert(add(retData, 32), mload(retData))
            }
        }
    }

    /// @notice Execute a call as the owner. Unrestricted.
    function execute(address target, uint256 value, bytes calldata data) external nonReentrant {
        // Can be called directly by owner or via EntryPoint when signed by owner
        if (msg.sender != _owner && msg.sender != address(_entryPoint)) {
            revert NotOwner();
        }
        if (target == address(0)) {
            revert ForbiddenCall();
        }

        emit OwnerExecuted(target, value);

        (bool success, bytes memory retData) = target.call{value: value}(data);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(retData, 32), mload(retData))
            }
        }
    }

<<<<<<< HEAD
    // ΓöÇΓöÇ ERC-4337 EntryPoint Integration ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

    /// @notice Return the EntryPoint contract
    function entryPoint() public view returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @notice Return the account nonce from EntryPoint
    function getNonce() public view returns (uint256) {
        return _entryPoint.getNonce(address(this), 0);
    }

    /// @inheritdoc IAccount
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        // 1. Inspect callData selector
        bytes4 selector = bytes4(0);
        if (userOp.callData.length >= 4) {
            selector = bytes4(userOp.callData[:4]);
        }

        // 2. Determine authorized signer:
        // - executeAsAgent: ONLY agent can sign
        // - execute: ONLY owner can sign
        // - Any other call: reject or require owner
        address expectedSigner;
        uint48 validUntilTime = 0;
        uint48 validAfterTime = 0;

        if (selector == this.executeAsAgent.selector) {
            expectedSigner = _agent;
            if (expectedSigner == address(0)) {
                return _packValidationData(true, 0, 0);
            }
            validUntilTime = _policy.validUntil;
        } else if (selector == this.execute.selector) {
            expectedSigner = _owner;
        } else {
            // Prevent agent from calling arbitrary or owner functions
            expectedSigner = _owner;
        }

        // 3. Verify signature
        bool sigFailed = !_isValidSignature(userOpHash, userOp.signature, expectedSigner);

        // 4. Pay prefund to EntryPoint if needed
        if (missingAccountFunds != 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            (success);
        }

        return _packValidationData(sigFailed, validUntilTime, validAfterTime);
    }

    /// @dev Internal signature check using ECDSA tryRecover (supporting eth_sign prefix and raw digest)
    function _isValidSignature(bytes32 hash, bytes calldata signature, address expectedSigner) internal pure returns (bool) {
        if (expectedSigner == address(0)) {
            return false;
        }

        // Try direct hash recover first (EIP-712 userOpHash as produced by EntryPoint v0.8)
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == expectedSigner) {
            return true;
        }

        // Try eth_sign prefixed recover (if client used personal_sign / signMessage on userOpHash)
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        (recovered, err, ) = ECDSA.tryRecover(ethSignedHash, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == expectedSigner) {
            return true;
        }

        return false;
    }

    // ΓöÇΓöÇ View functions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
=======
    // ── View functions (Phase 1 interface — signatures frozen) ───────────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    function getPolicy() external view returns (Policy memory) {
        return _policy;
    }

    /// @notice Get the amount spent by the agent today (UTC day).
    function spentToday() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (today == _currentDay) {
            return _spentOnCurrentDay;
        }
        return 0;
    }

    /// @notice Get the current agent address.
    function agent() external view returns (address) {
        return _agent;
    }

    /// @notice Get the wallet owner address.
    function owner() external view returns (address) {
        return _owner;
    }

    /// @notice Check if a target and selector are allowed for the agent.
    function isAllowedTarget(address target, bytes4 selector) external view returns (bool) {
        return _allowedTargets[target][selector];
    }

    /// @notice Check if a recipient is allowed for ETH transfers.
    function isAllowedRecipient(address recipient) external view returns (bool) {
        return _allowedRecipients[recipient];
    }

    /// @notice Compatibility view function for maxPerTx
    function perTxLimit() external view returns (uint256) {
        return _policy.maxPerTx;
    }

    /// @notice Compatibility view function for dailyLimit
    function dailyLimit() external view returns (uint256) {
        return _policy.dailyLimit;
    }

    /// @notice Compatibility view function for validUntil
    function validUntil() external view returns (uint48) {
        return _policy.validUntil;
    }

    /// @notice Compatibility view function for spentOnDay
    function spentOnDay(uint256 day) external view returns (uint256) {
        if (day == _currentDay) {
            return _spentOnCurrentDay;
        }
        return 0;
    }
}
