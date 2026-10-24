// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SentinelWallet is BaseAccount, ReentrancyGuard {
    IEntryPoint private immutable _ENTRY_POINT;
    address public immutable owner;

    // ---- policy state ----
    address public agent;
    uint256 public perTxLimit;
    uint256 public dailyLimit;
    uint48 public validUntil;
    mapping(address => bool) public recipientAllowed;
    mapping(address => mapping(bytes4 => bool)) public callAllowed;
    mapping(bytes32 => uint48) public approvalExpiry; // callHash => expiry (0 = none)
    mapping(uint256 => uint256) public spentOnDay;    // day => total spent

    event PolicyUpdated(uint256 perTxLimit, uint256 dailyLimit, uint48 validUntil);
    event AgentSet(address indexed agent);
    event AgentRevoked(address indexed agent);
    event RecipientSet(address indexed recipient, bool allowed);
    event CallAllowedSet(address indexed target, bytes4 indexed selector, bool allowed);
    event ApprovalSet(bytes32 indexed callHash, uint48 expiry);
    event ApprovalUsed(bytes32 indexed callHash);
    event Executed(address indexed target, uint256 value, bytes4 selector, bool approved);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(IEntryPoint ep, address _owner) {
        require(_owner != address(0), "ZERO_OWNER");
        _ENTRY_POINT = ep;
        owner = _owner;
    }

    receive() external payable {}

    function entryPoint() public view override returns (IEntryPoint) {
        return _ENTRY_POINT;
    }

    // ================= owner functions =================
    function setPolicy(uint256 _perTx, uint256 _daily, uint48 _validUntil) external onlyOwner {
        require(_perTx <= _daily, "PERTX_GT_DAILY");
        require(_validUntil > block.timestamp, "EXPIRY_NOT_FUTURE");
        perTxLimit = _perTx;
        dailyLimit = _daily;
        validUntil = _validUntil;
        emit PolicyUpdated(_perTx, _daily, _validUntil);
    }

    function setAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "ZERO_AGENT");
        agent = _agent;
        emit AgentSet(_agent);
    }

    function revokeAgent() external onlyOwner {
        address old = agent;
        agent = address(0);
        emit AgentRevoked(old);
    }

    function setRecipient(address r, bool allowed) external onlyOwner {
        recipientAllowed[r] = allowed;
        emit RecipientSet(r, allowed);
    }

    function setCallAllowed(address target, bytes4 selector, bool allowed) external onlyOwner {
        callAllowed[target][selector] = allowed;
        emit CallAllowedSet(target, selector, allowed);
    }

    function approveCall(address target, uint256 value, bytes calldata data, uint48 expiry) external onlyOwner {
        require(expiry > block.timestamp, "EXPIRY_NOT_FUTURE");
        bytes32 h = _callHash(target, value, data);
        approvalExpiry[h] = expiry;
        emit ApprovalSet(h, expiry);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "WITHDRAW_FAILED");
    }

    function addDeposit() external payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    // ================= validation (checks 1-8 except daily) =================
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        override
        returns (uint256)
    {
        // 1. signature: agent ka, userOpHash par. Fail par REVERT NAHI, return 1.
        address a = agent;
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(userOpHash, userOp.signature);
        if (a == address(0) || err != ECDSA.RecoverError.NoError || signer != a) {
            return 1; // SIG_VALIDATION_FAILED
        }

        // 2. sirf agentExecute
        bytes calldata cd = userOp.callData;
        require(cd.length >= 4 && bytes4(cd[:4]) == this.agentExecute.selector, "ONLY_AGENT_EXECUTE");
        (address target, uint256 value, bytes memory data) = abi.decode(cd[4:], (address, uint256, bytes));

        // 3. revoked: revoke par agent=0, upar sig fail ho jata hai.
        // 4. expiry: validationData ke bits se (EntryPoint khud check karta hai)
        uint48 until = validUntil;
        require(until != 0, "NO_POLICY");

        // 5-8. policy (approval ho toh limits skip)
        uint48 apr = approvalExpiry[_callHash(target, value, data)];
        _requireNotSelf(target);
        if (apr != 0) {
            if (apr < until) until = apr; // approval ki expiry bhi validationData se
        } else {
            _requirePolicy(target, value, data);
        }
        return uint256(until) << 160; // aggregator=0 (success), validUntil=until, validAfter=0
    }

    // ================= execution =================
    function agentExecute(address target, uint256 value, bytes calldata data) external nonReentrant {
        _requireFromEntryPoint();
        _requireNotSelf(target);

        bytes32 h = _callHash(target, value, data);
        uint48 apr = approvalExpiry[h];
        bool approved = apr != 0;
        if (approved) {
            require(block.timestamp <= apr, "APPROVAL_EXPIRED");
            delete approvalExpiry[h]; // ek baar
            emit ApprovalUsed(h);
        } else {
            _requirePolicy(target, value, data); // dobara check (bundle mein doosra op approval kha sakta hai)
            uint256 day = block.timestamp / 1 days;
            uint256 newTotal = spentOnDay[day] + value;
            require(newTotal <= dailyLimit, "DAILY_LIMIT");
            spentOnDay[day] = newTotal; // pehle accounting
        }

        bytes4 sel = data.length >= 4 ? bytes4(data[:4]) : bytes4(0);
        emit Executed(target, value, sel, approved);

        (bool ok,) = target.call{value: value}(data); // phir paisa
        require(ok, "CALL_FAILED");
    }

    // ================= internal helpers =================
    function _callHash(address target, uint256 value, bytes memory data) internal pure returns (bytes32) {
        return keccak256(abi.encode(target, value, keccak256(data)));
    }

    function _requireNotSelf(address target) internal view {
        require(target != address(this) && target != address(entryPoint()), "TARGET_FORBIDDEN");
    }

    function _requirePolicy(address target, uint256 value, bytes memory data) internal view {
        if (data.length == 0) {
            require(recipientAllowed[target], "RECIPIENT_NOT_ALLOWED");
        } else {
            require(data.length >= 4 && callAllowed[target][bytes4(data)], "CALL_NOT_ALLOWED");
        }
        require(value <= perTxLimit, "PERTX_LIMIT");
    }
}
