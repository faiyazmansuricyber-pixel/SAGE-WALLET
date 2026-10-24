// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================================
// OWNERSHIP: This file is owned by P1 (Wallet Developer).
// ============================================================================

<<<<<<< HEAD
/// @title MockMerchant ΓÇö A fake merchant contract for demo and testing
/// @notice STUB: P1 will implement.
contract MockMerchant {
    event CreditsPurchased(address indexed buyer, uint256 units);

    uint256 public constant PRICE_PER_CREDIT = 0.001 ether;
    mapping(address => uint256) public credits;

    /// @notice Buy credits by sending ETH.
    function buyCredits(uint256 units) external payable {
        uint256 requiredEth = units * PRICE_PER_CREDIT;
        require(msg.value >= requiredEth, "MockMerchant: insufficient ETH sent");
        credits[msg.sender] += units;
        emit CreditsPurchased(msg.sender, units);
        if (msg.value > requiredEth) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - requiredEth}("");
            require(success, "MockMerchant: refund failed");
        }
=======
/// @title MockMerchant — Fake merchant for demo and testing
contract MockMerchant {
    event CreditsPurchased(address indexed buyer, uint256 units, uint256 paid);

    uint256 public constant PRICE_PER_UNIT = 0.001 ether;

    mapping(address => uint256) public credits;

    /// @notice Buy credits by sending ETH. 1 unit = 0.001 ETH.
    function buyCredits(uint256 units) external payable {
        uint256 required = units * PRICE_PER_UNIT;
        require(msg.value >= required, "MockMerchant: insufficient payment");
        credits[msg.sender] += units;
        // refund excess
        if (msg.value > required) {
            (bool ok,) = msg.sender.call{value: msg.value - required}("");
            require(ok, "MockMerchant: refund failed");
        }
        emit CreditsPurchased(msg.sender, units, msg.value);
    }

    function getCredits(address buyer) external view returns (uint256) {
        return credits[buyer];
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb
    }
}
