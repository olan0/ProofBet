
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink } from "lucide-react";

export default function SmartContractsPage() {
  const contracts = [
    {
      name: "MockERC20.sol",
      description: "A simple ERC20 token for local testing (replaces USDC).",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// This is a simple ERC20 token for testing purposes on local networks.
contract MockERC20 is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    // Function to mint tokens to any address, useful for testing.
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}`
    },
    {
      name: "IERC20.sol",
      description: "Standard interface for ERC20 tokens (USDC and PROOF).",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}`
    },
    {
      name: "ProofToken.sol",
      description: "ERC20 platform token with inflation and burn mechanisms.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProofToken
 * @dev Platform token with controlled inflation and fee burning
 */
contract ProofToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    
    // Tokenomics parameters
    uint256 public annualInflationRate = 5; // 5% per year
    uint256 public feeBurnPercentage = 50; // 50% of fees burned
    uint256 public lastInflationMint;
    
    // Tracking
    uint256 public totalBurned;
    uint256 public totalMintedFromInflation;
    
    // Authorized contracts that can burn tokens
    mapping(address => bool) public authorizedBurners;
    
    event TokensBurned(address indexed from, uint255 amount, string reason);
    event InflationMinted(address indexed to, uint255 amount, uint255 year);
    event BurnerAuthorized(address indexed burner, bool authorized);
    event InflationRateChanged(uint255 oldRate, uint255 newRate);
    event BurnRateChanged(uint255 oldRate, uint255 newRate);
    
    modifier onlyAuthorizedBurner() {
        require(authorizedBurners[msg.sender], "Not authorized to burn");
        _;
    }
    
    constructor() ERC20("ProofBet Token", "PROOF") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, 100000000 * 10**18); // 100 million tokens initially
        lastInflationMint = block.timestamp;
    }
    
    /**
     * @dev Mint tokens for annual inflation (only once per year)
     */
    function mintInflation(address recipient) external onlyOwner returns (uint255) {
        require(block.timestamp >= lastInflationMint + 365 days, "Inflation already minted this year");
        
        uint256 currentSupply = totalSupply();
        uint256 inflationAmount = (currentSupply * annualInflationRate) / 100;
        
        require(currentSupply + inflationAmount <= MAX_SUPPLY, "Would exceed max supply");
        
        _mint(recipient, inflationAmount);
        totalMintedFromInflation += inflationAmount;
        lastInflationMint = block.timestamp;
        
        emit InflationMinted(recipient, inflationAmount, getCurrentYear());
        return inflationAmount;
    }
    
    /**
     * @dev Burn tokens from fees (called by authorized contracts)
     * The 'sender' address must hold the 'totalFeeAmount' tokens.
     */
    function burnFromFees(address sender, uint256 totalFeeAmount) external onlyAuthorizedBurner returns (uint256 burnAmount, uint256 keepAmount) {
        burnAmount = (totalFeeAmount * feeBurnPercentage) / 100;
        keepAmount = totalFeeAmount - burnAmount;
        
        require(balanceOf(sender) >= totalFeeAmount, "ProofToken: Sender does not hold enough tokens for fee processing");

        if (burnAmount > 0) {
            _burn(sender, burnAmount);
            totalBurned += burnAmount;
            emit TokensBurned(sender, burnAmount, "Fee burn");
        }
        
        // Transfer remaining tokens to platform owner
        if (keepAmount > 0) {
            _transfer(sender, owner(), keepAmount);
        }
        
        return (burnAmount, keepAmount);
    }
    
    /**
     * @dev Manual burn function for users
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount, "Manual burn");
    }
    
    /**
     * @dev Set annual inflation rate (max 20%)
     */
    function setInflationRate(uint256 _rate) external onlyOwner {
        require(_rate <= 20, "Inflation rate too high");
        uint256 oldRate = annualInflationRate;
        annualInflationRate = _rate;
        emit InflationRateChanged(oldRate, _rate);
    }
    
    /**
     * @dev Set fee burn percentage (0-100%)
     */
    function setBurnRate(uint256 _rate) external onlyOwner {
        require(_rate <= 100, "Burn rate too high");
        uint256 oldRate = feeBurnPercentage;
        feeBurnPercentage = _rate;
        emit BurnRateChanged(oldRate, _rate);
    }
    
    /**
     * @dev Authorize/deauthorize contracts to burn tokens
     */
    function authorizeBurner(address burner, bool authorized) external onlyOwner {
        authorizedBurners[burner] = authorized;
        emit BurnerAuthorized(burner, authorized);
    }
    
    /**
     * @dev Get current year for inflation tracking
     */
    function getCurrentYear() public view returns (uint255) {
        // Simple year calculation based on epoch, not perfectly accurate for leap years but sufficient for conceptual inflation.
        return 1970 + (block.timestamp / (365 days));
    }
    
    /**
     * @dev Check if inflation can be minted
     */
    function canMintInflation() public view returns (bool) {
        return block.timestamp >= lastInflationMint + 365 days;
    }
    
    /**
     * @dev Get tokenomics summary
     */
    function getTokenomics() public view returns (
        uint256 currentSupply,
        uint256 maxSupply,
        uint256 burned,
        uint256 mintedFromInflation,
        uint256 inflationRate,
        uint256 burnRate
    ) {
        return (
            totalSupply(),
            MAX_SUPPLY,
            totalBurned,
            totalMintedFromInflation,
            annualInflationRate,
            feeBurnPercentage
        );
    }
}`
    },
    {
      name: "TrustScore.sol",
      description: "Manages user reputation scores based on platform activity.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustScore
 * @dev Manages user reputation scores based on platform activity.
 * Scores are integers from 0 to 100.
 */
contract TrustScore is Ownable {
    mapping(address => uint8) public scores;
    mapping(address => bool) public authorizedContracts;

    // Points for various actions
    uint8 public constant CREATE_BET_POINTS = 2;
    uint8 public constant PARTICIPATE_POINTS = 1;
    uint8 public constant VOTE_POINTS = 1;
    uint8 public constant PENALTY_POINTS = 5; // e.g., for a cancelled bet

    event ScoreUpdated(address indexed user, uint8 oldScore, uint8 newScore);
    event ContractAuthorized(address indexed contractAddress, bool isAuthorized);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Not an authorized contract");
        _;
    }

    constructor() Ownable(msg.sender) {
        // The deployer is automatically authorized to perform initial setup
        authorizedContracts[msg.sender] = true;
    }

    /**
     * @dev Authorize or deauthorize a contract to update scores.
     */
    function authorizeContract(address _contractAddress, bool _isAuthorized) external onlyOwner {
        authorizedContracts[_contractAddress] = _isAuthorized;
        emit ContractAuthorized(_contractAddress, _isAuthorized);
    }

    /**
     * @dev Called by an authorized contract (e.g., BetFactory) when a user creates a bet.
     */
    function logBetCreation(address _creator) external onlyAuthorized {
        _increaseScore(_creator, CREATE_BET_POINTS);
    }

    /**
     * @dev Called by an authorized BetFactory contract when a user places a bet in any Bet.
     */
    function logBetParticipation(address _participant) external onlyAuthorized {
        _increaseScore(_participant, PARTICIPATE_POINTS);
    }

    /**
     * @dev Called by an authorized BetFactory contract when a user votes.
     */
    function logVote(address _voter) external onlyAuthorized {
        _increaseScore(_voter, VOTE_POINTS);
    }

    /**
     * @dev Called by an authorized contract when an action warrants a penalty.
     */
    function applyPenalty(address _user) external onlyAuthorized {
        _decreaseScore(_user, PENALTY_POINTS);
    }
    
    /**
     * @dev Get the current trust score for a user.
     */
    function getScore(address _user) public view returns (uint8) {
        return scores[_user];
    }

    /**
     * @dev Internal function to increase a user's score.
     */
    function _increaseScore(address _user, uint8 _points) internal {
        uint8 oldScore = scores[_user];
        if (oldScore + _points >= 100) {
            scores[_user] = 100;
        } else {
            scores[_user] = oldScore + _points;
        }
        emit ScoreUpdated(_user, oldScore, scores[_user]);
    }
    
    /**
     * @dev Internal function to decrease a user's score.
     */
    function _decreaseScore(address _user, uint8 _points) internal {
        uint8 oldScore = scores[_user];
        if (oldScore <= _points) {
            scores[_user] = 0;
        } else {
            scores[_user] = oldScore - _points;
        }
        emit ScoreUpdated(_user, oldScore, scores[_user]);
    }
}`
    },
    {
      name: "BetFactory.sol",  
      description: "Updated factory with internal wallet system - users deposit tokens and use internal balances for betting.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Bet.sol";
import "./TrustScore.sol";
import "./ProofToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BetFactory
 * @dev Creates bets and manages internal user balances for seamless betting experience
 */
contract BetFactory is Ownable, ReentrancyGuard {
    address[] public allBets;
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    ProofToken public proofToken;
    
    address public feeCollector;
    uint256 public creationFeeProof;
    uint256 public voteStakeAmountProof;

    uint8 public defaultVoterRewardPercentage;
    uint8 public defaultPlatformFeePercentage;
    uint256 public maxActiveBetsPerUser;
    
    mapping(address => uint256) public activeBetsCount;
    mapping(address => bool) public isBetFromFactory;
    
    // NEW: Internal wallet balances
    mapping(address => uint256) public internalUsdcBalance;
    mapping(address => uint256) public internalProofBalance;
    
    event BetCreated(address indexed betAddress, address indexed creator, string title);
    event FeeProcessed(address indexed user, uint256 totalFee, uint256 burned, uint256 kept);
    event VoteStakeAmountChanged(uint256 oldAmount, uint256 newAmount);
    event DefaultVoterRewardChanged(uint8 oldPercentage, uint8 newPercentage);
    event DefaultPlatformFeeChanged(uint8 oldPercentage, uint8 newPercentage);
    event MaxActiveBetsChanged(uint256 oldLimit, uint256 newLimit);
    
    // NEW: Internal wallet events
    event UsdcDeposited(address indexed user, uint256 amount);
    event ProofDeposited(address indexed user, uint256 amount);
    event UsdcWithdrawn(address indexed user, uint256 amount);
    event ProofWithdrawn(address indexed user, uint256 amount);
    event InternalTransfer(address indexed from, address indexed to, uint256 usdcAmount, uint256 proofAmount, string reason);
    
    constructor(
        address _trustScore,
        address _usdcToken,
        address _proofToken,
        address _feeCollector,
        uint256 _creationFeeProof,
        uint256 _initialVoteStakeAmountProof,
        uint256 _maxActiveBets
    ) Ownable(msg.sender) {
        require(_initialVoteStakeAmountProof > 0, "Initial vote stake must be greater than 0");
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = ProofToken(_proofToken);
        feeCollector = _feeCollector;
        creationFeeProof = _creationFeeProof;
        voteStakeAmountProof = _initialVoteStakeAmountProof;
        maxActiveBetsPerUser = _maxActiveBets;
        
        defaultVoterRewardPercentage = 5;
        defaultPlatformFeePercentage = 3;
    }
    
    // NEW: Internal wallet functions
    function depositUsdc(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");
        
        internalUsdcBalance[msg.sender] += _amount;
        emit UsdcDeposited(msg.sender, _amount);
    }
    
    function depositProof(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(proofToken.transferFrom(msg.sender, address(this), _amount), "PROOF transfer failed");
        
        internalProofBalance[msg.sender] += _amount;
        emit ProofDeposited(msg.sender, _amount);
    }
    
    function withdrawUsdc(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(internalUsdcBalance[msg.sender] >= _amount, "Insufficient internal USDC balance");
        
        internalUsdcBalance[msg.sender] -= _amount;
        require(usdcToken.transfer(msg.sender, _amount), "USDC transfer failed");
        
        emit UsdcWithdrawn(msg.sender, _amount);
    }
    
    function withdrawProof(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(internalProofBalance[msg.sender] >= _amount, "Insufficient internal PROOF balance");
        
        internalProofBalance[msg.sender] -= _amount;
        require(proofToken.transfer(msg.sender, _amount), "PROOF transfer failed");
        
        emit ProofWithdrawn(msg.sender, _amount);
    }
    
    // NEW: Internal transfer functions for bet operations
    function transferInternalUsdc(address _from, address _to, uint256 _amount, string calldata _reason) external {
        require(isBetFromFactory[msg.sender], "Only factory bets can call this");
        require(internalUsdcBalance[_from] >= _amount, "Insufficient internal USDC balance");
        
        internalUsdcBalance[_from] -= _amount;
        internalUsdcBalance[_to] += _amount;
        
        emit InternalTransfer(_from, _to, _amount, 0, _reason);
    }
    
    function transferInternalProof(address _from, address _to, uint256 _amount, string calldata _reason) external {
        require(isBetFromFactory[msg.sender], "Only factory bets can call this");
        require(internalProofBalance[_from] >= _amount, "Insufficient internal PROOF balance");
        
        internalProofBalance[_from] -= _amount;
        internalProofBalance[_to] += _amount;
        
        emit InternalTransfer(_from, _to, 0, _amount, _reason);
    }
    
    // NEW: Get user's internal balances
    function getInternalBalances(address _user) external view returns (uint256 usdcBalance, uint256 proofBalance) {
        return (internalUsdcBalance[_user], internalProofBalance[_user]);
    }
    
    /**
     * @dev Creates a new bet using internal balances
     */
    function createBet(Bet.BetDetails memory _details) external returns (address) {
        require(internalProofBalance[msg.sender] >= creationFeeProof, "Insufficient internal PROOF balance");
        require(activeBetsCount[msg.sender] < maxActiveBetsPerUser, "Creator has too many active bets");
        
        // Deduct creation fee from internal balance
        internalProofBalance[msg.sender] -= creationFeeProof;
        
        // The factory holds the actual PROOF tokens and burns them from its own balance.
        (uint256 burnAmount, uint256 keepAmount) = proofToken.burnFromFees(address(this), creationFeeProof);
        
        emit FeeProcessed(msg.sender, creationFeeProof, burnAmount, keepAmount);
        
        _details.creator = msg.sender;
        _details.voterRewardPercentage = defaultVoterRewardPercentage;
        _details.platformFeePercentage = defaultPlatformFeePercentage;
        
        Bet newBet = new Bet(
            _details,
            address(this),
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken),
            feeCollector,
            voteStakeAmountProof
        );
        address newBetAddress = address(newBet);
        allBets.push(newBetAddress);
        isBetFromFactory[newBetAddress] = true;
        
        activeBetsCount[msg.sender]++;
        
        trustScoreContract.logBetCreation(msg.sender);
        
        emit BetCreated(newBetAddress, msg.sender, _details.title);
        return newBetAddress;
    }
    
    function factoryLogBetParticipation(address participant) external {
        require(isBetFromFactory[msg.sender], "Caller is not a valid Bet contract");
        trustScoreContract.logBetParticipation(participant);
    }
    
    function factoryLogVote(address voter) external {
        require(isBetFromFactory[msg.sender], "Caller is not a valid Bet contract");
        trustScoreContract.logVote(voter);
    }
    
    // Called by Bet contract when it's resolved or cancelled
    function factoryLogBetCompletion(address creator) external {
        require(isBetFromFactory[msg.sender], "Caller is not a valid Bet contract");
        if (activeBetsCount[creator] > 0) {
            activeBetsCount[creator]--;
        }
    }

    // --- Admin functions ---
    function setCreationFee(uint256 _newFee) external onlyOwner {
        creationFeeProof = _newFee;
    }
    
    function setFeeCollector(address _newCollector) external onlyOwner {
        feeCollector = _newCollector;
    }
    
    function setVoteStakeAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Vote stake must be greater than 0");
        uint256 oldAmount = voteStakeAmountProof;
        voteStakeAmountProof = _amount;
        emit VoteStakeAmountChanged(oldAmount, _amount);
    }

    function setDefaultVoterRewardPercentage(uint8 _percentage) external onlyOwner {
        require(_percentage <= 50, "Voter reward cannot exceed 50%");
        uint8 oldPercentage = defaultVoterRewardPercentage;
        defaultVoterRewardPercentage = _percentage;
        emit DefaultVoterRewardChanged(oldPercentage, _percentage);
    }
    
    function setDefaultPlatformFeePercentage(uint8 _percentage) external onlyOwner {
        require(_percentage <= 50, "Platform fee cannot exceed 50%");
        uint8 oldPercentage = defaultPlatformFeePercentage;
        defaultPlatformFeePercentage = _percentage;
        emit DefaultPlatformFeeChanged(oldPercentage, _percentage);
    }
    
    // Admin function to set the max active bets limit
    function setMaxActiveBetsPerUser(uint256 _limit) external onlyOwner {
        require(_limit > 0, "Limit must be greater than 0");
        uint256 oldLimit = maxActiveBetsPerUser;
        maxActiveBetsPerUser = _limit;
        emit MaxActiveBetsChanged(oldLimit, _limit);
    }
    
    function getBets() external view returns (address[] memory) {
        return allBets;
    }
}`
    },
    {
      name: "Bet.sol",
      description: "Individual prediction market using internal wallet balances for seamless betting experience.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TrustScore.sol";
import "./BetFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Bet  
 * @dev Individual prediction market contract using internal wallet system
 */
contract Bet is ReentrancyGuard {
    enum Status { OPEN_FOR_BETS, AWAITING_PROOF, VOTING, COMPLETED, CANCELLED }
    enum Side { NONE, YES, NO }

    struct BetDetails {
        address creator;
        string title;
        string description;
        uint256 bettingDeadline;
        uint256 proofDeadline;
        uint256 votingDeadline;
        uint256 minimumBetAmount;
        uint256 minimumSideStake;
        uint8 minimumTrustScore;
        uint8 voterRewardPercentage;
        uint8 platformFeePercentage;
    }

    struct Participant {
        uint256 yesStake;
        uint256 noStake;
        bool hasWithdrawn;
    }

    BetDetails public details;
    BetFactory public betFactory;
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    IERC20 public proofToken; // This still references the ProofToken contract but actual transfers go through BetFactory's internal balance system
    address public feeCollector;

    uint256 public totalYesStake;
    uint256 public totalNoStake;
    uint256 public totalVoteStakeProof;
    uint256 public voteStakeAmountProof;
    string public proofUrl;
    Side public winningSide;
    bool public fundsDistributed;
    bool private creatorCountDecremented;

    uint256 public yesVotes;
    uint256 public noVotes;
    uint256 public participantCount;
    uint256 public totalVotes; 

    mapping(address => bool) public hasParticipated;
    mapping(address => Participant) public participants;
    mapping(address => uint256) public voterStakesProof;
    mapping(address => Side) public votes;
    mapping(address => bool) public voted;
    
    Status private _currentStatus;

    event BetPlaced(address indexed user, Side position, uint256 amountUsdc);
    event ProofSubmitted(address indexed creator, string proofUrl);
    event VoteCast(address indexed voter, uint256 vote, uint256 amountProof);
    event BetResolved(Side winningSide);
    event BetCancelled();
    event FundsWithdrawn(address indexed user, uint256 amountUsdc, uint256 amountProof);

    modifier onlyCreator() {
        require(msg.sender == details.creator, "Not creator");
        _;
    }

    modifier atStatus(Status _status) {
        require(_currentStatus == _status, "Invalid status");
        _;
    }

    constructor(
        BetDetails memory _details, 
        address _betFactory,
        address _trustScore, 
        address _usdcToken,
        address _proofToken,
        address _feeCollector,
        uint256 _voteStakeAmountProof
    ) {
        details = _details;
        betFactory = BetFactory(_betFactory);
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken); // Keep reference, but transfers are internal to factory
        feeCollector = _feeCollector;
        voteStakeAmountProof = _voteStakeAmountProof;
        _currentStatus = Status.OPEN_FOR_BETS;
        creatorCountDecremented = false;
        participantCount = 0;
        totalVotes = 0;
    }

    // Public getter for currentStatus
    function currentStatus() public view returns (Status) {
        return _currentStatus;
    }

    /**
     * @dev Get the bet details struct
     */
    function getBetDetails() external view returns (BetDetails memory) {
        return details;
    }

    /**
     * @dev Get basic bet information for listing
     * Function to get bet info including participant count AND voter count
     */
    function getBetInfo() external view returns (
        string memory title,
        string memory description,
        address creator,
        Status status,
        uint256 totalYes,
        uint256 totalNo,
        uint256 creationTimestamp, // Using this name as per outline, corresponds to bettingDeadline proxy
        uint256 participantsCount, // FIXED: Renamed to avoid shadowing
        uint256 votersCount // FIXED: Renamed to avoid shadowing
    ) {
        return (
            details.title,
            details.description,
            details.creator,
            _currentStatus,
            totalYesStake,
            totalNoStake,
            details.bettingDeadline, // Using bettingDeadline as a proxy for a time reference
            participantCount,
            totalVotes
        );
    }

    /**
     * @dev Get vote statistics
     */
    function getVoteStats() external view returns (
        uint256 totalYesVotes,
        uint256 totalNoVotes,
        uint256 totalVoteStake
    ) {
        return (yesVotes, noVotes, totalVoteStakeProof);
    }

    // === CORE FUNCTIONALITY ===

    // NEW: Place bet using internal wallet balance
    function placeBet(Side _position, uint256 _amountUsdc) external nonReentrant atStatus(Status.OPEN_FOR_BETS) {
        require(block.timestamp < details.bettingDeadline, "Betting has closed");
        require(_position == Side.YES || _position == Side.NO, "Invalid position");
        require(_amountUsdc >= details.minimumBetAmount, "Stake is too low");
        
        if (details.minimumTrustScore > 0) {
            require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust score too low");
        }
        
        // Use internal wallet balance instead of direct token transfer
        (uint256 userUsdcBalance,) = betFactory.getInternalBalances(msg.sender);
        require(userUsdcBalance >= _amountUsdc, "Insufficient internal USDC balance");
        
        // Transfer from user's internal balance to this contract's address (held by factory)
        betFactory.transferInternalUsdc(msg.sender, address(this), _amountUsdc, "Bet placement");

        if (!hasParticipated[msg.sender]) {
            hasParticipated[msg.sender] = true;
            participantCount++;
        }

        Participant storage participant = participants[msg.sender];
        if (_position == Side.YES) {
            participant.yesStake += _amountUsdc;
            totalYesStake += _amountUsdc;
        } else {
            participant.noStake += _amountUsdc;
            totalNoStake += _amountUsdc;
        }
        
        betFactory.factoryLogBetParticipation(msg.sender);
        
        emit BetPlaced(msg.sender, _position, _amountUsdc);
    }
    
    function submitProof(string memory _proofUrl) external onlyCreator atStatus(Status.AWAITING_PROOF) {
        require(block.timestamp >= details.bettingDeadline, "Betting must be closed to submit proof");
        require(block.timestamp < details.proofDeadline, "Proof submission deadline passed");
        require(bytes(_proofUrl).length > 0, "Proof URL cannot be empty");
        proofUrl = _proofUrl;
        _currentStatus = Status.VOTING;
        emit ProofSubmitted(details.creator, _proofUrl);
    }

    // NEW: Vote using internal wallet balance
    function vote(Side _vote) external nonReentrant atStatus(Status.VOTING) {
        require(block.timestamp < details.votingDeadline, "Voting has closed");
        require(_vote == Side.YES || _vote == Side.NO, "Invalid vote");
        require(participants[msg.sender].yesStake == 0 && participants[msg.sender].noStake == 0, "Bettors cannot vote");
        require(!voted[msg.sender], "Already voted");
        require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust score too low");
        
        // Use internal wallet balance instead of direct token transfer
        (, uint255 userProofBalance) = betFactory.getInternalBalances(msg.sender);
        require(userProofBalance >= voteStakeAmountProof, "Insufficient internal PROOF balance");

        // Transfer from user's internal balance to this contract's address (held by factory)
        betFactory.transferInternalProof(msg.sender, address(this), voteStakeAmountProof, "Vote stake");
        
        voted[msg.sender] = true;
        votes[msg.sender] = _vote;
        voterStakesProof[msg.sender] += voteStakeAmountProof;
        totalVoteStakeProof += voteStakeAmountProof;
        totalVotes++;
        
        if (_vote == Side.YES) {
            yesVotes++;
        } else {
            noVotes++;
        }

        betFactory.factoryLogVote(msg.sender);
        
        emit VoteCast(msg.sender, uint256(_vote), voteStakeAmountProof);
    }

    // === AUTOMATED KEEPER FUNCTIONS ===

    function checkAndCloseBetting() external {
        if (_currentStatus == Status.OPEN_FOR_BETS && block.timestamp >= details.bettingDeadline) {
            if (totalYesStake >= details.minimumSideStake && totalNoStake >= details.minimumSideStake) {
                _currentStatus = Status.AWAITING_PROOF;
            } else {
                _currentStatus = Status.CANCELLED;
                _notifyFactoryOfCompletion();
                emit BetCancelled();
            }
        }
    }
    
    function checkAndCancelForProof() external {
        if (_currentStatus == Status.AWAITING_PROOF && block.timestamp >= details.proofDeadline) {
            _currentStatus = Status.CANCELLED;
            _notifyFactoryOfCompletion();
            emit BetCancelled();
        }
    }
    
    function checkAndResolve() external {
        if (_currentStatus == Status.VOTING && block.timestamp >= details.votingDeadline) {
            if (yesVotes > noVotes) {
                winningSide = Side.YES;
                _currentStatus = Status.COMPLETED;
                _notifyFactoryOfCompletion();
                emit BetResolved(winningSide);
            } else if (noVotes > yesVotes) {
                winningSide = Side.NO;
                _currentStatus = Status.COMPLETED;
                _notifyFactoryOfCompletion();
                emit BetResolved(winningSide);
            } else {
                _currentStatus = Status.CANCELLED;
                _notifyFactoryOfCompletion();
                emit BetCancelled();
            }
        }
    }
    
    // Internal function to notify factory
    function _notifyFactoryOfCompletion() internal {
        if (!creatorCountDecremented) {
            creatorCountDecremented = true;
            betFactory.factoryLogBetCompletion(details.creator);
        }
    }
    
    // === FUND WITHDRAWAL ===

    function withdrawFunds() external nonReentrant {
        require(_currentStatus == Status.COMPLETED || _currentStatus == Status.CANCELLED, "Bet not finished");
        require(!fundsDistributed, "Funds already being distribution");

        if (_currentStatus == Status.COMPLETED) {
            distributeWinnings();
        } else { // CANCELLED
            refundAll();
        }
    }

    function distributeWinnings() internal {
        fundsDistributed = true;
        
        uint252 totalStake = totalYesStake + totalNoStake;
        require(totalStake > 0, "No stakes to distribute");
        
        uint256 platformFeeAmount = (totalStake * details.platformFeePercentage) / 100;
        if (platformFeeAmount > 0) {
            betFactory.transferInternalUsdc(address(this), feeCollector, platformFeeAmount, "Platform fee");
        }
    }
    
    function refundAll() internal {
        fundsDistributed = true;
    }
    
    // === INDIVIDUAL CLAIMING FUNCTIONS ===
    
    function claimWinnings() external nonReentrant {
        require(_currentStatus == Status.COMPLETED, "Bet not completed");
        require(fundsDistributed, "Winnings not yet distributed");
        
        Participant storage participant = participants[msg.sender];
        require(!participant.hasWithdrawn, "Already withdrawn");
        
        uint256 participantWinningStake = 0;
        if (winningSide == Side.YES) {
            participantWinningStake = participant.yesStake;
        } else if (winningSide == Side.NO) {
            participantWinningStake = participant.noStake;
        }
        
        require(participantWinningStake > 0, "Not a winner or no stake");
        
        uint256 totalStake = totalYesStake + totalNoStake;
        uint256 voterRewardAmount = (totalStake * details.voterRewardPercentage) / 100;
        uint256 platformFeeAmount = (totalStake * details.platformFeePercentage) / 100;
        uint256 netWinningsPool = totalStake - voterRewardAmount - platformFeeAmount;
        
        uint256 winningStake = (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        
        uint256 participantPayout = 0;
        if (winningStake > 0) {
            participantPayout = (netWinningsPool * participantWinningStake) / winningStake;
        }
        
        participant.hasWithdrawn = true;
        
        betFactory.transferInternalUsdc(address(this), msg.sender, participantPayout, "Bet winnings");
        
        emit FundsWithdrawn(msg.sender, participantPayout, 0);
    }
    
    function claimVoterRewards() external nonReentrant {
        require(_currentStatus == Status.COMPLETED || _currentStatus == Status.CANCELLED, "Bet not finished");
        require(voted[msg.sender], "Did not vote");
        require(voterStakesProof[msg.sender] > 0, "No stake to claim");
        
        uint256 originalProofStakeAmount = voterStakesProof[msg.sender];
        uint256 proofStakeToReturn = 0;
        uint256 usdcReward = 0;

        voterStakesProof[msg.sender] = 0;
        
        if (_currentStatus == Status.COMPLETED) {
            bool votedCorrectly = (votes[msg.sender] == winningSide);
            
            if (votedCorrectly) {
                proofStakeToReturn = originalProofStakeAmount;
                uint256 totalVoterRewardPool = ((totalYesStake + totalNoStake) * details.voterRewardPercentage) / 100; 
                
                if (totalVoteStakeProof > 0) {
                    usdcReward = (totalVoterRewardPool * originalProofStakeAmount) / totalVoteStakeProof;
                }
            }
        } else {
            proofStakeToReturn = originalProofStakeAmount;
        }
        
        if (proofStakeToReturn > 0) {
            betFactory.transferInternalProof(address(this), msg.sender, proofStakeToReturn, "Vote stake return");
        }
        if (usdcReward > 0) {
            betFactory.transferInternalUsdc(address(this), msg.sender, usdcReward, "Voter reward");
        }
        
        emit FundsWithdrawn(msg.sender, usdcReward, proofStakeToReturn);
    }
    
    function claimRefund() external nonReentrant {
        require(_currentStatus == Status.CANCELLED, "Bet not cancelled");
        
        Participant storage participant = participants[msg.sender];
        require(!participant.hasWithdrawn, "Already withdrawn");
        
        uint256 totalRefund = participant.yesStake + participant.noStake;
        require(totalRefund > 0, "No stake to refund");
        
        participant.hasWithdrawn = true;
        
        betFactory.transferInternalUsdc(address(this), msg.sender, totalRefund, "Bet refund");
        
        emit FundsWithdrawn(msg.sender, totalRefund, 0);
    }
}`
    },
    {
      name: "TokenVesting.sol",
      description: "A standard token vesting contract to enforce lock-up periods for team and investor tokens.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period.
 * Tokens get released linearly.
 */
contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint64 cliff;
        uint64 start;
        uint64 duration;
        uint256 totalAmount;
        uint256 released;
    }

    // ERC20 token being vested
    IERC20 public immutable token;

    // Mapping from beneficiary to their vesting schedule
    mapping(address => VestingSchedule) private _vestingSchedules;
    
    // Array of all beneficiaries
    address[] private _beneficiaries;

    event Released(address indexed beneficiary, uint255 amount);
    event VestingScheduleCreated(address indexed beneficiary, uint255 amount, uint64 start, uint64 cliff, uint64 duration);

    /**
     * @dev Creates a vesting contract.
     * @param token_ The address of the ERC20 token to be vested.
     */
    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "Token address cannot be zero");
        token = IERC20(token_);
    }

    /**
     * @dev Adds a new vesting schedule for a beneficiary.
     * @param beneficiary_ The address of the beneficiary.
     * @param start_ The timestamp when the vesting begins.
     * @param cliff_ The duration in seconds of the cliff period.
     * @param duration_ The duration in seconds of the entire vesting period.
     * @param totalAmount_ The total amount of tokens to be vested.
     */
    function createVestingSchedule(
        address beneficiary_,
        uint64 start_,
        uint64 cliff_,
        uint64 duration_,
        uint256 totalAmount_
    ) external onlyOwner {
        require(!_vestingSchedules[beneficiary_].initialized, "Beneficiary already has a schedule");
        require(totalAmount_ > 0, "Amount must be greater than 0");
        require(duration_ > 0, "Duration must be greater than 0");
        require(cliff_ <= duration_, "Cliff cannot be longer than duration");
        
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= totalAmount_, "Insufficient tokens in contract to create schedule");

        _vestingSchedules[beneficiary_] = VestingSchedule({
            initialized: true,
            beneficiary: beneficiary_,
            cliff: start_ + cliff_,
            start: start_,
            duration: duration_,
            totalAmount: totalAmount_,
            released: 0
        });

        _beneficiaries.push(beneficiary_);
        emit VestingScheduleCreated(beneficiary_, uint255(totalAmount_), start_, cliff_, duration_);
    }

    /**
     * @dev Releases the vested tokens for a specific beneficiary.
     * @param beneficiary_ The address of the beneficiary.
     */
    function release(address beneficiary_) external nonReentrant {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        require(schedule.initialized, "No vesting schedule for this beneficiary");
        
        uint256 vestedAmount = _vestedAmount(beneficiary_);
        uint256 releasableAmount = vestedAmount - schedule.released;

        require(releasableAmount > 0, "No tokens to release");

        schedule.released += releasableAmount;

        token.safeTransfer(beneficiary_, releasableAmount);
        emit Released(beneficiary_, uint255(releasableAmount));
    }
    
    /**
     * @dev Calculates the amount of tokens that have vested for a beneficiary.
     */
    function _vestedAmount(address beneficiary_) internal view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        if (!schedule.initialized) {
            return 0;
        }
        if (block.timestamp < schedule.cliff) {
            return 0;
        }
        if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount;
        }
        // Ensure duration is not zero to prevent division by zero, although createVestingSchedule should prevent this.
        if (schedule.duration == 0) {
            return 0; 
        }
        return (schedule.totalAmount * (block.timestamp - schedule.start)) / schedule.duration;
    }
    
    // --- View Functions ---
    
    function getVestingSchedule(address beneficiary_) public view returns (VestingSchedule memory) {
        return _vestingSchedules[beneficiary_];
    }
    
    function getReleasableAmount(address beneficiary_) public view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        if (!schedule.initialized) {
            return 0;
        }
        return _vestedAmount(beneficiary_) - schedule.released;
    }
    
    function getAllBeneficiaries() public view returns (address[] memory) {
        return _beneficiaries;
    }
}`
    },
    {
      name: "Deployment Instructions",
      description: "Setup guide for deploying with Hardhat Ignition, now supporting the internal wallet system.",
      code: `// --- SETUP INSTRUCTIONS ---
