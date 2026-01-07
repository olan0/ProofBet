// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Bet.sol";
import "./TrustScore.sol";
import "./ProofToken.sol"; 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "hardhat/console.sol";
/**
 * @title BetFactory
 * @dev Factory for creating and managing Bet contracts.
 * Implements an internal wallet system for USDC and PROOF tokens
 * to optimize user experience by reducing gas and approval steps.
 */
contract BetFactory is Ownable, ReentrancyGuard {
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    ProofToken public proofToken; 
    address public feeCollector;
    address public betImplementation;
    address[] public allBets;
    mapping(address => bool) public isBetFromFactory;

    mapping(address => uint256) public internalUsdcBalance;
    mapping(address => uint256) public internalProofBalance;

    uint256 public creationFeeProof;
    uint256 public voteStakeAmountProof;
    uint8 public defaultVoterRewardPercentage;
    uint8 public defaultPlatformFeePercentage;
    uint256 public maxActiveBetsPerUser;
    mapping(address => uint256) public activeBetsCount;
    mapping(address => uint256) public firstInteraction;
    enum ActivityType {
        NONE,       // no filtering
        CREATOR,    // only bets created by address
        BETTOR,     // only bets where address placed a bet
        VOTER       // only bets where address voted
    }
    // Base duration (in days) used for dynamic creation fee scaling
    uint256 public baseDurationDays = 7;
        // ===== Collateral & Ban System =====
    uint256 public proofCollateralUsdc ;        // Collateral in USDC required from creator
    mapping(address => bool) public bannedCreators;

    event BetCreated(address betAddress, address creator, string title,string description, uint256[3] deadlines);
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
    event BetStatusChanged(address indexed betAddress, uint8 newStatus, string reason);
    event BetVote(address indexed betAddress, address indexed voter, uint8 vote);
    event BetParticipation(address indexed betAddress, address indexed participant, uint8 position, uint256 amountUsdc);

// ======== MODIFIERS ========
modifier onlyAuthorizedBet() {
    require(isBetFromFactory[msg.sender], "Not a Bet");
    _;
}
    constructor(
        address _trustScore,
        address _usdcToken,
        address _proofToken,
        address _feeCollector,
        uint256 _creationFeeProof,
        uint256 _proofCollateralUsdc,
        uint256 _initialVoteStakeAmountProof,
        uint256 _maxActiveBets,
        address _betImplementation
    )
        Ownable(msg.sender)
    {
        require(_trustScore != address(0), "Zero trustScore");
        require(_usdcToken != address(0), "Zero USDC");
        require(_proofToken != address(0), "Zero PROOF");
        require(_feeCollector != address(0), "Zero feeCollector");
        require(_initialVoteStakeAmountProof > 0, "Vote stake must be > 0");
        require(_proofCollateralUsdc > 0, "Creator stake mast be  > 0");
        require(_betImplementation != address(0), "Zero betImplementation");

        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = ProofToken(_proofToken);
        feeCollector = _feeCollector;
        creationFeeProof = _creationFeeProof;
        voteStakeAmountProof = _initialVoteStakeAmountProof;
        maxActiveBetsPerUser = _maxActiveBets;
        betImplementation = _betImplementation;
        defaultVoterRewardPercentage = 5;  
        defaultPlatformFeePercentage  = 3;  
        proofCollateralUsdc = _proofCollateralUsdc;
    }

    // ========= Internal wallet =========

    function depositUsdc(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");
        if (firstInteraction[msg.sender] == 0) firstInteraction[msg.sender] = block.timestamp;
        internalUsdcBalance[msg.sender] += _amount;
        emit UsdcDeposited(msg.sender, _amount);
    }

    function depositProof(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(proofToken.transferFrom(msg.sender, address(this), _amount), "PROOF transfer failed");
        if (firstInteraction[msg.sender] == 0) firstInteraction[msg.sender] = block.timestamp;
        internalProofBalance[msg.sender] += _amount;
        emit ProofDeposited(msg.sender, _amount);
    }

    function withdrawUsdc(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(internalUsdcBalance[msg.sender] >= _amount, "Insufficient internal USDC");
        unchecked { internalUsdcBalance[msg.sender] -= _amount; }
        require(usdcToken.transfer(msg.sender, _amount), "USDC transfer failed");
        emit UsdcWithdrawn(msg.sender, _amount);
    }

    function withdrawProof(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(internalProofBalance[msg.sender] >= _amount, "Insufficient internal PROOF");
        unchecked { internalProofBalance[msg.sender] -= _amount; }
        require(proofToken.transfer(msg.sender, _amount), "PROOF transfer failed");
        emit ProofWithdrawn(msg.sender, _amount);
        
    }

    function transferInternalUsdc(address _from, address _to, uint256 _amount, string memory _reason)
    public
    
    {
        console.log("transferInternalUsdc called by:", msg.sender);
        require(isBetFromFactory[msg.sender], "Only factory bets");
        console.log("Testing transferInternalUsdc from:" , _from);
        require(internalUsdcBalance[_from] >= _amount, "Insufficient internal USDC");
        unchecked { internalUsdcBalance[_from] -= _amount; internalUsdcBalance[_to] += _amount; }
        emit InternalTransfer(_from, _to, _amount, 0, _reason);
    }

    function transferInternalProof(address _from, address _to, uint256 _amount, string memory _reason)
    public 
    
    {
        require(isBetFromFactory[msg.sender], "Only factory bets");
        require(internalProofBalance[_from] >= _amount, "Insufficient internal PROOF");
        unchecked { internalProofBalance[_from] -= _amount; internalProofBalance[_to] += _amount; }
        emit InternalTransfer(_from, _to, 0, _amount, _reason);
    }

    function getInternalBalances(address _user)
        external
        view
        returns (uint256 usdcBalance, uint256 proofBalance)
    {
        return (internalUsdcBalance[_user], internalProofBalance[_user]);
    }

    // ========= Bet creation =========

    function createBet(Bet.BetDetails memory _details)
        external
        nonReentrant
        returns (address)
    {
        uint256 dynamicFee = calculateDynamicCreationFee(_details);
        require(internalProofBalance[msg.sender] >= dynamicFee, "Insufficient PROOF");
        require(activeBetsCount[msg.sender] < maxActiveBetsPerUser, "Too many active bets");
        require(!bannedCreators[msg.sender], "Creator is banned");
        require(internalUsdcBalance[msg.sender] >= proofCollateralUsdc, "Insufficient collateral");
        console.log("Creating bet with dynamic fee: ", dynamicFee);
        unchecked { internalProofBalance[msg.sender] -= dynamicFee; }

        uint256 burnAmount = (dynamicFee * proofToken.feeBurnPercentage()) / 100;
        uint256 keepAmount = dynamicFee - burnAmount;

        if (burnAmount > 0) proofToken.burn(burnAmount);
        if (keepAmount > 0) require(proofToken.transfer(feeCollector, keepAmount), "PROOF fee transfer failed");

        emit FeeProcessed(msg.sender, dynamicFee, burnAmount, keepAmount);
        // Clone a new Bet proxy from implementation
        address newBetAddress = Clones.clone(betImplementation);
        if (proofCollateralUsdc > 0) {
             unchecked { 
                internalUsdcBalance[msg.sender] -= proofCollateralUsdc; 
                internalUsdcBalance[newBetAddress]  += proofCollateralUsdc;
             }
             emit InternalTransfer(msg.sender, address(0), proofCollateralUsdc, 0, "Bet creation collateral");
        }

      /*  Bet newBet = new Bet(
            _details,
            msg.sender,
            address(this),
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken),
            feeCollector
        );

        address newBetAddress = address(newBet);*/
        
      
        isBetFromFactory[newBetAddress] = true;
        // Initialize the cloned Bet contract
        Bet(newBetAddress).initialize(
            _details,
            msg.sender,
            address(this),
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken)
        );
        
        allBets.push(newBetAddress);
         activeBetsCount[msg.sender]++;
        
        trustScoreContract.logBetCreation(msg.sender);
        emit BetCreated(newBetAddress, msg.sender, _details.title, _details.description, [ _details.bettingDeadline,_details.proofDeadline,_details.votingDeadline]);
        return newBetAddress;
    }

    // ========= Hooks =========

    function factoryLogBetParticipation(address participant,uint8 _position, uint256 _amountUsdc) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        trustScoreContract.logBetParticipation(participant);
        emit BetParticipation(msg.sender, participant, _position, _amountUsdc);

    }

    function factoryLogVote(address voter, uint8 _vote ) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        trustScoreContract.logVote(voter);
        emit BetVote(msg.sender, voter, _vote);
    }

    function factoryLogBetCompletion(address creator,uint8 newStatus) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        if (activeBetsCount[creator] > 0) 
        {
            unchecked {
                 activeBetsCount[creator]--; 
                 }
        }
       emit BetStatusChanged(msg.sender, newStatus, "Bet completed");
    }

    // ========= Dynamic stake logic =========

    function calculateRequiredStake(address voter) public view returns (uint256) {
        uint8 trust = trustScoreContract.getScore(voter);
        uint256 createdAt = firstInteraction[voter] == 0
            ? block.timestamp
            : firstInteraction[voter];
        uint256 ageDays = (block.timestamp - createdAt) / 1 days;
        uint256 baseStake = voteStakeAmountProof;

        int256 rawMult = 300 - int256(uint256(trust) * 2) - int256(ageDays * 3);
        if (rawMult < 100) rawMult = 100;
        uint256 multiplier = uint256(rawMult);
        return (baseStake * multiplier) / 100;
    }

    // ========= Dynamic creation fee logic =========

    function calculateDynamicCreationFee(Bet.BetDetails memory _details)
        public
        view
        returns (uint256)
    {
        uint256 totalDuration = _details.votingDeadline > block.timestamp
            ? _details.votingDeadline - block.timestamp
            : 0;

        uint256 durationDays = totalDuration / 1 days;
        uint256 multiplier;

        if (durationDays < baseDurationDays) multiplier = 100;
        else if (durationDays < 2 * baseDurationDays) multiplier = 150;
        else multiplier = 200;

        return (creationFeeProof * multiplier) / 100;
    }

    function setBaseDurationDays(uint256 _days) external onlyOwner {
        require(_days > 0 && _days <= 30, "Invalid base duration");
        baseDurationDays = _days;
    }

    // ========= Admin =========

    function setCreationFee(uint256 _newFee) external onlyOwner { creationFeeProof = _newFee; }
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

     // Owner can update bet implementation if new logic deployed
   function setBetImplementation(address _implementation) external onlyOwner {
        require(_implementation != address(0), "Invalid implementation");
        betImplementation = _implementation;
    }
