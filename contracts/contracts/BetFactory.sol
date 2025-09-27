// SPDX-License-Identifier: MIT
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
}