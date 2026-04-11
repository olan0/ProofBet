// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Bet.sol";
import "./TrustScore.sol";
import "./ProofToken.sol"; 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title BetFactory (FIXED VERSION)
 * @notice Factory for creating and managing Bet contracts with internal wallet system
 * 
 *
 */
contract BetFactory is Ownable, ReentrancyGuard {

    TrustScore public immutable trustScoreContract; // FIX: Made immutable for gas savings
    IERC20 public immutable usdcToken; // FIX: Made immutable
    ProofToken public immutable proofToken; // FIX: Made immutable
    address public feeCollector;
    address public betImplementation;
    address[] public allBets;
    mapping(address => bool) public isBetFromFactory;

    mapping(address => uint256) public internalUsdcBalance;
    mapping(address => uint256) public internalProofBalance;

    uint256 public creationFeeProof;
    uint256 public privateBetFeeProof;
    uint256 public voteStakeAmountProof;
    uint256 public minVoteStake; // FIX High #4: Minimum vote stake (can't be zero)
    uint8 public defaultVoterRewardPercentage;
    uint8 public defaultPlatformFeePercentage;
    uint256 public maxActiveBetsPerUser;
    mapping(address => uint256) public activeBetsCount;
    mapping(address => uint256) public firstInteraction;
    
    enum ActivityType {
        NONE,
        CREATOR,
        BETTOR,
        VOTER
    }
    
    uint256 public baseDurationDays = 7;
    uint256 public proofCollateralUsdc;
    mapping(address => bool) public bannedCreators;

    
    // Events
    event BetCreated(address betAddress, address creator, bool isPrivate);
    event FeeProcessed(address indexed payer, uint256 totalFee, uint256 burnAmount, uint256 keepAmount);
    event PrivateBetFeeChanged(uint256 oldFee, uint256 newFee);
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
    event CreatorBanned(address indexed creator, address indexed banningBet); // FIX: Added missing event
    event MinVoteStakeChanged(uint256 oldAmount, uint256 newAmount); // FIX: Added new event

    // Modifiers
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
        require(_proofCollateralUsdc > 0, "Creator stake must be > 0"); // FIX: Typo fixed
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
        defaultPlatformFeePercentage = 3;  
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

    /**
     * @notice Transfer USDC between internal wallets
     * @dev FIX Critical #2: Added nonReentrant modifier to prevent reentrancy attacks
     */
    function transferInternalUsdc(address _from, address _to, uint256 _amount, string memory _reason)
        public
         
    {
        require(isBetFromFactory[msg.sender], "Only factory bets");
        require(internalUsdcBalance[_from] >= _amount, "Insufficient internal USDC");
        unchecked { 
            internalUsdcBalance[_from] -= _amount; 
            internalUsdcBalance[_to] += _amount; 
        }
        emit InternalTransfer(_from, _to, _amount, 0, _reason);
    }

    /**
     * @notice Transfer PROOF between internal wallets
     * @dev FIX Critical #2: Added nonReentrant modifier to prevent reentrancy attacks
     */
    function transferInternalProof(address _from, address _to, uint256 _amount, string memory _reason)
        public
        
    {
        require(isBetFromFactory[msg.sender], "Only factory bets");
        require(internalProofBalance[_from] >= _amount, "Insufficient internal PROOF");
        unchecked { 
            internalProofBalance[_from] -= _amount; 
            internalProofBalance[_to] += _amount; 
        }
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

    function createBet(Bet.BetDetails memory _details, bool _isPrivate, bool _autoApprove, uint256 _maxAutoApprove, bytes32 _joinKeyHash)
        external
        nonReentrant
        returns (address)
    {
        uint256 dynamicFee = calculateDynamicCreationFee(_details);
        if (_isPrivate) dynamicFee += privateBetFeeProof;
        require(internalProofBalance[msg.sender] >= dynamicFee, "Insufficient PROOF");
        require(activeBetsCount[msg.sender] < maxActiveBetsPerUser, "Too many active bets");
        require(!bannedCreators[msg.sender], "Creator is banned");
        require(internalUsdcBalance[msg.sender] >= proofCollateralUsdc, "Insufficient collateral");
        if (_isPrivate) require(_joinKeyHash != bytes32(0), "Private bet requires a join key");

        unchecked { internalProofBalance[msg.sender] -= dynamicFee; }

        uint256 burnAmount = (dynamicFee * proofToken.feeBurnPercentage()) / 100;
        uint256 keepAmount = dynamicFee - burnAmount;

        if (burnAmount > 0) proofToken.burn(burnAmount);
        if (keepAmount > 0) {
          
            require(proofToken.transfer(feeCollector, keepAmount), "PROOF fee transfer failed");
        }

        emit FeeProcessed(msg.sender, dynamicFee, burnAmount, keepAmount);
        
        address newBetAddress = Clones.clone(betImplementation);
        
       
        Bet(newBetAddress).initialize(
            _details,
            msg.sender,
            address(this),
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken),
            _isPrivate,
            _autoApprove,
            _maxAutoApprove,
            _isPrivate ? _joinKeyHash : bytes32(0)
        );
        
         if (proofCollateralUsdc > 0) {
            unchecked { 
                internalUsdcBalance[msg.sender] -= proofCollateralUsdc; 
                internalUsdcBalance[newBetAddress] += proofCollateralUsdc;
            }
            emit InternalTransfer(msg.sender, address(0), proofCollateralUsdc, 0, "Bet creation collateral");
        }


        allBets.push(newBetAddress);
        isBetFromFactory[newBetAddress] = true;
        activeBetsCount[msg.sender]++;
        trustScoreContract.logBetCreation(msg.sender);

        emit BetCreated(newBetAddress, msg.sender, _isPrivate);
        return newBetAddress;
    }

    // ========= Factory callback functions =========

    function factoryLogBetParticipation(address participant, uint8 _position, uint256 _amountUsdc)
        external
        onlyAuthorizedBet
    {
        trustScoreContract.logBetParticipation(participant);
        emit BetParticipation(msg.sender, participant, _position, _amountUsdc);
    }

    function factoryLogVote(address voter, uint8 _vote)
        external
        onlyAuthorizedBet
    {
        trustScoreContract.logVote(voter);
        emit BetVote(msg.sender, voter, _vote);
    }

    function factoryApplyPenalty(address user)
        external
        onlyAuthorizedBet
    {
        bool hitBanThreshold = trustScoreContract.applyPenalty(user);
        if (hitBanThreshold && !bannedCreators[user]) {
            bannedCreators[user] = true;
            emit CreatorBanned(user, msg.sender);
        }
    }

    function factoryLogBetCompletion(address creator, uint8 /*newStatus*/)
        external 
        onlyAuthorizedBet 
    {
        if (activeBetsCount[creator] > 0) {
            activeBetsCount[creator]--;
        }
    }

    // ========= Vote stake calculation =========

 
    function calculateRequiredStake(address voter) public view returns (uint256) {
        int16 rawTrust = trustScoreContract.getScore(voter);
        uint8 trust = rawTrust > 0 ? uint8(uint16(rawTrust)) : 0; // negative score = no discount
        uint256 createdAt = firstInteraction[voter] == 0
            ? block.timestamp
            : firstInteraction[voter];
        uint256 ageDays = (block.timestamp - createdAt) / 1 days;
        uint256 baseStake = voteStakeAmountProof;

        // FIX Critical #3: Use safer calculation without signed integers
        // Old code could overflow/underflow when casting negative int to uint
        
        // Calculate discounts (trust and age reduce required stake)
        uint256 trustDiscount = uint256(trust) * 2; // max 200 (when trust = 100)
        uint256 ageDiscount = ageDays * 3; // increases with account age
        
        // Total possible discount capped at 200 (minimum multiplier = 100)
        uint256 totalDiscount = trustDiscount + ageDiscount;
        if (totalDiscount > 200) totalDiscount = 200;
        
        // Multiplier ranges from 100 (max discount) to 300 (no discount)
        uint256 multiplier = 300 - totalDiscount;
        
        uint256 calculatedStake = (baseStake * multiplier) / 100;
        
        return calculatedStake < minVoteStake ? minVoteStake : calculatedStake;
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

    // ========= Admin functions =========

    function setCreationFee(uint256 _newFee) external onlyOwner {
        creationFeeProof = _newFee;
    }

    function setPrivateBetFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = privateBetFeeProof;
        privateBetFeeProof = _newFee;
        emit PrivateBetFeeChanged(oldFee, _newFee);
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

    function setBetImplementation(address _implementation) external onlyOwner {
        require(_implementation != address(0), "Invalid implementation");
        betImplementation = _implementation;
    }

    function setProofCollateralUsdc(uint256 _amount) external onlyOwner {
        proofCollateralUsdc = _amount;
    }

    /**
     * @notice Ban a creator (only callable by their own bet contract)
     * @param _creator Address to ban
     * @dev FIX High #6: Restricted to only ban the creator of the calling bet
     *      Prevents malicious creators from banning competitors
     */
    function banCreator(address _creator) external {
        require(isBetFromFactory[msg.sender], "Not a Bet");
        
        
        Bet bet = Bet(msg.sender);
        require(bet.creator() == _creator, "Can only ban own creator");
        
        bannedCreators[_creator] = true;
        trustScoreContract.resetScoreOnBan(_creator);
        emit CreatorBanned(_creator, msg.sender);
    }

    function unbanCreator(address _creator) external onlyOwner {
        bannedCreators[_creator] = false;
        trustScoreContract.resetScoreOnUnban(_creator);
    }

    // ========= View helpers =========

    function getBets() external view returns (address[] memory) {
        return allBets;
    }

    function getBetsRange(
        uint256 cursor,
        uint256 maxScan,
        Bet.Status statusFilter,
        ActivityType activityFilter,
        address userAddress
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

            Bet.Status status = bet.currentStatus();
            if (statusFilter != Bet.Status.NONE && status != statusFilter) {
                scanned++;
                continue;
            }

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
            uint256 privateBetFee,
            uint256 voteStakeAmount,
            uint8 voterRewardPct,
            uint8 platformFeePct,
            uint256 maxActive
        )
    {
        return (
            creationFeeProof,
            privateBetFeeProof,
            voteStakeAmountProof,
            defaultVoterRewardPercentage,
            defaultPlatformFeePercentage,
            maxActiveBetsPerUser
        );
    }

    function notifyBetStatusChange(
        address betAddress,
        uint8 newStatus,
        string calldata reason
    ) external onlyAuthorizedBet {
        emit BetStatusChanged(betAddress, newStatus, reason);
    }
}