// ===== Collateral Config & Ban Control =====

    function setProofCollateralUsdc(uint256 _amount) external onlyOwner {
        proofCollateralUsdc = _amount;
    }

    function banCreator(address _creator) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        bannedCreators[_creator] = true;
    }

    function unbanCreator(address _creator) external onlyOwner {
        bannedCreators[_creator] = false;
    }
    // ========= View helpers =========

    function getBets() external view returns (address[] memory) {
        return allBets;
    }
function getBetsRange(
    uint256 cursor,               // where to start scanning
    uint256 maxScan,              // how many to look at
    Bet.Status statusFilter,      // status filter (NONE for all)
    ActivityType activityFilter,  // activity filter
    address userAddress           // address to filter by (0x0 = ignore)
)
    external
    view
    returns (address[] memory betAddresses, uint256 nextCursor)
{
    uint256 total = allBets.length;
    if (total == 0 || cursor >= total || maxScan == 0) {
        return (new address[](0), cursor);
    }

    address[] memory temp = new address[](maxScan);
    uint256 scanned = 0;
    uint256 matched = 0;

    while (cursor + scanned < total && scanned < maxScan) {
        uint256 virtualIndex = cursor + scanned;
        uint256 idx = total - 1 - virtualIndex;
        address betAddr = allBets[idx];
        Bet bet = Bet(betAddr);

        // Status filtering
        Bet.Status status = bet.currentStatus();
        if (statusFilter != Bet.Status.NONE && status != statusFilter) {
            scanned++;
            continue;
        }

        // Activity filtering
        if (activityFilter != ActivityType.NONE && userAddress != address(0)) {
            bool include = false;

            if (activityFilter == ActivityType.CREATOR && bet.creator() == userAddress)
                include = true;
            else if (activityFilter == ActivityType.BETTOR && bet.hasBettor(userAddress))
                include = true;
            else if (activityFilter == ActivityType.VOTER && bet.hasVoter(userAddress))
                include = true;

            if (!include) {
                scanned++;
                continue;
            }
        }

        temp[matched] = betAddr;
        matched++;
        scanned++;
    }

    nextCursor = cursor + scanned;

    betAddresses = new address[](matched);
    for (uint256 i = 0; i < matched; i++) {
        betAddresses[i] = temp[i];
    }
}




    function getActiveBetCount(address user) external view returns (uint256) {
        return activeBetsCount[user];
    }

    function isBanned(address _user) external view returns (bool) {
        return bannedCreators[_user];
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
    // ======== AUTHORIZED CALLBACK ========
 function notifyBetStatusChange(
     address betAddress,
     uint8 newStatus,
     string calldata reason
 ) external onlyAuthorizedBet {
     emit BetStatusChanged(betAddress, newStatus, reason);
 }
}
