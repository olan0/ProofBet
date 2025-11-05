// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TrustScore.sol";
import "./BetFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Bet
 * @dev Individual prediction market contract using internal wallet system.
 */
contract Bet is ReentrancyGuard {
    enum Status {
        OPEN_FOR_BETS,
        AWAITING_PROOF,
        VOTING,
        COMPLETED,
        CANCELLED
    }
    enum Side {
        NONE,
        YES,
        NO
    }

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
    }

    struct Participant {
        uint256 yesStake;
        uint256 noStake;
        bool hasWithdrawn;
    }

    BetDetails public details;
    address public creator;
    BetFactory public immutable betFactory;
    TrustScore public immutable trustScoreContract;
    IERC20 public immutable usdcToken;
    IERC20 public immutable proofToken;
    address public immutable feeCollector;

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

    // ======== EVENTS ========

    event BetPlaced(address indexed user, Side position, uint256 amountUsdc);
    event ProofSubmitted(address indexed creator, string proofUrl);
    event VoteCast(address indexed voter, Side vote, uint256 amountProof);
    event BetResolved(Side winningSide);
    event BetCancelled(string reason);
    event FundsWithdrawn(address indexed user, uint256 amountUsdc, uint256 amountProof);

    event BetResolvedSnapshot(
        Side winningSide,
        uint256 totalWinningStake,
        uint256 totalLosingStake,
        uint256 platformFeeAmount,
        uint256 voterRewardPool,
        uint256 winnersPool,
        uint256 winningVoterCount,
        uint256 rewardPerWinningVoter
    );

    // ======== MODIFIERS ========

    modifier onlyCreator() {
        require(msg.sender == creator, "Not creator");
        _;
    }

    modifier atStatus(Status _status) {
        require(_currentStatus == _status, "Invalid status");
        _;
    }

    // ======== CONSTRUCTOR ========

    constructor(
        BetDetails memory _details,
        address _creator,
        address _betFactory,
        address _trustScore,
        address _usdcToken,
        address _proofToken,
        address _feeCollector
    ) {
        require(
            _creator != address(0) &&
                _betFactory != address(0) &&
                _trustScore != address(0) &&
                _usdcToken != address(0) &&
                _proofToken != address(0) &&
                _feeCollector != address(0),
            "Zero address"
        );

        require(
            _details.bettingDeadline < _details.proofDeadline &&
                _details.proofDeadline < _details.votingDeadline,
            "Bad deadlines"
        );

        details = _details;
        creator = _creator;
        betFactory = BetFactory(_betFactory);
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken);
        feeCollector = _feeCollector;
        _currentStatus = Status.OPEN_FOR_BETS;
    }

    // ======== VIEW FUNCTIONS ========

    function currentStatus() public view returns (Status) {
        return _currentStatus;
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
            uint256 participantsCount,
            uint256 voters
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
            participantCount,
            totalVotes
        );
    }

    function getVoteStats()
        external
        view
        returns (uint256 totalYesVotes, uint256 totalNoVotes, uint256 totalVoteStake)
    {
        return (yesVotes, noVotes, totalVoteStakeProof);
    }

    // ======== CORE ========

    function placeBet(Side _position, uint256 _amountUsdc)
        external
        nonReentrant
        atStatus(Status.OPEN_FOR_BETS)
    {
        require(block.timestamp < details.bettingDeadline, "Betting closed");
        require(_position == Side.YES || _position == Side.NO, "Invalid side");
        require(_amountUsdc >= details.minimumBetAmount, "Stake too low");

        if (details.minimumTrustScore > 0) {
            require(
                trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore,
                "Trust too low"
            );
        }

        (uint256 userUsdcBalance, ) = betFactory.getInternalBalances(msg.sender);
        require(userUsdcBalance >= _amountUsdc, "Insufficient USDC");

        betFactory.transferInternalUsdc(msg.sender, address(this), _amountUsdc, "Bet placement");

        if (!hasParticipated[msg.sender]) {
            hasParticipated[msg.sender] = true;
            participantCount++;
        }

        Participant storage p = participants[msg.sender];
        if (_position == Side.YES) {
            p.yesStake += _amountUsdc;
            totalYesStake += _amountUsdc;
        } else {
            p.noStake += _amountUsdc;
            totalNoStake += _amountUsdc;
        }

        betFactory.factoryLogBetParticipation(msg.sender);
        emit BetPlaced(msg.sender, _position, _amountUsdc);
    }

    function submitProof(string memory _proofUrl)
        external
        onlyCreator
        atStatus(Status.AWAITING_PROOF)
    {
        require(block.timestamp >= details.bettingDeadline, "Betting still open");
        require(block.timestamp < details.proofDeadline, "Proof deadline passed");
        require(bytes(_proofUrl).length > 0, "Empty proof");
        proofUrl = _proofUrl;
        _currentStatus = Status.VOTING;
        emit ProofSubmitted(creator, _proofUrl);
    }

    function vote(Side _vote) external nonReentrant atStatus(Status.VOTING) {
        require(block.timestamp < details.votingDeadline, "Voting closed");
        require(_vote == Side.YES || _vote == Side.NO, "Invalid vote");
        require(
            participants[msg.sender].yesStake == 0 && participants[msg.sender].noStake == 0,
            "Bettors cannot vote"
        );
        require(!voted[msg.sender], "Already voted");
        require(
            trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore,
            "Trust too low"
        );

        uint256 stakeAmt = betFactory.voteStakeAmountProof();
        (, uint256 userProofBalance) = betFactory.getInternalBalances(msg.sender);
        require(userProofBalance >= stakeAmt, "Insufficient PROOF");

        betFactory.transferInternalProof(msg.sender, address(this), stakeAmt, "Vote stake");

        voted[msg.sender] = true;
        votes[msg.sender] = _vote;
        voterStakesProof[msg.sender] += stakeAmt;
        totalVoteStakeProof += stakeAmt;
        totalVotes++;

        if (_vote == Side.YES) yesVotes++;
        else noVotes++;

        betFactory.factoryLogVote(msg.sender);
        emit VoteCast(msg.sender, _vote, stakeAmt);
    }

    // ======== KEEPERS ========

    function checkAndCloseBetting() external {
        if (_currentStatus == Status.OPEN_FOR_BETS && block.timestamp >= details.bettingDeadline) {
            if (totalYesStake >= details.minimumSideStake && totalNoStake >= details.minimumSideStake)
            {
                _currentStatus = Status.AWAITING_PROOF;
            } else {
                _currentStatus = Status.CANCELLED;
                betFactory.factoryLogBetCompletion(creator);
                emit BetCancelled("Minimum side stake not met");
            }
        }
    }

    function checkAndCancelForProof() external {
        if (_currentStatus == Status.AWAITING_PROOF && block.timestamp >= details.proofDeadline) {
            _currentStatus = Status.CANCELLED;
            betFactory.factoryLogBetCompletion(creator);
            emit BetCancelled("Proof deadline missed");
        }
    }

    function checkAndResolve() external nonReentrant {
        if (_currentStatus == Status.VOTING && block.timestamp >= details.votingDeadline) {
            if (totalVotes < details.minimumVotes) {
                _currentStatus = Status.CANCELLED;
                emit BetCancelled("Insufficient public votes");
            } else {
                if (yesVotes > noVotes) {
                    winningSide = Side.YES;
                    _currentStatus = Status.COMPLETED;
                    emit BetResolved(winningSide);
                } else if (noVotes > yesVotes) {
                    winningSide = Side.NO;
                    _currentStatus = Status.COMPLETED;
                    emit BetResolved(winningSide);
                } else {
                    _currentStatus = Status.CANCELLED;
                    emit BetCancelled("Vote tie");
                }
            }
            betFactory.factoryLogBetCompletion(creator);
            withdrawFunds();

            if (_currentStatus == Status.COMPLETED) {
                (
                    ,
                    ,
                    uint256 totalWinningStake,
                    uint256 totalLosingStake,
                    ,
                    ,
                    uint256 platformFeeAmount,
                    uint256 voterRewardPool,
                    uint256 winnersPool,
                    uint256 winningVoterCount,
                    uint256 rewardPerWinningVoter
                ) = this.getResolutionInfo();

                emit BetResolvedSnapshot(
                    winningSide,
                    totalWinningStake,
                    totalLosingStake,
                    platformFeeAmount,
                    voterRewardPool,
                    winnersPool,
                    winningVoterCount,
                    rewardPerWinningVoter
                );
            }
        }
    }

    // ======== INTERNAL DISTRIBUTION ========

    function withdrawFunds() internal {
        require(
            _currentStatus == Status.COMPLETED || _currentStatus == Status.CANCELLED,
            "Bet not finished"
        );
        require(!fundsDistributed, "Already distributed");

        if (_currentStatus == Status.COMPLETED) distributeWinnings();
        else refundAll();
    }

    function distributeWinnings() internal {
        fundsDistributed = true;

        uint256 totalWinning = (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        uint256 totalLosing = (winningSide == Side.YES) ? totalNoStake : totalYesStake;
        require(totalWinning > 0, "No stakes to distribute");

        uint256 platformFeeAmount =
            (totalLosing * betFactory.defaultPlatformFeePercentage()) / 100;
        if (platformFeeAmount > 0) {
            betFactory.transferInternalUsdc(address(this), feeCollector, platformFeeAmount, "Platform fee");
        }

        uint256 losingVoterCount = (winningSide == Side.YES) ? noVotes : yesVotes;
        if (losingVoterCount > 0) {
            uint256 losingProof = losingVoterCount * betFactory.voteStakeAmountProof();
            if (losingProof > 0) {
                betFactory.transferInternalProof(address(this), address(betFactory), losingProof, "Voter losing stake");
            }
        }
    }

    function refundAll() internal {
        fundsDistributed = true;
    }

    // ======== CLAIM FUNCTIONS ========

    function claimWinnings() external nonReentrant {
        require(_currentStatus == Status.COMPLETED, "Not completed");
        require(fundsDistributed, "Not distributed");

        Participant storage p = participants[msg.sender];
        require(p.yesStake > 0 || p.noStake > 0, "No participation");
        require(!p.hasWithdrawn, "Already withdrawn");

        uint256 participantWinningStake =
            (winningSide == Side.YES) ? p.yesStake : p.noStake;
        require(participantWinningStake > 0, "Not winner");

        uint256 totalWinningStake =
            (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        uint256 totalLosingStake =
            (winningSide == Side.YES) ? totalNoStake : totalYesStake;

        uint256 voterRewardAmount =
            (totalLosingStake * betFactory.defaultVoterRewardPercentage()) / 100;
        uint256 platformFeeAmount =
            (totalLosingStake * betFactory.defaultPlatformFeePercentage()) / 100;
        uint256 netPool = totalLosingStake - voterRewardAmount - platformFeeAmount;

        uint256 payout =
            participantWinningStake +
            (netPool * participantWinningStake) / totalWinningStake;

        p.hasWithdrawn = true;
        if (payout > 0) {
            betFactory.transferInternalUsdc(address(this), msg.sender, payout, "Bet winnings");
        }
        emit FundsWithdrawn(msg.sender, payout, 0);
    }

    function claimVoterRewards() external nonReentrant {
        require(
            _currentStatus == Status.COMPLETED || _currentStatus == Status.CANCELLED,
            "Not finished"
        );
        require(voted[msg.sender], "Not voted");
        require(voterStakesProof[msg.sender] > 0, "No stake");

        uint256 proofToReturn;
        uint256 usdcReward;
        uint256 originalStake = voterStakesProof[msg.sender];
        voterStakesProof[msg.sender] = 0;

        if (_currentStatus == Status.COMPLETED) {
            bool votedCorrect = (votes[msg.sender] == winningSide);
            if (votedCorrect) {
                proofToReturn = originalStake;
                uint256 totalLosingStake =
                    (winningSide == Side.YES) ? totalNoStake : totalYesStake;
                uint256 rewardPool =
                    (totalLosingStake * betFactory.defaultVoterRewardPercentage()) / 100;
                uint256 winners =
                    (winningSide == Side.YES) ? yesVotes : noVotes;
                if (rewardPool > 0 && winners > 0) {
                    usdcReward = rewardPool / winners;
                }
            }
        } else {
            proofToReturn = originalStake;
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
        require(_currentStatus == Status.CANCELLED, "Not cancelled");
        Participant storage p = participants[msg.sender];
        require(!p.hasWithdrawn, "Already withdrawn");

        uint256 refund = p.yesStake + p.noStake;
        require(refund > 0, "No refund");

        p.hasWithdrawn = true;
        betFactory.transferInternalUsdc(address(this), msg.sender, refund, "Bet refund");
        emit FundsWithdrawn(msg.sender, refund, 0);
    }

    // ======== ANALYTICS ========

    function getResolutionInfo()
        external
        view
        returns (
            Status status,
            Side winningSide_,
            uint256 totalWinningStake,
            uint256 totalLosingStake,
            uint256 platformFeePct,
            uint256 voterRewardPct,
            uint256 platformFeeAmount,
            uint256 voterRewardPool,
            uint256 winnersPool,
            uint256 winningVoterCount,
            uint256 rewardPerWinningVoter
        )
    {
        status = _currentStatus;
        winningSide_ = winningSide;

        if (_currentStatus != Status.COMPLETED) {
            return (
                status,
                winningSide_,
                0,
                0,
                betFactory.defaultPlatformFeePercentage(),
                betFactory.defaultVoterRewardPercentage(),
                0,
                0,
                0,
                0,
                0
            );
        }

        totalWinningStake = (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        totalLosingStake = (winningSide == Side.YES) ? totalNoStake : totalYesStake;

        platformFeePct = betFactory.defaultPlatformFeePercentage();
        voterRewardPct = betFactory.defaultVoterRewardPercentage();

        platformFeeAmount = (totalLosingStake * platformFeePct) / 100;
        voterRewardPool = (totalLosingStake * voterRewardPct) / 100;
        winnersPool = totalLosingStake - platformFeeAmount - voterRewardPool;
        winningVoterCount = (winningSide == Side.YES) ? yesVotes : noVotes;
        rewardPerWinningVoter =
            (winningVoterCount > 0) ? voterRewardPool / winningVoterCount : 0;
    }

    function calculateParticipantPayout(address _participant)
        public
        view
        returns (uint256 payout, bool isWinner)
    {
        if (_currentStatus != Status.COMPLETED) return (0, false);
        Participant memory p = participants[_participant];
        if (p.hasWithdrawn || (p.yesStake == 0 && p.noStake == 0)) return (0, false);

        if (winningSide == Side.YES && p.yesStake > 0) isWinner = true;
        else if (winningSide == Side.NO && p.noStake > 0) isWinner = true;
        else return (0, false);

        uint256 stake = (winningSide == Side.YES) ? p.yesStake : p.noStake;
        uint256 totalWinning = (winningSide == Side.YES) ? totalYesStake : totalNoStake;
        uint256 totalLosing = (winningSide == Side.YES) ? totalNoStake : totalYesStake;
        uint256 voterRewardPct = betFactory.defaultVoterRewardPercentage();
        uint256 platformFeePct = betFactory.defaultPlatformFeePercentage();
        uint256 voterRewardAmt = (totalLosing * voterRewardPct) / 100;
        uint256 platformFeeAmt = (totalLosing * platformFeePct) / 100;
        uint256 netPool = totalLosing - voterRewardAmt - platformFeeAmt;

        payout = stake + (netPool * stake) / totalWinning;
    }

    function calculateVoterReward(address _voter)
        public
        view
        returns (uint256 usdcReward, uint256 proofRefund)
    {
        if (!voted[_voter] || voterStakesProof[_voter] == 0) {
            return (0, 0);
        }

        uint256 originalProofStake = voterStakesProof[_voter];
        proofRefund = originalProofStake; // default refund for cancel or win

        if (_currentStatus == Status.CANCELLED) {
            return (0, proofRefund);
        }

        if (_currentStatus != Status.COMPLETED) {
            return (0, 0);
        }

        bool votedCorrectly = (votes[_voter] == winningSide);
        if (!votedCorrectly) {
            proofRefund = 0; // losing voters forfeit proof
            return (0, 0);
        }

        uint256 totalLosingStake =
            (winningSide == Side.YES) ? totalNoStake : totalYesStake;
        uint256 totalVoterRewardPool =
            (totalLosingStake * betFactory.defaultVoterRewardPercentage()) / 100;
        uint256 winningVoterCount =
            (winningSide == Side.YES) ? yesVotes : noVotes;

        if (winningVoterCount > 0 && totalVoterRewardPool > 0) {
            usdcReward = totalVoterRewardPool / winningVoterCount;
        }
    }
}