//
// 1. INSTALL HARDHAT IGNITION:
// Hardhat Ignition is the modern, robust system for deployments.
// Run this command in your project's terminal:
//
// npm install --save-dev @nomicfoundation/hardhat-ignition-ethers
//
// (Make sure you've already installed @nomicfoundation/hardhat-toolbox as well)
//
// 2. CONFIGURE HARDHAT (hardhat.config.ts):
// Your config file needs to be set up correctly with the optimizer.
/*
  import { HardhatUserConfig } from "hardhat/config";
  import "@nomicfoundation/hardhat-toolbox"; 

  const config: HardhatUserConfig = {
    solidity: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: true, // Crucial for large contracts like Bet.sol
      },
    },
  };

  export default config;
*/
// 3. CREATE THE IGNITION MODULE:
// Create a file at 'ignition/modules/ProofBetModule.ts' in your local project
// and copy the code from the 'ignition/modules/ProofBetModule.ts' card below.

// --- DEPLOYMENT COMMANDS ---
//
// **IMPORTANT**: Before running any deployment command, make sure your terminal is
// in the root directory of your project (the folder containing hardhat.config.ts).
//
// To deploy to the LOCAL Hardhat network (automatically deploys a MockUSDC):
//
//    npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network localhost --parameters '{"useLocalUSDC": true, "maxActiveBets": 5}'
//
// To deploy to a LIVE network (e.g., Sepolia):
// The module is pre-configured to use the Sepolia USDC address.
//
//    npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network sepolia --parameters '{"maxActiveBets": 5}'
//
// (Ensure your hardhat.config.ts has a configured 'sepolia' network)
`
    },
    {
      name: "ignition/modules/ProofBetModule.ts",
      description: "Hardhat Ignition module. Updated to include the max active bets parameter.",
      code: `import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// This module is designed to be network-aware.
