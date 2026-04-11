// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface ITrustScore {
    function getScore(address user) external view returns (int16);
}

interface IBetFactory {
    function getInternalBalances(address user) external view returns (uint256 usdc, uint256 proof);
    function transferInternalUsdc(address _from, address _to, uint256 _amount, string memory _reason) external;
    function transferInternalProof(address _from, address _to, uint256 _amount, string memory _reason) external;
    function defaultPlatformFeePercentage() external view returns (uint256);
    function defaultVoterRewardPercentage() external view returns (uint256);
    function feeCollector() external view returns (address);
    function calculateRequiredStake(address voter) external view returns (uint256);
    function factoryLogBetParticipation(address participant,uint8 _position, uint256 _amountUsdc) external;
    function factoryLogVote(address voter, uint8 _vote ) external;
    function factoryLogBetCompletion(address creator,uint8 newStatus) external;
    function factoryApplyPenalty(address user) external;
    function banCreator(address creator) external;
    function proofCollateralUsdc() external view returns (uint256);
    function notifyBetStatusChange(address betAddress,uint8 newStatus,string calldata reason) external;
   
}

contract Bet is ReentrancyGuard, Pausable {
    enum Category {  
        UNKNOWN,
        CRYPTO,
        SPORTS,
        POLITICS,
        FINANCE,
        ENTERTAINMENT,
        PERSONAL,
        OTHER
    }

    enum ProofType {
        UNKNOWN,
        VIDEO,
        LIVESTREAM,
        DOCUMENT,
        ORACLE,
        OTHER
    }

    enum Status { OPEN_FOR_BETS, AWAITING_PROOF, VOTING, COMPLETED, CANCELLED, NONE}
    enum Side { NONE, YES, NO, INVALID }
    enum CancelReason { NONE, MIN_SIDE_STAKE, NO_PROOF, INSUFFICIENT_VOTES, TIE, VOTE_INVALID }

    struct BetDetails {
        string title;
        string description;
        uint256 bettingDeadline;
        uint256 proofDeadline;
        uint256 votingDeadline;
        uint256 minimumBetAmount;
        uint256 minimumSideStake;
        uint8 minimumTrustScore;
        uint256 minimumVotes;
        Category category;
        ProofType proofType;
    }

    struct Participant {
        uint256 yesStake;
        uint256 noStake;
        bool claimed;
    }

    struct VoterInfo {
        Side vote;
        uint256 stakeProof;
        bool claimed;
    }

    struct ResolutionInfo {
        Status status;
        CancelReason reason;
        Side outcome;
        uint256 yesStake;
        uint256 noStake;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 invalidVotes;
        uint256 creatorCollateralSnap;
        uint256 platformFeeUsdc;
        uint256 voterRewardPoolUsdc;
        uint256 bettorBonusPoolUsdc;
        uint256 forfeitProof;
        uint256 totalWinnerProof;
    }

    // ======== STORAGE ========
    BetDetails public details;
    address public creator;

    IBetFactory public betFactory;
    ITrustScore public trustScoreContract;
    IERC20 public usdcToken;
    IERC20 public proofToken;

    Status private _status;
    CancelReason public cancelReason;

    // ======== PRIVATE BET ========
    bool public isPrivate;
    bool public acceptingParticipants; // creator can close the bet to new participants
    bool public autoApprove;          // auto-approve join requests (after key verification)
    uint256 public maxAutoApprove;    // 0 = unlimited
    uint256 public autoApprovedCount;
    bytes32 public joinKeyHash;       // keccak256 of join key; always required for private bets
    mapping(address => bool) public isRegistered;
    mapping(address => bool) public joinRequested;
    mapping(address => bool) public joinApproved;
    mapping(address => bool) public joinBlacklisted; // rejected addresses cannot re-request

    uint256 public totalYesStake;
    uint256 public totalNoStake;
    uint256 public participantsCount;

    uint256 public yesVotes;
    uint256 public noVotes;
    uint256 public invalidVotes;
    uint256 public totalVotes;

    uint256 public totalYesProofStake;
    uint256 public totalNoProofStake;
    uint256 public totalInvalidProofStake;

    string public proofUrl;
    Side public outcomeSide;
    uint256 public creatorCollateral;

    mapping(address => Participant) public participants;
    mapping(address => VoterInfo) public voters;

    // ======== SNAPSHOTS ========
    bool public snapshotted;
    uint256 public snapTotalYesStake;
    uint256 public snapTotalNoStake;
    uint256 public snapTotalYesProofStake;
    uint256 public snapTotalNoProofStake;
    uint256 public snapTotalInvalidProofStake;
    uint256 public snapCreatorCollateral;
    uint256 public snapPlatformFeeUsdc;
    uint256 public snapVoterRewardPoolUsdc;
    uint256 public snapNetLosingPoolUsdc;
    uint256 public snapWinningBettorTotalStake;
    uint256 public snapBettorRefundBonusPoolUsdc;
    uint256 public snapInvalidVoterBonusPoolUsdc;
    uint256 public snapInvalidWinningVoterTotalStakeProof;
    uint256 public snapInvalidLosingVoterTotalStakeProof;
    uint256 public snaptotalWinnerProof;

    // ======== EVENTS ========
    event BetPlaced(address indexed user, Side position, uint256 amountUsdc);
    event ProofSubmitted(address indexed creator, string proofUrl);
    event VoteCast(address indexed voter, Side vote, uint256 amountProof);
    event StatusChanged(Status newStatus, CancelReason reason, Side outcomeSide);
    event BettorClaimed(address indexed user, uint256 usdcAmount);
    event VoterClaimed(address indexed user, uint256 usdcAmount, uint256 proofAmount);
    event BettingClosed(uint256 timestamp); // FIX: Added missing event
    event VotingClosed(uint256 timestamp); // FIX: Added missing event
    event JoinRequested(address indexed participant);
    event ParticipantApproved(address indexed participant, bool wasAutoApproved);
    event ParticipantRejected(address indexed participant);
    event AutoApproveChanged(bool enabled, uint256 maxCount);
    event AcceptingParticipantsChanged(bool accepting);

    // ======== CONSTANTS ========
    uint256 private constant MAX_DEADLINE_DURATION = 365 days; // FIX: Max bet duration

    // ======== INIT ========
    bool private initialized;

    modifier onlyAccessible() {
        if (isPrivate) {
            require(
                isRegistered[msg.sender] || msg.sender == creator,
                "Private bet: not on participant list"
            );
        }
        _;
    }

    function initialize(
        BetDetails memory _details,
        address _creator,
        address _betFactory,
        address _trustScore,
        address _usdcToken,
        address _proofToken,
        bool _isPrivate,
        bool _autoApprove,
        uint256 _maxAutoApprove,
        bytes32 _joinKeyHash
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;

        require(_creator != address(0) && _betFactory != address(0) && _trustScore != address(0), "Zero address");
        require(msg.sender == _betFactory, "Only factory can initialize");
        require(_details.category != Category.UNKNOWN, "Invalid category");
        require(_details.proofType != ProofType.UNKNOWN, "Invalid proof type");
        require(bytes(_details.title).length > 0, "Empty title");
        require(bytes(_details.title).length <= 200, "Title too long");
        require(_details.minimumBetAmount > 0, "Min bet must be > 0");
        require(_details.minimumSideStake > 0, "Min side stake must be > 0");
        require(_details.minimumVotes > 0, "Min votes must be > 0");

        // FIX Critical #4: Validate deadlines are in the FUTURE
        require(_details.bettingDeadline > block.timestamp, "Betting deadline must be future");
        require(_details.bettingDeadline < _details.proofDeadline, "Proof must be after betting");
        require(_details.proofDeadline < _details.votingDeadline, "Voting must be after proof");

        // FIX: Add maximum duration limit to prevent griefing
        require(_details.votingDeadline <= block.timestamp + MAX_DEADLINE_DURATION, "Max 1 year duration");

        // FIX: Minimum time between phases (prevents instant resolution)
        require(_details.proofDeadline >= _details.bettingDeadline + 1 hours, "Proof phase too short");
        require(_details.votingDeadline >= _details.proofDeadline + 1 hours, "Voting phase too short");

        details = _details;
        creator = _creator;
        betFactory = IBetFactory(_betFactory);
        trustScoreContract = ITrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken);
        if (_isPrivate) require(_joinKeyHash != bytes32(0), "Private bet requires a join key");
        isPrivate = _isPrivate;
        acceptingParticipants = true;
        autoApprove = _autoApprove;
        maxAutoApprove = _maxAutoApprove;
        joinKeyHash = _joinKeyHash;

        _status = Status.OPEN_FOR_BETS;
        cancelReason = CancelReason.NONE;
        outcomeSide = Side.NONE;
       
        creatorCollateral = betFactory.proofCollateralUsdc();
       
       
      
        emit StatusChanged(_status, cancelReason, outcomeSide);
    }

    // ======== PAUSE FUNCTIONS ========
    
    /**
     * @notice Pause the contract (only factory owner)
     * @dev Prevents betting, voting, and proof submission during emergencies
     */
    function pause() external {
        require(msg.sender == address(betFactory), "Only factory");
        _pause();
    }
    
    /**
     * @notice Unpause the contract (only factory owner)
     */
    function unpause() external {
        require(msg.sender == address(betFactory), "Only factory");
        _unpause();
    }

    // ======== PRIVATE BET REGISTRATION ========

    /**
     * @notice Request to join a private bet.
     *
     * A join key is always required. The contract verifies keccak256(key) == joinKeyHash.
     *
     * If autoApprove is enabled (and under cap), the caller is immediately registered.
     * Otherwise the request is queued and the creator must call approveParticipant().
     */
    function requestToJoin(string calldata key) external {
        require(isPrivate, "Not a private bet");
        require(acceptingParticipants, "Creator is not accepting new participants");
        require(msg.sender != creator, "Creator is already a participant");
        require(!isRegistered[msg.sender], "Already registered");
        require(!joinRequested[msg.sender], "Already requested");

        require(!joinBlacklisted[msg.sender], "Your request was rejected");
        // Key is always required for private bets
        require(keccak256(bytes(key)) == joinKeyHash, "Invalid join key");

        joinRequested[msg.sender] = true;
        emit JoinRequested(msg.sender);

        // Auto-approve or queue for manual creator approval
        bool underCap = maxAutoApprove == 0 || autoApprovedCount < maxAutoApprove;
        if (autoApprove && underCap) {
            joinApproved[msg.sender] = true;
            isRegistered[msg.sender] = true;
            autoApprovedCount++;
            emit ParticipantApproved(msg.sender, true);
        }
    }

    /**
     * @notice Creator approves a join request, adding the address to the allowlist.
     */
    function approveParticipant(address participant) external {
        require(msg.sender == creator, "Only creator");
        require(isPrivate, "Not a private bet");
        require(!isRegistered[participant], "Already registered");
        joinApproved[participant] = true;
        joinRequested[participant] = true; // ensure flagged in case of direct approval
        emit ParticipantApproved(participant, false);
    }

    /**
     * @notice Creator rejects a join request.
     */
    function rejectParticipant(address participant) external {
        require(msg.sender == creator, "Only creator");
        require(joinRequested[participant], "No join request");
        joinRequested[participant] = false;
        joinApproved[participant] = false;
        joinBlacklisted[participant] = true;
        emit ParticipantRejected(participant);
    }

    /**
     * @notice Approve multiple pending join requests in one transaction.
     */
    function approveAllParticipants(address[] calldata participants) external {
        require(msg.sender == creator, "Only creator");
        require(isPrivate, "Not a private bet");
        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            if (!isRegistered[p]) {
                joinApproved[p] = true;
                joinRequested[p] = true;
                emit ParticipantApproved(p, false);
            }
        }
    }

    /**
     * @notice Reject and blacklist multiple pending join requests in one transaction.
     */
    function rejectAllParticipants(address[] calldata participants) external {
        require(msg.sender == creator, "Only creator");
        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            if (joinRequested[p]) {
                joinRequested[p] = false;
                joinApproved[p] = false;
                joinBlacklisted[p] = true;
                emit ParticipantRejected(p);
            }
        }
    }

    /**
     * @notice Approved participant finalizes registration.
     *         Not needed when autoApprove registered the caller automatically.
     */
    function register() external {
        require(isPrivate, "Not a private bet");
        require(joinApproved[msg.sender], "Not approved by creator");
        require(!isRegistered[msg.sender], "Already registered");
        isRegistered[msg.sender] = true;
    }

    /**
     * @notice Creator toggles auto-approve mode and optional participant cap.
     * @param _enabled  true = auto-approve new requests; false = manual review
     * @param _maxCount max participants to auto-approve (0 = unlimited)
     */
    function setAutoApprove(bool _enabled, uint256 _maxCount) external {
        require(msg.sender == creator, "Only creator");
        require(isPrivate, "Not a private bet");
        autoApprove = _enabled;
        maxAutoApprove = _maxCount;
        emit AutoApproveChanged(_enabled, _maxCount);
    }

    /**
     * @notice Creator opens or closes the bet to new join requests.
     */
    function setAcceptingParticipants(bool _accepting) external {
        require(msg.sender == creator, "Only creator");
        require(isPrivate, "Not a private bet");
        acceptingParticipants = _accepting;
        emit AcceptingParticipantsChanged(_accepting);
    }

    // ======== VIEW FUNCTIONS ========
    function currentStatus() public view returns (Status) {
        return _status;
    }

    function getBetDetails() external view returns (BetDetails memory) {
        return details;
    }

    function getBetInfo()
        external
        view
        returns (
            string memory title,
            string memory description,
            uint256 totalYes,
            uint256 totalNo,
            uint256 bettingDeadline,
            uint256 proofDeadline,
            uint256 votingDeadline,
            string memory proof,
            uint256 participantsC,
            uint256 votersC
        )
    {
        return (
            details.title,
            details.description,
            totalYesStake,
            totalNoStake,
            details.bettingDeadline,
            details.proofDeadline,
            details.votingDeadline,
            proofUrl,
            participantsCount,
            totalVotes
        );
    }

    function getVoteStats()
        external
        view
        returns (
            uint256 totalYesVotes,
            uint256 totalNoVotes,
            uint256 totalInvalidVotes,
            uint256 totalVoteStake
        )
    {
        return (yesVotes, noVotes, invalidVotes, totalYesProofStake + totalNoProofStake + totalInvalidProofStake);
    }

    // ======== BETTING ========
    
  
    function placeBet(Side position, uint256 amountUsdc) external nonReentrant whenNotPaused onlyAccessible {
        require(_status == Status.OPEN_FOR_BETS, "Invalid status");
        require(block.timestamp < details.bettingDeadline, "Betting closed");
        require(position == Side.YES || position == Side.NO, "Bad side");
        require(amountUsdc >= details.minimumBetAmount, "Stake too low");

        (uint256 uUsdc, ) = betFactory.getInternalBalances(msg.sender);
        if (msg.sender == creator) {
            require(uUsdc >= amountUsdc * 2, "Creator needs extra collateral");
            betFactory.transferInternalUsdc(msg.sender, address(this), amountUsdc * 2, "Creator matching collateral");
            creatorCollateral += amountUsdc;
        } else {
            require(uUsdc >= amountUsdc, "Insufficient USDC");
            betFactory.transferInternalUsdc(msg.sender, address(this), amountUsdc, "Bet placement");
        }

        Participant storage p = participants[msg.sender];
        if (p.yesStake == 0 && p.noStake == 0) {
            participantsCount++;
        }

        if (position == Side.YES) {
            p.yesStake += amountUsdc;
            totalYesStake += amountUsdc;
        } else {
            p.noStake += amountUsdc;
            totalNoStake += amountUsdc;
        }

        betFactory.factoryLogBetParticipation(msg.sender, uint8(position), amountUsdc);
        emit BetPlaced(msg.sender, position, amountUsdc);
    }

 
    function checkAndCloseBetting() external {
        if (_status != Status.OPEN_FOR_BETS) return;
        if (block.timestamp < details.bettingDeadline) return;

        if (totalYesStake >= details.minimumSideStake && totalNoStake >= details.minimumSideStake) {
            _status = Status.AWAITING_PROOF;
            emit BettingClosed(block.timestamp); // FIX: Added event
            emit StatusChanged(_status, CancelReason.NONE, Side.NONE);
            betFactory.notifyBetStatusChange(address(this), uint8(_status), "Betting closed, awaiting proof");
        } else {
            _cancel(CancelReason.MIN_SIDE_STAKE, Side.NONE);
        }
    }

    // ======== PROOF ========
    

    function submitProof(string calldata _proofUrl) external whenNotPaused {
        require(msg.sender == creator, "Not creator");
        require(_status == Status.AWAITING_PROOF, "Invalid status");
        require(block.timestamp >= details.bettingDeadline, "Betting still open");
        require(block.timestamp < details.proofDeadline, "Proof deadline passed");
        
        // FIX High #3: Enhanced proof URL validation
        bytes memory urlBytes = bytes(_proofUrl);
        require(urlBytes.length >= 10, "Proof URL too short");
        require(urlBytes.length <= 500, "Proof URL too long");
        
        // Validate URL scheme (https:// or ipfs://)
        bool validScheme = _isValidUrlScheme(urlBytes);
        require(validScheme, "Invalid URL scheme (use https:// or ipfs://)");

        proofUrl = _proofUrl;
        _status = Status.VOTING;

        emit ProofSubmitted(msg.sender, _proofUrl);
        emit StatusChanged(_status, CancelReason.NONE, Side.NONE);
        betFactory.notifyBetStatusChange(address(this), uint8(_status), "Proof submitted, voting started");
    }
    
    /**
     * @dev Internal helper to validate URL schemes
     * @return true if URL starts with https:// or ipfs://
     */
    function _isValidUrlScheme(bytes memory urlBytes) private pure returns (bool) {
        if (urlBytes.length >= 8) {
            // Check for "https://"
            if (urlBytes[0] == 'h' && urlBytes[1] == 't' && urlBytes[2] == 't' &&
                urlBytes[3] == 'p' && urlBytes[4] == 's' && urlBytes[5] == ':' &&
                urlBytes[6] == '/' && urlBytes[7] == '/') {
                return true;
            }
        }

        if (urlBytes.length >= 7) {
            // Check for "ipfs://"
            if (urlBytes[0] == 'i' && urlBytes[1] == 'p' && urlBytes[2] == 'f' &&
                urlBytes[3] == 's' && urlBytes[4] == ':' && urlBytes[5] == '/' &&
                urlBytes[6] == '/') {
                return true;
            }
        }

        if (urlBytes.length >= 6) {
            // Check for "enc://" — encrypted proof URL for private bets
            if (urlBytes[0] == 'e' && urlBytes[1] == 'n' && urlBytes[2] == 'c' &&
                urlBytes[3] == ':' && urlBytes[4] == '/' && urlBytes[5] == '/') {
                return true;
            }
        }

        return false;
    }

    function checkAndCancelForNoProof() external {
        if (_status != Status.AWAITING_PROOF) return;
        if (block.timestamp < details.proofDeadline) return;

        _cancel(CancelReason.NO_PROOF, Side.NONE);
        betFactory.factoryLogBetCompletion(creator, uint8(_status));
        betFactory.banCreator(creator);
    }

    // ======== VOTING ========
    
  
    function vote(Side v) external nonReentrant whenNotPaused onlyAccessible {
        require(_status == Status.VOTING, "Invalid status");
        require(block.timestamp < details.votingDeadline, "Voting closed");
        require(v == Side.YES || v == Side.NO || v == Side.INVALID, "Bad vote");
        require(msg.sender != creator, "Creator cannot vote");

        Participant memory p = participants[msg.sender];
        require(p.yesStake == 0 && p.noStake == 0, "Bettors cannot vote");

        VoterInfo storage info = voters[msg.sender];
        require(info.vote == Side.NONE, "Already voted");
        require(trustScoreContract.getScore(msg.sender) >= int16(uint16(details.minimumTrustScore)), "Trust too low");

        uint256 stakeAmt = betFactory.calculateRequiredStake(msg.sender);
     
        (, uint256 uProof) = betFactory.getInternalBalances(msg.sender);
        require(uProof >= stakeAmt, "Insufficient PROOF");

        betFactory.transferInternalProof(msg.sender, address(this), stakeAmt, "Vote stake");

        info.vote = v;
        info.stakeProof = stakeAmt;

        if (v == Side.YES) {
            yesVotes++;
            totalYesProofStake += stakeAmt;
        } else if (v == Side.NO) {
            noVotes++;
            totalNoProofStake += stakeAmt;
        } else {
            invalidVotes++;
            totalInvalidProofStake += stakeAmt;
        }
        totalVotes++;
        
        betFactory.factoryLogVote(msg.sender, uint8(v));
        emit VoteCast(msg.sender, v, stakeAmt);
    }

  
    function checkAndResolve() external {
        if (_status != Status.VOTING) return;
        if (block.timestamp < details.votingDeadline) return;

        emit VotingClosed(block.timestamp); 

        if (totalVotes < details.minimumVotes) {
            _cancel(CancelReason.INSUFFICIENT_VOTES, Side.NONE);
            betFactory.factoryLogBetCompletion(creator, uint8(_status));
            return;
        }

        if (invalidVotes > yesVotes && invalidVotes > noVotes) {
            _cancel(CancelReason.VOTE_INVALID, Side.INVALID);
            betFactory.factoryLogBetCompletion(creator, uint8(_status));
            return;
        }

        if (yesVotes > noVotes) {
            _complete(Side.YES);
        } else if (noVotes > yesVotes) {
            _complete(Side.NO);
        } else {
            _cancel(CancelReason.TIE, Side.NONE);
        }

        betFactory.factoryLogBetCompletion(creator, uint8(_status));
    }

    // ======== FINALIZATION ========
    function _complete(Side win) internal {
        _status = Status.COMPLETED;
        cancelReason = CancelReason.NONE;
        outcomeSide = win;
        _snapshot();
        emit StatusChanged(_status, cancelReason, outcomeSide);
        betFactory.notifyBetStatusChange(address(this), uint8(_status), "Bet completed");
    }

    function _cancel(CancelReason reason, Side outcome) internal {
        _status = Status.CANCELLED;
        cancelReason = reason;
        outcomeSide = outcome;
        _snapshot();
        emit StatusChanged(_status, cancelReason, outcomeSide);
        betFactory.notifyBetStatusChange(address(this), uint8(_status), "Bet cancelled");
    }

       function _snapshot() internal {
        if (snapshotted) return;
        snapshotted = true;

        snapTotalYesStake = totalYesStake;
        snapTotalNoStake  = totalNoStake;

        snapTotalYesProofStake = totalYesProofStake;
        snapTotalNoProofStake  = totalNoProofStake;
        snapTotalInvalidProofStake = totalInvalidProofStake;

        snapCreatorCollateral = creatorCollateral;

        // ===== COMPLETED pools =====
        if (_status == Status.COMPLETED) {
            uint256 losing = (outcomeSide == Side.YES) ? snapTotalNoStake : snapTotalYesStake;
            uint256 winning = (outcomeSide == Side.YES) ? snapTotalYesStake : snapTotalNoStake;
            require(winning > 0, "No winning stake");

            uint256 feePct = betFactory.defaultPlatformFeePercentage();
            uint256 voterPct = betFactory.defaultVoterRewardPercentage();

            snapPlatformFeeUsdc = (losing * feePct) / 100;
            snapVoterRewardPoolUsdc = (losing * voterPct) / 100;

            uint256 net = losing - snapPlatformFeeUsdc - snapVoterRewardPoolUsdc;
            snapNetLosingPoolUsdc = net;
            snapWinningBettorTotalStake = winning;

            // Send platform fee now (internal)
            if (snapPlatformFeeUsdc > 0) {
                betFactory.transferInternalUsdc(address(this), betFactory.feeCollector(), snapPlatformFeeUsdc, "Platform fee");
            }

            // Wrong voters forfeit PROOF:
            // - if YES wins => (NO + INVALID) forfeits to YES voters
            // - if NO wins  => (YES + INVALID) forfeits to NO voters
            uint256 forfeitedProof = (outcomeSide == Side.YES)
                ? (snapTotalNoProofStake + snapTotalInvalidProofStake)
                : (snapTotalYesProofStake + snapTotalInvalidProofStake);

            // Keep forfeited PROOF in this contract; winners will claim it proportionally.
            snapInvalidLosingVoterTotalStakeProof = forfeitedProof; // reused as "forfeitedProof" storage
                if (outcomeSide == Side.YES) {
                snaptotalWinnerProof = totalYesProofStake;
            } else if (outcomeSide == Side.NO) {
                snaptotalWinnerProof = totalNoProofStake;
            }
            
        }

        // ===== CANCELLED pools =====
        else if (_status == Status.CANCELLED) {
            
            uint256 feePct2 = betFactory.defaultPlatformFeePercentage();
            snapPlatformFeeUsdc = (snapCreatorCollateral * feePct2) / 100;

            // always take fee from collateral if any (optional)
            if (snapPlatformFeeUsdc > 0) {
                betFactory.transferInternalUsdc(address(this), betFactory.feeCollector(), snapPlatformFeeUsdc, "Platform fee (collateral)");
            }

            uint256 remainingCollateral = snapCreatorCollateral - snapPlatformFeeUsdc;

            if (cancelReason == CancelReason.NO_PROOF) {
                // No voters path: collateral remainder goes to bettors (as bonus pool)
                snapBettorRefundBonusPoolUsdc = remainingCollateral;
                creatorCollateral = 0;
            } else if (cancelReason == CancelReason.VOTE_INVALID && outcomeSide == Side.INVALID) {

                // INVALID vote cancellation:
                // You said: "voters who vote different should lose collateral and it should be distributed between correct voters"
                // Here: bettors get refunds, plus optional collateral split between bettors & INVALID voters.
                // Split collateral remainder 50/50 (tune as you want).
                snapBettorRefundBonusPoolUsdc = remainingCollateral / 2;
                snapInvalidVoterBonusPoolUsdc = remainingCollateral - snapBettorRefundBonusPoolUsdc;

                // Losing voter proof forfeited to INVALID voters:
                // forfeited = YES + NO (since INVALID is the winning voter side)
                snapInvalidLosingVoterTotalStakeProof = snapTotalYesProofStake + snapTotalNoProofStake;
                snapInvalidWinningVoterTotalStakeProof = snapTotalInvalidProofStake;
                creatorCollateral = 0;
                snaptotalWinnerProof = totalInvalidProofStake;

                snapVoterRewardPoolUsdc = snapInvalidVoterBonusPoolUsdc;

            } 


        }
       
        // ===== Common winner proof snapshot =====
      
    }
    // ======== CLAIMS ========
    
    /**
     * @notice Claim rewards as a bettor
     * @dev Winning bettors get stake + share of losing pool
     *      Cancelled bets: everyone gets refund + optional collateral bonus
     */
    function claimBettor() external nonReentrant {
        require(snapshotted, "Not finalized");
        Participant storage p = participants[msg.sender];
        require(!p.claimed, "Already claimed");

        uint256 userYes = p.yesStake;
        uint256 userNo = p.noStake;
        require(userYes > 0 || userNo > 0, "Not a bettor");

        p.claimed = true;
        uint256 payoutUsdc = 0;

        if (_status == Status.COMPLETED) {
            uint256 userWin = (outcomeSide == Side.YES) ? userYes : userNo;
            require(userWin > 0, "Not winner");
            payoutUsdc = userWin + (snapNetLosingPoolUsdc * userWin) / snapWinningBettorTotalStake;
        } else {
            uint256 refund = userYes + userNo;
            payoutUsdc = refund;

            uint256 totalStakes = snapTotalYesStake + snapTotalNoStake;
            if (totalStakes > 0 && snapBettorRefundBonusPoolUsdc > 0) {
                uint256 userStake = userYes + userNo;
                payoutUsdc += (snapBettorRefundBonusPoolUsdc * userStake) / totalStakes;
            }
        }

        if (payoutUsdc > 0) {
            betFactory.transferInternalUsdc(address(this), msg.sender, payoutUsdc, "Bettor claim");
        }

        emit BettorClaimed(msg.sender, payoutUsdc);
    }

    /**
     * @notice Claim rewards as a voter
     * @dev FIXES APPLIED:
     * - Critical #1: Division by zero protection
     * - Added safety checks for invalidVotes > 0
     * - Better handling of edge cases
     * 
     * COMPLETED: Correct voters get PROOF stake back + share of forfeited PROOF + USDC reward
     * CANCELLED (VOTE_INVALID): INVALID voters win and share forfeited PROOF + collateral bonus
     * Other CANCELLED: Voters get PROOF stake back (no rewards)
     */
    function claimVoter() external nonReentrant {
        require(snapshotted, "Not finalized");
        VoterInfo storage v = voters[msg.sender];
        require(!v.claimed, "Already claimed");
        require(v.vote != Side.NONE, "Not voted");
        require(v.stakeProof > 0, "No stake");

        v.claimed = true;
        uint256 proofOut = 0;
        uint256 usdcOut = 0;

        if (_status == Status.COMPLETED) {
            bool correct = (v.vote == outcomeSide);
            if (correct) {
                proofOut += v.stakeProof;

                uint256 winnersStakeTotal = (outcomeSide == Side.YES) ? snapTotalYesProofStake : snapTotalNoProofStake;
                uint256 forfeitedProof = snapInvalidLosingVoterTotalStakeProof;

                if (winnersStakeTotal > 0 && forfeitedProof > 0) {
                    proofOut += (forfeitedProof * v.stakeProof) / winnersStakeTotal;
                }

                uint256 winnersCount = (outcomeSide == Side.YES) ? yesVotes : noVotes;

                if (winnersCount > 0 && snapVoterRewardPoolUsdc > 0) {
                    usdcOut += snapVoterRewardPoolUsdc / winnersCount;
                }
            } else {
                betFactory.factoryApplyPenalty(msg.sender);
            }

        } else {
            if (cancelReason == CancelReason.VOTE_INVALID && outcomeSide == Side.INVALID) {
                if (v.vote == Side.INVALID) {
                    proofOut += v.stakeProof;

                    
                    if (invalidVotes > 0 && snapInvalidLosingVoterTotalStakeProof > 0) {
                        proofOut += snapInvalidLosingVoterTotalStakeProof / invalidVotes;
                    }

                    
                    if (invalidVotes > 0 && snapInvalidVoterBonusPoolUsdc > 0) {
                        usdcOut += snapInvalidVoterBonusPoolUsdc / invalidVotes;
                    }
                }
            } else {
                proofOut += v.stakeProof;
            }
        }

        if (proofOut > 0) {
            betFactory.transferInternalProof(address(this), msg.sender, proofOut, "Voter claim");
        }
        if (usdcOut > 0) {
            betFactory.transferInternalUsdc(address(this), msg.sender, usdcOut, "Voter reward");
        }

        emit VoterClaimed(msg.sender, usdcOut, proofOut);
    }
    
    /**
     * @notice Claim collateral as creator (only if bet completed validly or certain cancellations)
     * @dev FIXES APPLIED:
     * - High #7: Added validation for collateral eligibility
     * - Creator only gets collateral back if outcome is valid
     * - Typo fixed: "colletoral" -> "collateral"
     */
    function claimCreatorCollateral() external nonReentrant {
        require(msg.sender == creator, "Only creator");
        require(snapshotted, "Not finalized");
        require(creatorCollateral > 0, "No collateral to claim"); // FIX: Typo fixed
        
        // FIX High #7: Only allow collateral claim in valid scenarios
        require(
            (_status == Status.COMPLETED && (outcomeSide == Side.YES || outcomeSide == Side.NO)) ||
            (_status == Status.CANCELLED && 
             (cancelReason == CancelReason.MIN_SIDE_STAKE || 
              cancelReason == CancelReason.INSUFFICIENT_VOTES || 
              cancelReason == CancelReason.TIE)),
            "Collateral forfeited"
        );
        
        uint256 amount = creatorCollateral;
        creatorCollateral = 0;

        betFactory.transferInternalUsdc(address(this), creator, amount, "Creator collateral claim");
    }

    // ======== VIEW HELPERS ========
    function getResolutionInfo() external view returns (ResolutionInfo memory info) {
        info.status = _status;
        info.reason = cancelReason;
        info.outcome = outcomeSide;
        info.yesStake = snapTotalYesStake;
        info.noStake = snapTotalNoStake;
        info.yesVotes = yesVotes;
        info.noVotes = noVotes;
        info.invalidVotes = invalidVotes;
        info.creatorCollateralSnap = snapCreatorCollateral;
        info.platformFeeUsdc = snapPlatformFeeUsdc;
        info.voterRewardPoolUsdc = snapVoterRewardPoolUsdc;
        info.forfeitProof = snapInvalidLosingVoterTotalStakeProof;
        info.totalWinnerProof = snaptotalWinnerProof;
        info.bettorBonusPoolUsdc = snapBettorRefundBonusPoolUsdc;
    }
    
    function hasBettor(address user) external view returns (bool) {
        Participant storage p = participants[user];
        return (p.yesStake > 0 || p.noStake > 0);
    }

    function hasVoter(address user) external view returns (bool) {
        VoterInfo storage v = voters[user];
        return v.vote != Side.NONE; 
    }
}
