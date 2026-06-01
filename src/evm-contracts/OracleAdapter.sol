// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IBetMarket {
    function settle(uint8 winningOutcome, address[] calldata winners) external;
    function market() external view returns (
        bytes32 matchId,
        uint64 openUntil,
        uint64 settleAfter,
        uint8 feePercent,
        uint8 outcomeCount,
        uint8 winningOutcome,
        bool settled,
        bool voided,
        bool initialized,
        uint128 totalAll
    );
}

/**
 * @title OracleAdapter
 * @notice Dual-track oracle: direct signer consensus + ECDSA signature verification.
 *
 *  Track A — Direct Signer Consensus (Primary):
 *    Authorized oracle EOAs call settleMarket(). Once CONSENSUS_THRESHOLD
 *    signers agree on the same outcome, settlement executes automatically.
 *
 *  Track B — ECDSA Signature Verification (Fallback / Relay):
 *    Anyone can relay a result by providing valid signatures from oracle signers.
 */
contract OracleAdapter is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant ORACLE_SIGNER_ROLE = keccak256("ORACLE_SIGNER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    error NotOracleSigner();
    error AlreadyVoted();
    error AlreadySettled();
    error MarketVoided();
    error TooEarlyToSettle();
    error InvalidOutcome();
    error InsufficientConsensus();
    error InvalidSignature();
    error StaleSignature();
    error WinnersArrayTooLarge();
    error ConsensusThresholdTooHigh();

    event ResultSubmitted(address indexed betMarket, uint8 winningOutcome, address indexed oracle);
    event SettlementTriggered(address indexed betMarket, uint8 winningOutcome, uint256 winnerCount);
    event SignatureVerified(address indexed betMarket, uint8 winningOutcome, address indexed signer);
    event ConsensusThresholdChanged(uint8 oldThreshold, uint8 newThreshold);

    uint8 public consensusThreshold;
    uint256 public constant SIGNATURE_VALIDITY = 1 hours;
    uint256 public constant MAX_WINNERS = 200;

    mapping(address => bool) public marketSettled;
    mapping(address => mapping(uint8 => uint8)) public outcomeVotes;
    mapping(address => mapping(address => bool)) public hasVoted;
    mapping(address => mapping(address => uint8)) public oracleVote;

    constructor(address admin, uint8 _consensusThreshold) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_SIGNER_ROLE, admin);
        _setConsensusThreshold(_consensusThreshold);
    }

    function settleMarket(
        address betMarket,
        uint8 winningOutcome,
        address[] calldata winners
    ) external onlyRole(ORACLE_SIGNER_ROLE) nonReentrant {
        _preCheck(betMarket, winningOutcome, winners);
        _recordVote(betMarket, winningOutcome);

        uint8 votes = outcomeVotes[betMarket][winningOutcome];
        if (votes >= consensusThreshold) {
            _executeSettlement(betMarket, winningOutcome, winners);
        }
    }

    function settleWithSignatures(
        address betMarket,
        uint8 winningOutcome,
        address[] calldata winners,
        bytes[] calldata signatures,
        address[] calldata signers
    ) external nonReentrant {
        if (signatures.length != signers.length) revert InvalidSignature();
        if (signatures.length < consensusThreshold) revert InsufficientConsensus();

        _preCheck(betMarket, winningOutcome, winners);

        bytes32 digest = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                betMarket,
                winningOutcome,
                keccak256(abi.encodePacked(winners))
            )
        );
        bytes32 ethSignedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));

        uint8 validSigs = 0;
        for (uint256 i = 0; i < signatures.length; ) {
            address signer = signers[i];
            if (!hasRole(ORACLE_SIGNER_ROLE, signer)) revert InvalidSignature();

            (address recovered, ECDSA.RecoverError err, ) = ethSignedMessage.tryRecover(signatures[i]);
            if (err != ECDSA.RecoverError.NoError || recovered != signer) revert InvalidSignature();

            if (hasVoted[betMarket][signer]) revert AlreadyVoted();
            _recordVoteForSigner(betMarket, signer, winningOutcome);

            unchecked { ++validSigs; }
            emit SignatureVerified(betMarket, winningOutcome, signer);
            unchecked { ++i; }
        }

        if (validSigs < consensusThreshold) revert InsufficientConsensus();
        _executeSettlement(betMarket, winningOutcome, winners);
    }

    function setConsensusThreshold(uint8 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setConsensusThreshold(newThreshold);
    }

    function emergencySettle(
        address betMarket,
        uint8 winningOutcome,
        address[] calldata winners
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        _preCheck(betMarket, winningOutcome, winners);
        _executeSettlement(betMarket, winningOutcome, winners);
    }

    function getOutcomeVotes(address betMarket, uint8 outcome) external view returns (uint8) {
        return outcomeVotes[betMarket][outcome];
    }

    function getOracleVote(address betMarket, address oracle) external view returns (uint8, bool) {
        return (oracleVote[betMarket][oracle], hasVoted[betMarket][oracle]);
    }

    function _preCheck(address betMarket, uint8 winningOutcome, address[] calldata winners) internal view {
        if (marketSettled[betMarket]) revert AlreadySettled();
        if (winners.length > MAX_WINNERS) revert WinnersArrayTooLarge();

        IBetMarket bm = IBetMarket(betMarket);
        (
            ,
            ,
            uint64 settleAfter,
            ,
            uint8 outcomeCount,
            ,
            bool settled,
            bool voided,
            ,
        ) = bm.market();

        if (settled) revert AlreadySettled();
        if (voided) revert MarketVoided();
        if (block.timestamp < settleAfter) revert TooEarlyToSettle();
        if (winningOutcome >= outcomeCount) revert InvalidOutcome();
    }

    function _recordVote(address betMarket, uint8 winningOutcome) internal {
        if (hasVoted[betMarket][msg.sender]) revert AlreadyVoted();
        _recordVoteForSigner(betMarket, msg.sender, winningOutcome);
    }

    function _recordVoteForSigner(address betMarket, address signer, uint8 winningOutcome) internal {
        hasVoted[betMarket][signer] = true;
        oracleVote[betMarket][signer] = winningOutcome;
        outcomeVotes[betMarket][winningOutcome]++;
        emit ResultSubmitted(betMarket, winningOutcome, signer);
    }

    function _executeSettlement(
        address betMarket,
        uint8 winningOutcome,
        address[] calldata winners
    ) internal {
        marketSettled[betMarket] = true;
        IBetMarket(betMarket).settle(winningOutcome, winners);
        emit SettlementTriggered(betMarket, winningOutcome, winners.length);
    }

    function _setConsensusThreshold(uint8 newThreshold) internal {
        if (newThreshold == 0) revert ConsensusThresholdTooHigh();
        uint8 old = consensusThreshold;
        consensusThreshold = newThreshold;
        emit ConsensusThresholdChanged(old, newThreshold);
    }
}