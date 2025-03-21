// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AlphaAIStorage is Ownable, ReentrancyGuard {
    IERC20 public aaiToken;

    // Storage balance mapping: user => provider => storage amount
    mapping(address => mapping(address => uint256)) private storageBalances;

    event StoragePurchased(address indexed user, address indexed provider, uint256 amount);
    event StorageReleased(address indexed user, address indexed provider, uint256 amount);

    constructor(address initialOwner, address _aaiTokenAddress) Ownable(initialOwner) {
        require(_aaiTokenAddress != address(0), "Invalid AAI token address");
        aaiToken = IERC20(_aaiTokenAddress);
    }

    function purchaseStorage(address provider, uint256 storageAmount) external nonReentrant {
        require(provider != address(0), "Invalid provider address");
        require(storageAmount > 0, "Storage amount must be greater than 0");

        // Calculate cost in AAI tokens (1:1 ratio for simplicity)
        uint256 cost = storageAmount;

        // Transfer AAI tokens from user to contract
        require(aaiToken.transferFrom(msg.sender, address(this), cost), "Token transfer failed");

        // Update storage balance
        storageBalances[msg.sender][provider] += storageAmount;

        emit StoragePurchased(msg.sender, provider, storageAmount);
    }

    function getStorageBalance(address user, address provider) external view returns (uint256) {
        return storageBalances[user][provider];
    }

    function releaseStorage(address provider, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(storageBalances[msg.sender][provider] >= amount, "Insufficient storage balance");

        storageBalances[msg.sender][provider] -= amount;

        emit StorageReleased(msg.sender, provider, amount);
    }

    // Emergency functions
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        IERC20(token).transfer(owner(), balance);
    }
}