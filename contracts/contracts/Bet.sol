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
        string title;
        string description;
        uint256 bettingDeadline;
        uint256 proofDeadline;
        uint256 votingDeadline;
        uint256 minimumBetAmount;
        uint256 minimumSideStake;
        uint8 minimumTrustScore;
        uint256 minimumVotes; // NEW: Added minimum votes requirement
    }

    struct Participant {
        uint256 yesStake;
        uint256 noStake;
        bool hasWithdrawn;
    }

    BetDetails public details;
    address public creator; // Moved creator out of BetDetails
    BetFactory public betFactory;
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    IERC20 public proofToken; // This still references the ProofToken contract but actual transfers go through BetFactory's internal balance system
    address public feeCollector;

    uint256 public totalYesStake;
    uint256 public totalNoStake;
    uint256 public totalVoteStakeProof;
    string public proofUrl;
    Side public winningSide;
    bool public fundsDistributed;

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
    event VoteCast(address indexed voter, Side vote, uint256 amountProof);
    event BetResolved(Side winningSide);
    event BetCancelled(string reason); // Updated to include reason
    event FundsWithdrawn(address indexed user, uint256 amountUsdc, uint256 amountProof);

    modifier onlyCreator() {
        require(msg.sender == creator, "Not creator");
        _;
    }

    modifier atStatus(Status _status) {
        require(_currentStatus == _status, "Invalid status");
        _;
    }

    constructor(
        BetDetails memory _details, 
        address _creator, // Creator now passed explicitly
        address _betFactory,
        address _trustScore, 
        address _usdcToken,
        address _proofToken,
        address _feeCollector
    ) {
        details = _details;
        creator = _creator; // Assign to the new state variable
        betFactory = BetFactory(_betFactory);
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken); // Keep reference, but transfers are internal to factory
        feeCollector = _feeCollector;
        _currentStatus = Status.OPEN_FOR_BETS;
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
        uint256 totalYes,
        uint256 totalNo,
        uint256 bettingDeadline,
        uint256 proofDeadline,
        uint256 votingDeadline,
        string memory proof,
        uint256 participantsCount,
        uint256 voters
    ) {
        return (
            details.title,
            details.description,
            totalYesStake,
            totalNoStake,
            details.bettingDeadline, // Using bettingDeadline as a time reference
            details.proofDeadline,
            details.votingDeadline,
            proofUrl,
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
        emit ProofSubmitted(creator, _proofUrl); // Use new creator state variable
    }

    // NEW: Vote using internal wallet balance
    function vote(Side _vote) external nonReentrant atStatus(Status.VOTING) {
        require(block.timestamp < details.votingDeadline, "Voting has closed");
        require(_vote == Side.YES || _vote == Side.NO, "Invalid vote");
        require(participants[msg.sender].yesStake == 0 && participants[msg.sender].noStake == 0, "Bettors cannot vote");
        require(!voted[msg.sender], "Already voted");
        require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust score too low");
        
        // Fetch vote stake amount dynamically from BetFactory
        uint256 voteStakeAmount = betFactory.voteStakeAmountProof();
        (, uint256 userProofBalance) = betFactory.getInternalBalances(msg.sender);
        require(userProofBalance >= voteStakeAmount, "Insufficient internal PROOF balance");

        // Transfer from user's internal balance to this contract's address (held by factory)
        betFactory.transferInternalProof(msg.sender, address(this), voteStakeAmount, "Vote stake");
        
        voted[msg.sender] = true;
        votes[msg.sender] = _vote;
        voterStakesProof[msg.sender] += voteStakeAmount;
        totalVoteStakeProof += voteStakeAmount;
        totalVotes++;
        
        if (_vote == Side.YES) {
            yesVotes++;
        } else {
            noVotes++;
        }

        betFactory.factoryLogVote(msg.sender);
        
        emit VoteCast(msg.sender, _vote, voteStakeAmount);
    }

    // === AUTOMATED KEEPER FUNCTIONS ===
    // These functions are intended to be called by an off-chain "Keeper" or "Automation" service (like Chainlink Automation).
    // Smart contracts cannot run automatically. They need an external transaction to trigger their state changes.
    // These functions check time-based conditions and update the contract's status accordingly.

    /**
     * @dev KEEPER FUNCTION: Checks if the betting deadline has passed.
     * If so, transitions the state to AWAITING_PROOF or CANCELLED if stake minimums aren't met.
     */
    function checkAndCloseBetting() external {
        if (_currentStatus == Status.OPEN_FOR_BETS && block.timestamp >= details.bettingDeadline) {
            if (totalYesStake >= details.minimumSideStake && totalNoStake >= details.minimumSideStake) {
                _currentStatus = Status.AWAITING_PROOF;
            } else {
                _currentStatus = Status.CANCELLED;
                betFactory.factoryLogBetCompletion(creator); // Notify factory on completion
                emit BetCancelled("Minimum side stake not met"); // Reason added
            }
        }
    }
    
    /**
     * @dev KEEPER FUNCTION: Checks if the proof submission deadline has passed without a proof.
     * If so, transitions the state to CANCELLED.
     */
    function checkAndCancelForProof() external {
        if (_currentStatus == Status.AWAITING_PROOF && block.timestamp >= details.proofDeadline) {
            _currentStatus = Status.CANCELLED;
            betFactory.factoryLogBetCompletion(creator); // Notify factory on completion
            emit BetCancelled("Proof deadline missed"); // Reason added
        }
    }
    
    /**
     * @dev KEEPER FUNCTION: Checks if the voting deadline has passed.
     * If so, it tallies the votes and resolves the bet to COMPLETED or CANCELLED.
     */
    function checkAndResolve() external {
        if (_currentStatus == Status.VOTING && block.timestamp >= details.votingDeadline) {
            // NEW: Check for minimum votes first
            if (totalVotes < details.minimumVotes) {
                // If not enough votes, cancel the bet
                _currentStatus = Status.CANCELLED;
                emit BetCancelled("Insufficient public votes"); // Reason added
            } else {
                // If enough votes, proceed to tally
                if (yesVotes > noVotes) {
                    winningSide = Side.YES;
                    _currentStatus = Status.COMPLETED;
                    emit BetResolved(winningSide);
                } else if (noVotes > yesVotes) {
                    winningSide = Side.NO;
                    _currentStatus = Status.COMPLETED;
                    emit BetResolved(winningSide);
                } else {
                    // It's a tie, so cancel
                    _currentStatus = Status.CANCELLED;
                    emit BetCancelled("Vote tie"); // Reason added
                }
            }
            betFactory.factoryLogBetCompletion(creator); // Notify factory on completion regardless of outcome
            withdrawFunds(); // Automatically trigger fund distribution/refunds
        }
    }
    
    // Internal function to notify factory - REMOVED, now called directly in keeper functions
    // function _notifyFactoryOfCompletion() internal {
    //     if (!creatorCountDecremented) {
    //         creatorCountDecremented = true;
    //         betFactory.factoryLogBetCompletion(details.creator);
    //     }
    // }
    
    // === FUND WITHDRAWAL ===

    function withdrawFunds() internal {
        require(_currentStatus == Status.COMPLETED || _currentStatus == Status.CANCELLED, "Bet not finished");
        require(!fundsDistributed, "Funds already being distributed"); // Corrected typo

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
        
        // Fetch platform fee percentage dynamically from BetFactory
        uint256 platformFeeAmount = (totalStake * betFactory.defaultPlatformFeePercentage()) / 100;
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
        // Fetch percentages dynamically from BetFactory
        uint256 voterRewardAmount = (totalStake * betFactory.defaultVoterRewardPercentage()) / 100;
        uint256 platformFeeAmount = (totalStake * betFactory.defaultPlatformFeePercentage()) / 100;
        uint256 netWinningsPool = totalStake - voterRewardAmount - platformFeeAmount;
        
        uint256 winningStake = (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        
        uint256 participantPayout = 0;
        if (winningStake > 0) {
            participantPayout = (netWinningsPool * participantWinningStake) / winningStake;
        }
        
        participant.hasWithdrawn = true;
        
        if(participantPayout > 0) { // Only transfer if there's a payout
            betFactory.transferInternalUsdc(address(this), msg.sender, participantPayout, "Bet winnings");
        }
        
        emit FundsWithdrawn(msg.sender, participantPayout, 0);
    }
    
    function claimVoterRewards() external nonReentrant {
        require(_currentStatus == Status.COMPLETED || _currentStatus == Status.CANCELLED, "Bet not finished");
        require(voted[msg.sender], "Did not vote");
        require(voterStakesProof[msg.sender] > 0, "No stake to claim");
        
        uint256 proofToReturn = 0;
        uint256 usdcReward = 0;

        uint256 originalProofStake = voterStakesProof[msg.sender]; // Get original stake before clearing
        voterStakesProof[msg.sender] = 0; // Prevent re-claiming
        
        if (_currentStatus == Status.COMPLETED) {
            bool votedCorrectly = (votes[msg.sender] == winningSide);
            
            if (votedCorrectly) {
                proofToReturn = originalProofStake;
                
                // Fetch voter reward percentage dynamically from BetFactory
                uint256 totalVoterRewardPool = ((totalYesStake + totalNoStake) * betFactory.defaultVoterRewardPercentage()) / 100; 
                
                // Distribute rewards evenly among winning voters
                uint256 winningVoterCount = (winningSide == Side.YES) ? yesVotes : noVotes;
                if (totalVoterRewardPool > 0 && winningVoterCount > 0) {
                    usdcReward = totalVoterRewardPool / winningVoterCount;
                }
            }
        } else { // Bet was CANCELLED, so return original stake
            proofToReturn = originalProofStake;
        }
        
        if (proofToReturn > 0) {
            betFactory.transferInternalProof(address(this), msg.sender, proofToReturn, "Vote stake return");
        }
        if (usdcReward > 0) {
            betFactory.transferInternalUsdc(address(this), msg.sender, usdcReward, "Voter reward");
        }
        
        emit FundsWithdrawn(msg.sender, usdcReward, proofToReturn);
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