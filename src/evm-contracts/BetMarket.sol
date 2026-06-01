// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./FeeVault.sol";

/**
 * @title BetMarket
 * @notice Per-match ephemeral betting market.
 * @dev Deployed via BettingFactory using Clones (minimal proxy).
 *
 *  Outcome indices:
 *    - 2-outcome sports (tennis, basketball, etc.): 0 = TeamA, 1 = TeamB
 *    - 3-outcome sports (football): 0 = Home, 1 = Draw, 2 = Away
 */
contract BetMarket is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    error BettingClosed();
    error AlreadySettled();
    error AlreadyVoided();
    error NotOracle();
    error ZeroStake();
    error InvalidOutcome();
    error DivisionByZero();
    error ClaimNothing();
    error TooEarlyToSettle();
    error TooLateToOpen();
    error InvalidTimeline();
    error FeeTooHigh();
    error WinnersArrayTooLarge();
    error NothingToRefund();
    error NotFactory();
    error AlreadyInitialized();
    error SettlementNotFinalized();
    error AlreadyFinalized();
    error NoFeesToSweep();
    error ZeroAddress();

    event BetPlaced(
        address indexed bettor,
        uint8 indexed outcome,
        uint128 stake,
        uint128 newTotalByOutcome,
        uint128 newTotalAll
    );
    event BetSettled(uint8 indexed winningOutcome, uint128 winnersPool, uint128 losersPool);
    event Claimed(address indexed bettor, uint128 payout);
    event Refunded(address indexed bettor, uint128 amount);
    event MarketVoided();
    event FeesSwept(address indexed feeVault, uint128 amount);
    event SettlementFinalized();
    event EmergencyDrain(address indexed token, uint256 amount);

    struct Market {
        bytes32 matchId;
        uint64 openUntil;
        uint64 settleAfter;
        uint16 feePercent;
        uint8 outcomeCount;
        uint8 winningOutcome;
        bool settled;
        bool voided;
        bool initialized;
        bool settlementFinalized;
        uint128 totalAll;
        uint128[3] totalByOutcome;
    }

    Market public market;
    string[3] public outcomeNames;

    IERC20 public betToken;
    address public factory;
    address public feeVault;

    mapping(address => mapping(uint8 => uint128)) public stakes;
    mapping(address => uint128) public claimable;

    uint128 public accruedFees;

    uint256 public constant MAX_FEE_PERCENT = 500;
    uint256 public constant MAX_WINNERS_PER_SETTLE = 500;

    constructor() {}

    function initialize(
        bytes32 _matchId,
        string calldata _teamA,
        string calldata _teamB,
        string calldata _teamC,
        uint64 _openUntil,
        uint64 _settleAfter,
        uint16 _feePercent,
        uint8 _outcomeCount,
        address _betToken,
        address _oracleAdapter,
        address _feeVault,
        address _admin
    ) external {
        if (market.initialized) revert AlreadyInitialized();
        factory = msg.sender;
        if (_feePercent > MAX_FEE_PERCENT) revert FeeTooHigh();
        if (_openUntil >= _settleAfter) revert InvalidTimeline();
        if (_openUntil <= block.timestamp + 10 minutes) revert TooLateToOpen();
        if (_outcomeCount != 2 && _outcomeCount != 3) revert InvalidOutcome();
        if (_feeVault == address(0)) revert ZeroAddress();

        Market storage m = market;
        m.matchId = _matchId;
        m.openUntil = _openUntil;
        m.settleAfter = _settleAfter;
        m.feePercent = _feePercent;
        m.outcomeCount = _outcomeCount;
        m.winningOutcome = 0;
        m.settled = false;
        m.voided = false;
        m.initialized = true;
        m.settlementFinalized = false;
        m.totalAll = 0;
        m.totalByOutcome[0] = 0;
        m.totalByOutcome[1] = 0;
        m.totalByOutcome[2] = 0;

        outcomeNames[0] = _teamA;
        outcomeNames[1] = _outcomeCount == 3 ? _teamC : _teamB;
        outcomeNames[2] = _outcomeCount == 3 ? _teamB : "";

        betToken = IERC20(_betToken);
        feeVault = _feeVault;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _oracleAdapter);
        _grantRole(FEE_MANAGER_ROLE, _admin);
    }

    function placeBet(uint8 outcome, uint128 amount) external nonReentrant whenNotPaused {
        Market storage m = market;

        if (block.timestamp >= m.openUntil) revert BettingClosed();
        if (outcome >= m.outcomeCount) revert InvalidOutcome();
        if (amount == 0) revert ZeroStake();

        uint256 balBefore = betToken.balanceOf(address(this));
        betToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = betToken.balanceOf(address(this)) - balBefore;
        if (received < 1) revert ZeroStake();
        uint128 received128 = uint128(received);

        stakes[msg.sender][outcome] += received128;
        m.totalByOutcome[outcome] += received128;
        m.totalAll += received128;

        emit BetPlaced(msg.sender, outcome, received128, m.totalByOutcome[outcome], m.totalAll);
    }

    function settle(uint8 winningOutcome, address[] calldata winners) external onlyRole(ORACLE_ROLE) nonReentrant {
        Market storage m = market;

        if (m.settled) revert AlreadySettled();
        if (m.voided) revert AlreadyVoided();
        if (block.timestamp < m.settleAfter) revert TooEarlyToSettle();
        if (winningOutcome >= m.outcomeCount) revert InvalidOutcome();
        if (winners.length > MAX_WINNERS_PER_SETTLE) revert WinnersArrayTooLarge();

        uint128 winnersPool = m.totalByOutcome[winningOutcome];
        uint128 losersPool = m.totalAll - winnersPool;

        if (winnersPool == 0) {
            _voidMarket();
            return;
        }

        m.settled = true;
        m.winningOutcome = winningOutcome;

        uint128 fees = 0;
        for (uint256 i = 0; i < winners.length; ) {
            address winner = winners[i];
            uint128 stake = stakes[winner][winningOutcome];
            if (stake > 0 && claimable[winner] == 0) {
                (uint128 payout, uint128 fee) = _computePayoutAndFee(stake, winnersPool, losersPool, m.feePercent);
                claimable[winner] = payout;
                fees += fee;
            }
            unchecked { ++i; }
        }

        accruedFees += fees;

        emit BetSettled(winningOutcome, winnersPool, losersPool);
    }

    function finalizeSettlement() external onlyRole(ORACLE_ROLE) {
        Market storage m = market;
        if (!m.settled) revert AlreadySettled();
        if (m.settlementFinalized) revert AlreadyFinalized();

        m.settlementFinalized = true;

        uint128 fees = accruedFees;
        accruedFees = 0;

        emit SettlementFinalized();

        if (fees > 0) {
            emit FeesSwept(feeVault, fees);
            betToken.safeTransfer(feeVault, fees);
            FeeVault(feeVault).recordFee(address(betToken), fees);
        }
    }

    function claim() external nonReentrant {
        uint128 payout = claimable[msg.sender];
        if (payout == 0) revert ClaimNothing();

        claimable[msg.sender] = 0;
        stakes[msg.sender][market.winningOutcome] = 0;

        betToken.safeTransfer(msg.sender, payout);

        emit Claimed(msg.sender, payout);
    }

    function refund() external nonReentrant {
        Market storage m = market;
        if (!m.voided) revert NothingToRefund();

        uint128 totalStake = 0;
        for (uint8 i = 0; i < m.outcomeCount; ) {
            totalStake += stakes[msg.sender][i];
            stakes[msg.sender][i] = 0;
            unchecked { ++i; }
        }

        if (totalStake == 0) revert NothingToRefund();

        betToken.safeTransfer(msg.sender, totalStake);

        emit Refunded(msg.sender, totalStake);
    }

    function voidMarket() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _voidMarket();
    }

    function emergencyDrain(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(betToken)) revert NothingToRefund();
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, balance);
        emit EmergencyDrain(token, balance);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getStake(address bettor, uint8 outcome) external view returns (uint128) {
        return stakes[bettor][outcome];
    }

    function getTotalByOutcome(uint8 outcome) external view returns (uint128) {
        return market.totalByOutcome[outcome];
    }

    function getOutcomeName(uint8 outcome) external view returns (string memory) {
        return outcomeNames[outcome];
    }

    function getClaimable(address bettor) external view returns (uint128) {
        return claimable[bettor];
    }

    function _computePayoutAndFee(
        uint128 stake,
        uint128 winnersPool,
        uint128 losersPool,
        uint16 feePercent
    ) internal pure returns (uint128 payout, uint128 fee) {
        uint256 proportionalShare = (uint256(stake) * losersPool) / winnersPool;
        uint256 gross = stake + proportionalShare;
        uint256 fee256 = (gross * feePercent) / 10_000;
        payout = uint128(gross - fee256);
        fee = uint128(fee256);
    }

    function _voidMarket() internal {
        Market storage m = market;
        if (m.voided) revert AlreadyVoided();
        m.voided = true;
        m.settled = true;
        emit MarketVoided();
    }
}