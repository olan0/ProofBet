// SPDX-License-Identifier: MIT
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
        (, uint256 userProofBalance) = betFactory.getInternalBalances(msg.sender);
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
        
        uint256 totalStake = totalYesStake + totalNoStake;
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
}