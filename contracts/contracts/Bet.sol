// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "./TrustScore.sol";
//import "./BetFactory.sol";
//import "hardhat/console.sol";


interface ITrustScore {
    function getScore(address user) external view returns (uint256);
}

interface IBetFactory {
    // Internal wallets
    function getInternalBalances(address user) external view returns (uint256 usdc, uint256 proof);
    function transferInternalUsdc(address _from, address _to, uint256 _amount, string memory _reason) external;
    function transferInternalProof(address _from, address _to, uint256 _amount, string memory _reason) external;

    // Config
    function defaultPlatformFeePercentage() external view returns (uint256);
    function defaultVoterRewardPercentage() external view returns (uint256); // % of losing bettor pool paid to correct voters
    function feeCollector() external view returns (address);
    function calculateRequiredStake(address voter) external view returns (uint256);

    // Optional logs / moderation 
    function factoryLogBetParticipation(address participant,uint8 _position, uint256 _amountUsdc) external;
    function factoryLogVote(address voter, uint8 _vote ) external;
    function factoryLogBetCompletion(address creator,uint8 newStatus) external;
    function banCreator(address creator) external;

    // Creator collateral baseline (USDC)
    function proofCollateralUsdc() external view returns (uint256);

    // Notification of status change
     function notifyBetStatusChange(address betAddress,uint8 newStatus,string calldata reason) external;
}

/**
 * Bet v2 (rebuilt)
 * - INVALID proof => Status.CANCELLED with CancelReason.VOTE_INVALID
 * - No proof => Status.CANCELLED with CancelReason.NO_PROOF
 * - Claim-based payouts (no loops)
 */
