// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TrustScore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Bet
 * @dev Individual prediction market contract using dual-token system
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
        uint256 minimumBetAmount; // In USDC
        uint256 minimumSideStake; // In USDC
        uint8 minimumTrustScore;
        uint8 voterRewardPercentage;
        uint8 platformFeePercentage;
    }

    struct Participant {
        uint256 yesStake; // In USDC
        uint256 noStake;  // In USDC
        bool hasWithdrawn;
    }

    BetDetails public details;
    Status public currentStatus;
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    IERC20 public proofToken;
    address public feeCollector;

    uint256 public totalYesStake; // In USDC
    uint256 public totalNoStake;  // In USDC
    uint256 public totalVoteStakeProof; // In PROOF tokens
    uint256 public voteStakeAmountProof; // Bet's specific vote stake amount, set at creation
    string public proofUrl;
    Side public winningSide;
    bool public fundsDistributed;

    // Vote counters to avoid iterating through voters (anti-pattern)
    uint256 public yesVotes;
    uint256 public noVotes;

    mapping(address => Participant) public participants;
    mapping(address => uint256) public voterStakesProof; // In PROOF tokens
    mapping(address => Side) public votes;
    mapping(address => bool) public voted;

    event BetPlaced(address indexed user, Side position, uint256 amountUsdc);
    event ProofSubmitted(address indexed creator, string proofUrl);
    event VoteCast(address indexed voter, Side vote, uint256 amountProof);
    event BetResolved(Side winningSide);
    event BetCancelled();
    event FundsWithdrawn(address indexed user, uint256 amountUsdc, uint256 amountProof);

    modifier onlyCreator() {
        require(msg.sender == details.creator, "Not creator");
        _;
    }

    modifier atStatus(Status _status) {
        require(currentStatus == _status, "Invalid status");
        _;
    }

    constructor(
        BetDetails memory _details, 
        address _trustScore, 
        address _usdcToken,
        address _proofToken,
        address _feeCollector,
        uint256 _voteStakeAmountProof
    ) {
        details = _details;
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken);
        feeCollector = _feeCollector;
        voteStakeAmountProof = _voteStakeAmountProof;
        currentStatus = Status.OPEN_FOR_BETS;
    }

    function placeBet(Side _position, uint256 _amountUsdc) external nonReentrant atStatus(Status.OPEN_FOR_BETS) {
        require(block.timestamp < details.bettingDeadline, "Betting has closed");
        require(_position == Side.YES || _position == Side.NO, "Invalid position");
        require(_amountUsdc >= details.minimumBetAmount, "Stake is too low");
        require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust score too low");
        
        usdcToken.transferFrom(msg.sender, address(this), _amountUsdc);

        Participant storage participant = participants[msg.sender];
        if (_position == Side.YES) {
            participant.yesStake += _amountUsdc;
            totalYesStake += _amountUsdc;
        } else {
            participant.noStake += _amountUsdc;
            totalNoStake += _amountUsdc;
        }
        
        trustScoreContract.logBetParticipation(msg.sender);
        emit BetPlaced(msg.sender, _position, _amountUsdc);
    }
    
    function submitProof(string memory _proofUrl) external onlyCreator atStatus(Status.AWAITING_PROOF) {
        require(block.timestamp >= details.bettingDeadline, "Betting must be closed to submit proof");
        require(block.timestamp < details.proofDeadline, "Proof submission deadline passed");
        require(bytes(_proofUrl).length > 0, "Proof URL cannot be empty");
        proofUrl = _proofUrl;
        currentStatus = Status.VOTING;
        emit ProofSubmitted(details.creator, _proofUrl);
    }

    function vote(Side _vote) external nonReentrant atStatus(Status.VOTING) {
        require(block.timestamp < details.votingDeadline, "Voting has closed");
        require(_vote == Side.YES || _vote == Side.NO, "Invalid vote");
        require(participants[msg.sender].yesStake == 0 && participants[msg.sender].noStake == 0, "Bettors cannot vote");
        require(!voted[msg.sender], "Already voted");
        require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust score too low");
        require(proofToken.balanceOf(msg.sender) >= voteStakeAmountProof, "Insufficient PROOF for vote stake");
        require(proofToken.allowance(msg.sender, address(this)) >= voteStakeAmountProof, "PROOF allowance too low for vote stake");

        // Take PROOF tokens as voting stake
        proofToken.transferFrom(msg.sender, address(this), voteStakeAmountProof);
        
        voted[msg.sender] = true;
        votes[msg.sender] = _vote;
        voterStakesProof[msg.sender] += voteStakeAmountProof;
        totalVoteStakeProof += voteStakeAmountProof; // Fixed: was totalVoteStakeAmountAmountProof

        // Increment vote counters
        if (_vote == Side.YES) {
            yesVotes++;
        } else {
            noVotes++;
        }

        trustScoreContract.logVote(msg.sender);
        emit VoteCast(msg.sender, _vote, voteStakeAmountProof);
    }

    // --- Automated Keeper Functions (to be called by an off-chain script) ---

    function checkAndCloseBetting() external {
        if (currentStatus == Status.OPEN_FOR_BETS && block.timestamp >= details.bettingDeadline) {
            if (totalYesStake >= details.minimumSideStake && totalNoStake >= details.minimumSideStake) {
                currentStatus = Status.AWAITING_PROOF;
            } else {
                currentStatus = Status.CANCELLED;
                emit BetCancelled();
            }
        }
    }
    
    function checkAndCancelForProof() external {
        if (currentStatus == Status.AWAITING_PROOF && block.timestamp >= details.proofDeadline) {
            currentStatus = Status.CANCELLED;
            emit BetCancelled();
        }
    }
    
    function checkAndResolve() external {
        if (currentStatus == Status.VOTING && block.timestamp >= details.votingDeadline) {
            if (yesVotes > noVotes) {
                winningSide = Side.YES;
                currentStatus = Status.COMPLETED;
                emit BetResolved(winningSide);
            } else if (noVotes > yesVotes) {
                winningSide = Side.NO;
                currentStatus = Status.COMPLETED;
                emit BetResolved(winningSide);
            } else {
                // On a tie, cancel the bet for fairness
                currentStatus = Status.CANCELLED;
                emit BetCancelled();
            }
        }
    }
    
    // --- Fund Withdrawal ---

    function withdrawFunds() external nonReentrant {
        require(currentStatus == Status.COMPLETED || currentStatus == Status.CANCELLED, "Bet not finished");
        require(!fundsDistributed, "Funds already being distributed");

        if (currentStatus == Status.COMPLETED) {
            distributeWinnings();
        } else { // CANCELLED
            refundAll();
        }
    }

    function distributeWinnings() internal {
        fundsDistributed = true;
        
        uint256 totalStake = totalYesStake + totalNoStake;
        require(totalStake > 0, "No stakes to distribute");
        
        // Calculate and transfer platform fee immediately
        uint256 platformFeeAmount = (totalStake * details.platformFeePercentage) / 100;
        if (platformFeeAmount > 0) {
            usdcToken.transfer(feeCollector, platformFeeAmount);
        }
        
        // Note: All other distributions (voter rewards, bettor winnings, PROOF stake returns)
        // are handled in the individual claiming functions for security and gas efficiency.
        // This follows the secure pull-over-push pattern.
    }
    
    function refundAll() internal {
        fundsDistributed = true;
        // All refund logic is handled in the individual claiming functions
        // (claimRefund for participants, claimVoterRewards for voters)
    }
    
    // --- Individual Claiming Functions (Production Pattern) ---
    
    /**
     * @dev Allow winning participants to claim their proportional winnings
     */
    function claimWinnings() external nonReentrant {
        require(currentStatus == Status.COMPLETED, "Bet not completed");
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
        
        // Calculate this participant's share of the winnings
        uint256 totalStake = totalYesStake + totalNoStake;
        uint256 voterRewardAmount = (totalStake * details.voterRewardPercentage) / 100;
        uint256 platformFeeAmount = (totalStake * details.platformFeePercentage) / 100;
        uint256 netWinningsPool = totalStake - voterRewardAmount - platformFeeAmount;
        
        uint256 winningStake = (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        
        uint256 participantPayout = (netWinningsPool * participantWinningStake) / winningStake;
        
        participant.hasWithdrawn = true;
        usdcToken.transfer(msg.sender, participantPayout);
        
        emit FundsWithdrawn(msg.sender, participantPayout, 0);
    }
    
    /**
     * @dev Allow voters to claim their PROOF stake returns and USDC rewards
     */
    function claimVoterRewards() external nonReentrant {
        require(currentStatus == Status.COMPLETED || currentStatus == Status.CANCELLED, "Bet not finished");
        require(voted[msg.sender], "Did not vote");
        require(voterStakesProof[msg.sender] > 0, "No stake to claim");
        
        uint256 originalProofStakeAmount = voterStakesProof[msg.sender];
        uint256 proofStakeToReturn = 0;
        uint256 usdcReward = 0;

        // Mark stake as processed immediately to prevent re-entrancy.
        voterStakesProof[msg.sender] = 0;
        
        if (currentStatus == Status.COMPLETED) {
            bool votedCorrectly = (votes[msg.sender] == winningSide);
            
            if (votedCorrectly) {
                // Correct voters get their stake back
                proofStakeToReturn = originalProofStakeAmount;

                // And they get a proportional share of the USDC reward pool
                uint256 totalVoterRewardPool = ((totalYesStake + totalNoStake) * details.voterRewardPercentage) / 100; 
                
                if (totalVoteStakeProof > 0) { 
                    usdcReward = (totalVoterRewardPool * originalProofStakeAmount) / totalVoteStakeProof;
                }
            }
            // Incorrect voters forfeit their stake (proofStakeToReturn remains 0).
        } else { // status is CANCELLED
            // All voters get their stake back if the bet is cancelled.
            proofStakeToReturn = originalProofStakeAmount;
        }
        
        // Perform transfers
        if (proofStakeToReturn > 0) {
            proofToken.transfer(msg.sender, proofStakeToReturn);
        }
        if (usdcReward > 0) {
            usdcToken.transfer(msg.sender, usdcReward);
        }
        
        emit FundsWithdrawn(msg.sender, usdcReward, proofStakeToReturn);
    }
    
    /**
     * @dev Allow participants to claim refunds for cancelled bets
     */
    function claimRefund() external nonReentrant {
        require(currentStatus == Status.CANCELLED, "Bet not cancelled");
        
        Participant storage participant = participants[msg.sender];
        require(!participant.hasWithdrawn, "Already withdrawn");
        
        uint256 totalRefund = participant.yesStake + participant.noStake;
        require(totalRefund > 0, "No stake to refund");
        
        participant.hasWithdrawn = true;
        usdcToken.transfer(msg.sender, totalRefund);
        
        emit FundsWithdrawn(msg.sender, totalRefund, 0);
    }
}