// On local networks (hardhat/localhost), it deploys a MockUSDC contract.
// On other networks (like Sepolia or mainnet), it uses a pre-configured address.
const ProofBetModule = buildModule("ProofBetModule", (m) => {
  // --- Get Deployer ---
  const deployer = m.getAccount(0);

  // --- Network-Specific USDC Configuration ---
  // Use Ignition parameters to control USDC address
  // For local deployment: npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network localhost --parameters '{"useLocalUSDC": true, "maxActiveBets": 5}'
  // For testnet: npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network sepolia --parameters '{"maxActiveBets": 5}'
  const useLocalUSDC = m.getParameter("useLocalUSDC", false);
  const SEPOLIA_USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7a9c";

  let usdcAddress;

  if (useLocalUSDC) {
    // For local testing, deploy a mock ERC20 token and mint some to the deployer (and factory if needed).
    const mockUsdc = m.contract("MockERC20", ["Mock USDC", "mUSDC"]);
    usdcAddress = mockUsdc;

    // Mint 10,000 mock USDC to the deployer (USDC has 6 decimals)
    m.call(mockUsdc, "mint", [deployer, "10000000000"]); // 10,000 * 10^6
  } else {
    // For live networks, use the official USDC contract address.
    // We create a contract "from" an existing address.
    usdcAddress = m.contractAt("IERC20", SEPOLIA_USDC_ADDRESS);
  }

  // --- Deployment Parameters ---
  const BET_CREATION_FEE = m.getParameter(
    "creationFee",
    "100000000000000000000" // 100 PROOF
  );
  const VOTE_STAKE_AMOUNT = m.getParameter(
    "voteStake",
    "10000000000000000000" // 10 PROOF
  );
  // Parameter for max active bets
  const MAX_ACTIVE_BETS = m.getParameter(
    "maxActiveBets",
    5 // Default to 5
  );

  // --- 1. Deploy Core Contracts (with dependencies handled by Ignition) ---
  const proofToken = m.contract("ProofToken");
  const trustScore = m.contract("TrustScore");

  // --- 2. Deploy BetFactory ---
  // Ignition automatically resolves the addresses from the 'proofToken', 'trustScore',
  // and 'usdcAddress' contract futures.
  const betFactory = m.contract("BetFactory", [
    trustScore,
    usdcAddress,
    proofToken,
    deployer, // Fee collector address
    BET_CREATION_FEE,
    VOTE_STAKE_AMOUNT,
    MAX_ACTIVE_BETS,
  ]);
  
  // --- 3. Deploy TokenVesting ---
  const tokenVesting = m.contract("TokenVesting", [proofToken]);

  // --- 4. Post-Deployment Authorizations ---
  // The owner (deployer) authorizes BetFactory to update trust scores.
  m.call(trustScore, "authorizeContract", [betFactory, true]);
  
  // The owner (deployer) authorizes BetFactory to burn PROOF tokens.
  // This was moved from the BetFactory constructor to here for correctness.
  m.call(proofToken, "authorizeBurner", [betFactory, true]);

  // --- Return Deployed Contract Addresses ---
  // These can be accessed after deployment for verification.
  return { proofToken, trustScore, betFactory, tokenVesting, usdcAddress };
});

