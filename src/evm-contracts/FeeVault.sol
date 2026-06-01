// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeVault
 * @notice Isolated vault for collecting and distributing platform fees.
 * @dev Any registered BetMarket can send fees here. Only FEE_MANAGER_ROLE can withdraw.
 */
contract FeeVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant MARKET_REGISTRAR_ROLE = keccak256("MARKET_REGISTRAR_ROLE");

    error NotRegisteredMarket();
    error InsufficientFees();
    error ZeroAmount();
    error ZeroAddress();

    event FeeReceived(address indexed market, address indexed token, uint256 amount);
    event FeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event MarketRegistered(address indexed market);
    event MarketUnregistered(address indexed market);

    /// @notice Token address => total accumulated fees
    mapping(address => uint256) public totalFees;

    /// @notice BetMarket address => registered status
    mapping(address => bool) public registeredMarkets;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEE_MANAGER_ROLE, admin);
    }

    function grantRegistrarRole(address registrar) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MARKET_REGISTRAR_ROLE, registrar);
    }

    /**
     * @notice Register a BetMarket contract as eligible to deposit fees.
     */
    function registerMarket(address market) external onlyRole(MARKET_REGISTRAR_ROLE) {
        if (!registeredMarkets[market]) {
            registeredMarkets[market] = true;
            emit MarketRegistered(market);
        }
    }

    /**
     * @notice Unregister a BetMarket contract.
     */
    function unregisterMarket(address market) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registeredMarkets[market]) {
            registeredMarkets[market] = false;
            emit MarketUnregistered(market);
        }
    }

    /**
     * @notice Called by BetMarket after transferring tokens to notify fee receipt.
     * @param token The ERC-20 token address.
     * @param amount The amount of fees received.
     */
    function recordFee(address token, uint256 amount) external {
        if (!registeredMarkets[msg.sender]) revert NotRegisteredMarket();
        if (amount == 0) revert ZeroAmount();

        totalFees[token] += amount;
        emit FeeReceived(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw accumulated fees. Only callable by FEE_MANAGER_ROLE.
     */
    function withdrawFees(
        address token,
        address recipient,
        uint256 amount
    ) external onlyRole(FEE_MANAGER_ROLE) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount > totalFees[token]) revert InsufficientFees();

        totalFees[token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);

        emit FeesWithdrawn(token, recipient, amount);
    }

    /**
     * @notice Get the total fees accumulated for a token.
     */
    function getTotalFees(address token) external view returns (uint256) {
        return totalFees[token];
    }
}