contract Bet is ReentrancyGuard {
    enum Category {  
    UNKNOWN,
    CRYPTO,
    SPORTS,
    POLITICS,
    FINANCE,
    OTHER
}

enum ProofType {
    UNKNOWN,
    VIDEO,
    LIVESTREAM,
    ORACLE,
    DOCUMENT,
    OTHER
}

    enum Status { OPEN_FOR_BETS, AWAITING_PROOF, VOTING, COMPLETED, CANCELLED , NONE}
    enum Side { NONE, YES, NO, INVALID } // INVALID is for voters only
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
    IERC20 public usdcToken;   // informational
    IERC20 public proofToken;  // informational

    Status private _status;
    CancelReason public cancelReason;

    // Totals (live)
    uint256 public totalYesStake;
    uint256 public totalNoStake;
    uint256 public participantsCount;

    uint256 public yesVotes;
    uint256 public noVotes;
    uint256 public invalidVotes;
    uint256 public totalVotes;

    // total PROOF staked by voters per option
    uint256 public totalYesProofStake;
    uint256 public totalNoProofStake;
    uint256 public totalInvalidProofStake;

    string public proofUrl;

    // Outcome only meaningful when COMPLETED (YES/NO) OR CANCELLED(VOTE_INVALID)
    Side public outcomeSide; // YES/NO for completed, INVALID for vote-invalid cancellation, NONE otherwise

    // Creator collateral (USDC)
    uint256 public creatorCollateral;

    // Claims
    mapping(address => Participant) public participants;
    mapping(address => VoterInfo) public voters;

    // ======== SNAPSHOTS ========
    // Captured once when finalized (COMPLETED or CANCELLED)
    bool public snapshotted;

    uint256 public snapTotalYesStake;
    uint256 public snapTotalNoStake;

    uint256 public snapTotalYesProofStake;
    uint256 public snapTotalNoProofStake;
    uint256 public snapTotalInvalidProofStake;

    uint256 public snapCreatorCollateral;

    // Pools computed at snapshot time
    // COMPLETED:
    uint256 public snapPlatformFeeUsdc;
    uint256 public snapVoterRewardPoolUsdc; // from losing bettors pool (USDC)
    
    uint256 public snapNetLosingPoolUsdc;   // remaining losing pool distributed to winning bettors (USDC)
    uint256 public snapWinningBettorTotalStake;

    // CANCELLED NO_PROOF:
    uint256 public snapBettorRefundBonusPoolUsdc; // from collateral (optional)
    // CANCELLED VOTE_INVALID:
   
    uint256 public snapInvalidVoterBonusPoolUsdc;  // from collateral portion going to correct voters
    uint256 public snapInvalidWinningVoterTotalStakeProof; // sum stakeProof for INVALID voters (for proportional distribution)
    uint256 public snapInvalidLosingVoterTotalStakeProof;  // forfeited PROOF pool from non-INVALID voters
    uint256 public snaptotalWinnerProof;

    // ======== EVENTS ========

    event BetPlaced(address indexed user, Side position, uint256 amountUsdc);
    event ProofSubmitted(address indexed creator, string proofUrl);
    event VoteCast(address indexed voter, Side vote, uint256 amountProof);
    event StatusChanged(Status newStatus, CancelReason reason, Side outcomeSide);
    event BettorClaimed(address indexed user, uint256 usdcAmount);
    event VoterClaimed(address indexed user, uint256 usdcAmount, uint256 proofAmount);

    // ======== INIT ========

    bool private initialized;

    function initialize(
        BetDetails memory _details,
        address _creator,
        address _betFactory,
        address _trustScore,
        address _usdcToken,
        address _proofToken
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;
       
        require(_creator != address(0) && _betFactory != address(0) && _trustScore != address(0), "Zero address");
        require(_details.bettingDeadline < _details.proofDeadline && _details.proofDeadline < _details.votingDeadline, "Bad deadlines");
        require(msg.sender == _betFactory, "Only factory can initialize");
        require(_details.category != Category.UNKNOWN, "Invalid category");
        require(_details.proofType != ProofType.UNKNOWN, "Invalid proof type");
        require(bytes(_details.title).length > 0, "Empty title");
        details = _details;
        creator = _creator;
        betFactory = IBetFactory(_betFactory);
        trustScoreContract = ITrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken);

        _status = Status.OPEN_FOR_BETS;
        cancelReason = CancelReason.NONE;
        outcomeSide = Side.NONE;
       
        // baseline collateral(creator must have funded internal balance beforehand)
        creatorCollateral = betFactory.proofCollateralUsdc();
       
        if (creatorCollateral > 0) {
            // lock collateral from creator into this Bet (internal transfer)
            
            betFactory.transferInternalUsdc(_creator, address(this), creatorCollateral, "Creator collateral");
        }
      
        emit StatusChanged(_status, cancelReason, outcomeSide);
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

    function placeBet(Side position, uint256 amountUsdc) external nonReentrant {
        require(_status == Status.OPEN_FOR_BETS, "Invalid status");
        require(block.timestamp < details.bettingDeadline, "Betting closed");
        require(position == Side.YES || position == Side.NO, "Bad side");
        require(amountUsdc >= details.minimumBetAmount, "Stake too low");

        // Trust gate
        if (details.minimumTrustScore > 0) {
            require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust too low");
        }

        // Creator cannot bet NO (your rule)
        (uint256 uUsdc, ) = betFactory.getInternalBalances(msg.sender);
         if (msg.sender == creator) {
            // Creator must have double USDC: bet + extra stake/penalty
            require(
                uUsdc >= amountUsdc * 2,
                "Creator needs extra collateral"
            );

            // Transfer the matched amount into this Bet (2x bet size)
            betFactory.transferInternalUsdc(
                msg.sender,
                address(this),
                amountUsdc * 2,
                "Creator matching collateral"
            );

            // Of that, one bet-size counts as "creatorCollateral" (claimable/penalized),
            // and one bet-size counts as actual bet stake.
            creatorCollateral += amountUsdc;
        } else {
            require(uUsdc >= amountUsdc, "Insufficient USDC");
            betFactory.transferInternalUsdc(
                msg.sender,
                address(this),
                amountUsdc,
                "Bet placement"
            );
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
            emit StatusChanged(_status, CancelReason.NONE, Side.NONE);
            betFactory.notifyBetStatusChange(address(this),uint8(_status),"Betting closed, awaiting proof");
        } else {
            _cancel(CancelReason.MIN_SIDE_STAKE, Side.NONE);
        }
    }

    // ======== PROOF ========

    function submitProof(string calldata _proofUrl) external {
        require(msg.sender == creator, "Not creator");
        require(_status == Status.AWAITING_PROOF, "Invalid status");
        require(block.timestamp >= details.bettingDeadline, "Betting still open");
        require(block.timestamp < details.proofDeadline, "Proof deadline passed");
        require(bytes(_proofUrl).length > 0, "Empty proof");

        proofUrl = _proofUrl;
        _status = Status.VOTING;

        emit ProofSubmitted(msg.sender, _proofUrl);
        emit StatusChanged(_status, CancelReason.NONE, Side.NONE);
        betFactory.notifyBetStatusChange(address(this),uint8(_status),"Proof submitted, voting started");
    }

    function checkAndCancelForNoProof() external {
        if (_status != Status.AWAITING_PROOF) return;
        if (block.timestamp < details.proofDeadline) return;

        // NO_PROOF is a cancellation. Bettors get refunds.
        // If there are no voters (true here), you can choose how to treat collateral:
        // - distribute collateral to bettors (bonus) OR
        // - send fee then distribute rest to bettors OR
        // - burn/fee/return to bettors only. This implementation: fee + all remainder => bettors bonus pool.
        _cancel(CancelReason.NO_PROOF, Side.NONE);

        // Optional moderation
        betFactory.banCreator(creator);
    }

    // ======== VOTING ========

    function vote(Side v) external nonReentrant {
        require(_status == Status.VOTING, "Invalid status");
        require(block.timestamp < details.votingDeadline, "Voting closed");
        require(v == Side.YES || v == Side.NO || v == Side.INVALID, "Bad vote");
        require(msg.sender != creator, "Creator cannot vote");

        // voters must not be bettors
        Participant memory p = participants[msg.sender];
        require(p.yesStake == 0 && p.noStake == 0, "Bettors cannot vote");

        VoterInfo storage info = voters[msg.sender];
        require(info.vote == Side.NONE, "Already voted");

        require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust too low");

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

        // Minimum votes gate
        //uint256 totalVotes = yesVotes + noVotes + invalidVotes;
        if (totalVotes < details.minimumVotes) {
            _cancel(CancelReason.INSUFFICIENT_VOTES, Side.NONE);
            betFactory.factoryLogBetCompletion(creator,uint8(_status));
            return;
        }

        // If INVALID wins (strict plurality), we CANCEL with reason VOTE_INVALID
        if (invalidVotes > yesVotes && invalidVotes > noVotes) {
            _cancel(CancelReason.VOTE_INVALID, Side.INVALID);
            betFactory.factoryLogBetCompletion(creator,uint8(_status));
            return;
        }

        // Normal outcome
        if (yesVotes > noVotes) {
            _complete(Side.YES);
        } else if (noVotes > yesVotes) {
            _complete(Side.NO);
        } else {
            _cancel(CancelReason.TIE, Side.NONE);
        }

        betFactory.factoryLogBetCompletion(creator,uint8(_status));
    }

    // ======== FINALIZATION (SNAPSHOT) ========

    function _complete(Side win) internal {
        _status = Status.COMPLETED;
        cancelReason = CancelReason.NONE;
        outcomeSide = win;
        _snapshot();
        emit StatusChanged(_status, cancelReason, outcomeSide);
        betFactory.notifyBetStatusChange(address(this),uint8(_status),"Bet completed");
    }

    function _cancel(CancelReason reason, Side outcome) internal {
        _status = Status.CANCELLED;
        cancelReason = reason;
        outcomeSide = outcome; // only meaningful for VOTE_INVALID (INVALID), else NONE
        _snapshot();
        emit StatusChanged(_status, cancelReason, outcomeSide);
        betFactory.notifyBetStatusChange(address(this),uint8(_status),"Bet cancelled");
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
     * Bettors:
     * - COMPLETED: winning bettors get stake + share of net losing pool
     * - CANCELLED: everyone gets refund of their stake (+ possible bonus from collateral pools)
     */
    function claimBettor() external nonReentrant {
        require(snapshotted, "Not finalized");
        Participant storage p = participants[msg.sender];
        require(!p.claimed, "Already claimed");

        uint256 userYes = p.yesStake;
        uint256 userNo  = p.noStake;
        require(userYes > 0 || userNo > 0, "Not a bettor");

        p.claimed = true;

        uint256 payoutUsdc = 0;

        if (_status == Status.COMPLETED) {
            uint256 userWin = (outcomeSide == Side.YES) ? userYes : userNo;
            require(userWin > 0, "Not winner");

            payoutUsdc = userWin + (snapNetLosingPoolUsdc * userWin) / snapWinningBettorTotalStake;

        } else {
            // CANCELLED => full refund
            uint256 refund = userYes + userNo;
            payoutUsdc = refund;

            // optional bonus from collateral pools
            uint256 totalStakes = snapTotalYesStake + snapTotalNoStake;
            if (totalStakes > 0) {
                uint256 bonusPool = snapBettorRefundBonusPoolUsdc;

                if (bonusPool > 0) {
                    uint256 userStake = userYes + userNo;
                    payoutUsdc += (bonusPool * userStake) / totalStakes;
                }
            }
        }

        if (payoutUsdc > 0) {
            betFactory.transferInternalUsdc(address(this), msg.sender, payoutUsdc, "Bettor claim");
        }

        emit BettorClaimed(msg.sender, payoutUsdc);
    }

    /**
     * Voters:
     * - Always: if you voted, you can claim your outcome-based PROOF + any USDC reward
     *
     * COMPLETED:
     * - Correct voters: get PROOF stake back + share of forfeited PROOF (wrong voters)
     * - Correct voters: also split USDC voterRewardPool (from losing bettors)
     * - Wrong voters: get nothing (stake forfeited)
     *
     * CANCELLED (VOTE_INVALID):
     * - INVALID voters: get PROOF stake back + share of forfeited PROOF (YES+NO voters)
     * - INVALID voters: also split snapInvalidVoterBonusPoolUsdc (from collateral split)
     * - YES/NO voters: forfeit PROOF stake
     *
     * Other CANCELLED:
     * - Voters get PROOF stake back (no USDC rewards)
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
                // refund stake
                proofOut += v.stakeProof;

                // share forfeited PROOF proportionally by voter stake
                uint256 winnersStakeTotal = (outcomeSide == Side.YES) ? snapTotalYesProofStake : snapTotalNoProofStake;
                uint256 forfeitedProof = snapInvalidLosingVoterTotalStakeProof; // stored as forfeitedProof for completed
                if (winnersStakeTotal > 0 && forfeitedProof > 0) {
                    proofOut += (forfeitedProof * v.stakeProof) / winnersStakeTotal;
                }

                // USDC reward from losing bettors pool (split equally or proportionally)
                uint256 winnersCount = (outcomeSide == Side.YES) ? yesVotes : noVotes;
                
                if (winnersCount > 0 && snapVoterRewardPoolUsdc > 0) {
                    usdcOut += snapVoterRewardPoolUsdc / winnersCount;
                }
            } // else: wrong voters get nothing

        } else {
            // CANCELLED
            if (cancelReason == CancelReason.VOTE_INVALID && outcomeSide == Side.INVALID) {
                // Only INVALID voters win here
                if (v.vote == Side.INVALID) {
                    proofOut += v.stakeProof;

                    // share forfeited proof from YES+NO voters
                    if (snapInvalidWinningVoterTotalStakeProof > 0 ) {
                        proofOut += snapInvalidLosingVoterTotalStakeProof /invalidVotes;
                    }

                    // share collateral bonus for voters (proportional by stake)
                    if (snapInvalidWinningVoterTotalStakeProof > 0 && snapInvalidVoterBonusPoolUsdc > 0) {
                        usdcOut += snapInvalidVoterBonusPoolUsdc/invalidVotes ;
                    }
                }
                // YES/NO voters: forfeit proof stake (nothing to claim)

            } else {
                // Normal cancellations => refund PROOF stake
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
    function claimCreatorCollateral() external nonReentrant {
        require(msg.sender == creator, "Only creator");
        require(snapshotted, "Not finalized");
        require(creatorCollateral > 0, "No colletoral to claim");

    
        uint256 amount = creatorCollateral;
     

        // prevent double-claim
       creatorCollateral = 0;

        betFactory.transferInternalUsdc(
            address(this),
            creator,
            amount,
            "Creator collateral claim"
        );
         
    }


    // ======== VIEW HELPERS ========

   function getResolutionInfo()
        external
        view
 returns (ResolutionInfo memory info)
    {
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
