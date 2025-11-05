// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Bet.sol";
import "./TrustScore.sol";
import "./ProofToken.sol"; // Import the concrete contract
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BetFactory
 * @dev Factory for creating and managing Bet contracts.
 * Implements an internal wallet system for USDC and PROOF tokens
 * to optimize user experience by reducing gas and approval steps.
 *
 * IMPORTANT: This factory holds the actual token balances that back the internal
 * ledger (internalUsdcBalance/internalProofBalance). Burns and transfers operate
 * against the factory's real token balance.
 */
contract BetFactory is Ownable, ReentrancyGuard {
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    ProofToken public proofToken; // concrete ProofToken
    address public feeCollector;

    address[] public allBets;
    mapping(address => bool) public isBetFromFactory; // Verify Bet contracts created by this factory

    // Internal wallet balances (backed 1:1 by tokens held in this factory)
    mapping(address => uint256) public internalUsdcBalance;
    mapping(address => uint256) public internalProofBalance;

    // Configuration parameters
    uint256 public creationFeeProof;
    uint256 public voteStakeAmountProof;
    uint8 public defaultVoterRewardPercentage;
    uint8 public defaultPlatformFeePercentage;
    uint256 public maxActiveBetsPerUser;                 // Maximum number of active bets a user can create
    mapping(address => uint256) public activeBetsCount;  // Tracks active bets per user
    mapping(address => uint256) public firstInteraction; // timestamp when user first interacted

    // Events
    event BetCreated(address indexed betAddress, address indexed creator, string title);
    event FeeProcessed(address indexed payer, uint256 totalFee, uint256 burnAmount, uint256 keepAmount);
    event VoteStakeAmountChanged(uint256 oldAmount, uint256 newAmount);
    event DefaultVoterRewardChanged(uint8 oldPercentage, uint8 newPercentage);
    event DefaultPlatformFeeChanged(uint8 oldPercentage, uint8 newPercentage);
    event MaxActiveBetsChanged(uint256 oldLimit, uint256 newLimit);
    event UsdcDeposited(address indexed user, uint256 amount);
    event ProofDeposited(address indexed user, uint256 amount);
    event UsdcWithdrawn(address indexed user, uint256 amount);
    event ProofWithdrawn(address indexed user, uint256 amount);
    event InternalTransfer(address indexed from, address indexed to, uint256 usdcAmount, uint256 proofAmount, string reason);

    constructor(
        address _trustScore,
        address _usdcToken,
        address _proofToken, // Deployed ProofToken
        address _feeCollector,
        uint256 _creationFeeProof,
        uint256 _initialVoteStakeAmountProof,
        uint256 _maxActiveBets
    )
        Ownable(msg.sender)
    {
        require(_trustScore != address(0), "Zero trustScore");
        require(_usdcToken != address(0), "Zero USDC");
        require(_proofToken != address(0), "Zero PROOF");
        require(_feeCollector != address(0), "Zero feeCollector");
        require(_initialVoteStakeAmountProof > 0, "Vote stake must be > 0");

        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = ProofToken(_proofToken);
        feeCollector = _feeCollector;
        creationFeeProof = _creationFeeProof;
        voteStakeAmountProof = _initialVoteStakeAmountProof;
        maxActiveBetsPerUser = _maxActiveBets;

        // Sensible defaults (changeable by owner)
        defaultVoterRewardPercentage = 5;  // 5%
        defaultPlatformFeePercentage  = 3;  // 3%
    }

    // ========= Internal wallet (deposits/withdrawals) =========

    function depositUsdc(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");
        // Record first interaction if not already set
        if (firstInteraction[msg.sender] == 0) {
            firstInteraction[msg.sender] = block.timestamp;
        }
        internalUsdcBalance[msg.sender] += _amount;
        emit UsdcDeposited(msg.sender, _amount);
    }

    function depositProof(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(proofToken.transferFrom(msg.sender, address(this), _amount), "PROOF transfer failed");
        // Record first interaction if not already set
        if (firstInteraction[msg.sender] == 0) {
            firstInteraction[msg.sender] = block.timestamp;
        }
        internalProofBalance[msg.sender] += _amount;
        emit ProofDeposited(msg.sender, _amount);
    }

    function withdrawUsdc(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(internalUsdcBalance[msg.sender] >= _amount, "Insufficient internal USDC");

        unchecked { internalUsdcBalance[msg.sender] -= _amount; } // safe: checked above
        require(usdcToken.transfer(msg.sender, _amount), "USDC transfer failed");

        emit UsdcWithdrawn(msg.sender, _amount);
    }

    function withdrawProof(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(internalProofBalance[msg.sender] >= _amount, "Insufficient internal PROOF");

        unchecked { internalProofBalance[msg.sender] -= _amount; } // safe: checked above
        require(proofToken.transfer(msg.sender, _amount), "PROOF transfer failed");

        emit ProofWithdrawn(msg.sender, _amount);
    }

    // ========= Internal transfers (called by Bet contracts only) =========

    function transferInternalUsdc(
        address _from,
        address _to,
        uint256 _amount,
        string calldata _reason
    )
        external
        nonReentrant
    {
        require(isBetFromFactory[msg.sender], "Only factory bets");
        require(internalUsdcBalance[_from] >= _amount, "Insufficient internal USDC");

        unchecked {
            internalUsdcBalance[_from] -= _amount;
            internalUsdcBalance[_to]   += _amount;
        }

        emit InternalTransfer(_from, _to, _amount, 0, _reason);
    }

    function transferInternalProof(
        address _from,
        address _to,
        uint256 _amount,
        string calldata _reason
    )
        external
        nonReentrant
    {
        require(isBetFromFactory[msg.sender], "Only factory bets");
        require(internalProofBalance[_from] >= _amount, "Insufficient internal PROOF");

        unchecked {
            internalProofBalance[_from] -= _amount;
            internalProofBalance[_to]   += _amount;
        }

        emit InternalTransfer(_from, _to, 0, _amount, _reason);
    }

    // Read-only helper for front-end
    function getInternalBalances(address _user)
        external
        view
        returns (uint256 usdcBalance, uint256 proofBalance)
    {
        return (internalUsdcBalance[_user], internalProofBalance[_user]);
    }

    // ========= Bet creation =========

    /**
     * @dev Creates a new bet using internal balances (PROOF creation fee).
     * Assumes the factory holds the actual tokens backing the internal balance.
     */
    function createBet(Bet.BetDetails memory _details)
        external
        nonReentrant
        returns (address)
    {
        require(internalProofBalance[msg.sender] >= creationFeeProof, "Insufficient PROOF");
        require(activeBetsCount[msg.sender] < maxActiveBetsPerUser, "Too many active bets");

        // Deduct creation fee from user's internal PROOF balance
        unchecked { internalProofBalance[msg.sender] -= creationFeeProof; }

        // Process fee: burn a portion and send remainder to feeCollector FROM factory's balance
        uint256 burnAmount = (creationFeeProof * proofToken.feeBurnPercentage()) / 100;
        uint256 keepAmount = creationFeeProof - burnAmount;

        if (burnAmount > 0) {
            // Factory already holds real tokens (from deposits). Burn from factory balance.
            proofToken.burn(burnAmount);
        }
        if (keepAmount > 0) {
            require(proofToken.transfer(feeCollector, keepAmount), "PROOF fee transfer failed");
        }

        emit FeeProcessed(msg.sender, creationFeeProof, burnAmount, keepAmount);

        // Deploy the Bet
        Bet newBet = new Bet(
            _details,
            msg.sender,                 // creator
            address(this),              // factory
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken),
            feeCollector
        );

        address newBetAddress = address(newBet);
        allBets.push(newBetAddress);
        isBetFromFactory[newBetAddress] = true;
        activeBetsCount[msg.sender]++;

        // TrustScore hook
        trustScoreContract.logBetCreation(msg.sender);

        emit BetCreated(newBetAddress, msg.sender, _details.title);
        return newBetAddress;
    }

    // ========= Hooks from Bet =========

    function factoryLogBetParticipation(address participant) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        trustScoreContract.logBetParticipation(participant);
    }

    function factoryLogVote(address voter) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        trustScoreContract.logVote(voter);
    }

    // Called by Bet contract when it's resolved or cancelled
    function factoryLogBetCompletion(address creator) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        if (activeBetsCount[creator] > 0) {
            unchecked { activeBetsCount[creator]--; }
        }
    }
    // ======== Dynamic stake calculation =========
    function calculateRequiredStake(address voter) public view returns (uint256) {
        uint8 trust = trustScoreContract.getScore(voter);
        uint256 createdAt = firstInteraction[voter] == 0
            ? block.timestamp // default to now if firstInteraction missing
            : firstInteraction[voter];
        uint256 ageDays = (block.timestamp - createdAt) / 1 days;

        uint256 baseStake = voteStakeAmountProof;

        // Multiplier = 3.0x for new users, down to 1.0x for mature trusted users
        int256 rawMult = 300 - int256(uint256(trust) * 2) - int256(ageDays * 3);
        if (rawMult < 100) rawMult = 100; // floor 1.0x
        uint256 multiplier = uint256(rawMult); // scaled by 100

        return (baseStake * multiplier) / 100;
    }
    // ========= Admin =========

    function setCreationFee(uint256 _newFee) external onlyOwner {
        creationFeeProof = _newFee;
    }

    function setFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid collector");
        feeCollector = _newCollector;
    }

    function setVoteStakeAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Vote stake must be > 0");
        uint256 oldAmount = voteStakeAmountProof;
        voteStakeAmountProof = _amount;
        emit VoteStakeAmountChanged(oldAmount, _amount);
    }

    function setDefaultVoterRewardPercentage(uint8 _percentage) external onlyOwner {
        require(_percentage <= 50, "Voter reward > 50%");
        uint8 oldPercentage = defaultVoterRewardPercentage;
        defaultVoterRewardPercentage = _percentage;
        emit DefaultVoterRewardChanged(oldPercentage, _percentage);
    }

    function setDefaultPlatformFeePercentage(uint8 _percentage) external onlyOwner {
        require(_percentage <= 50, "Platform fee > 50%");
        uint8 oldPercentage = defaultPlatformFeePercentage;
        defaultPlatformFeePercentage = _percentage;
        emit DefaultPlatformFeeChanged(oldPercentage, _percentage);
    }

    function setMaxActiveBetsPerUser(uint256 _limit) external onlyOwner {
        require(_limit > 0, "Limit must be > 0");
        uint256 oldLimit = maxActiveBetsPerUser;
        maxActiveBetsPerUser = _limit;
        emit MaxActiveBetsChanged(oldLimit, _limit);
    }

    // ========= Read helpers =========

    function getBets() external view returns (address[] memory) {
        return allBets;
    }

    function getActiveBetCount(address user) external view returns (uint256) {
        return activeBetsCount[user];
    }

    function getFactoryConfig()
        external
        view
        returns (
            uint256 creationFee,
            uint256 voteStakeAmount,
            uint8 voterRewardPct,
            uint8 platformFeePct,
            uint256 maxActive
        )
    {
        return (
            creationFeeProof,
            voteStakeAmountProof,
            defaultVoterRewardPercentage,
            defaultPlatformFeePercentage,
            maxActiveBetsPerUser
        );
    }
}