export default ProofBetModule;`
    },
    {
      name: "Alternative: Simple TokenVesting.sol",
      description: "Simplified version without OpenZeppelin dependencies for debugging.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleTokenVesting
 * @dev A minimal token vesting contract for debugging purposes
 */
contract TokenVesting {
    address public owner;
    address public token;
    
    constructor(address _token) {
        owner = msg.sender;
        token = _token;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // Placeholder functions - implement full vesting logic later
    function createVestingSchedule(address beneficiary, uint64 start, uint64 cliff, uint64 duration, uint256 amount) external onlyOwner {
        // Minimal implementation for testing
    }
}`
    }
  ];

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gradient-to-r from-cyan-600 to-purple-700 text-white rounded-xl p-8 mb-8">
          <h1 className="text-4xl font-bold mb-4">ProofBet Smart Contracts</h1>
          <p className="text-cyan-100 text-lg leading-relaxed">
            This page contains the complete Solidity source code for the ProofBet protocol. The platform uses a dual-token system with USDC for betting and PROOF tokens for platform fees. Since the current platform doesn't support direct smart contract deployment, you can copy this code for use in standard Web3 development environments like Hardhat or Remix.
          </p>
        </div>
        
        <div className="space-y-8">
          {contracts.map((contract) => (
            <Card key={contract.name} className="bg-white border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl text-gray-900 font-bold">{contract.name}</CardTitle>
                    <p className="text-gray-700 mt-1 text-base">{contract.description}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopy(contract.code)}
                    className="border-gray-300 hover:bg-gray-100 text-gray-700"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-gray-900 text-gray-100 p-6 overflow-x-auto rounded-b-lg">
                  <pre className="text-base leading-relaxed">
                    <code className="language-solidity">{contract.code}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Development Notes</h3>
          <div className="text-blue-800 space-y-2">
            <p>• All contracts are written for Solidity ^0.8.19 and use OpenZeppelin libraries</p>
            <p>• The system now includes an internal wallet system in BetFactory, allowing users to deposit USDC and PROOF tokens once, and then use their internal balances for betting and voting without repeated approvals or token transfers for each action.</p>
            <p>• The system requires USDC token for betting operations (use mainnet address or deploy for testnets)</p>
            <p>• PROOF token handles platform fees with automatic burning mechanism (50% burned, 50% kept)</p>
            <p>• Vote stake amounts are now centralized in the BetFactory contract for consistency</p>
            <p>• BetFactory now includes default percentages for voter rewards and platform fees, which can be configured by the owner.</p>
            <p>• A maximum number of active bets per user can now be configured in the BetFactory, and bets automatically decrement this count upon completion or cancellation.</p>
            <p>• A TokenVesting contract is included to manage locked PROOF tokens for team/investors.</p>
            <p>• Remember to authorize necessary contracts for token operations after deployment</p>
          </div>
        </div>
      </div>
    </div>
  );
}
