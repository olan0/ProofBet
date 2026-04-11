// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TrustScore is Ownable {
    mapping(address => int16) public scores;
    mapping(address => uint256) public lastActivityTime;
    mapping(address => bool) public authorizedContracts;

    // Points for various actions
    int16 public constant CREATE_BET_POINTS  = 2;
    int16 public constant PARTICIPATE_POINTS = 1;
    int16 public constant VOTE_POINTS        = 1;
    int16 public constant PENALTY_POINTS     = 5;
    int16 public constant MAX_SCORE          = 100;
    int16 public banThreshold                = -20;

    // Decay: lose 1 point per 30 days of inactivity (only above 0)
    uint256 public constant DECAY_PERIOD         = 30 days;
    int16   public constant MAX_DECAY_PER_PERIOD = 1;

    event ScoreUpdated(address indexed user, int16 oldScore, int16 newScore);
    event ContractAuthorized(address indexed contractAddress, bool isAuthorized);
    event ScoreDecayed(address indexed user, int16 oldScore, int16 newScore, uint256 daysSinceActivity);
    event BanThresholdUpdated(int16 oldThreshold, int16 newThreshold);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Not an authorized contract");
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedContracts[msg.sender] = true;
    }

    // === CONFIGURATION ===

    function setBanThreshold(int16 _threshold) external onlyOwner {
        require(_threshold < 0, "Ban threshold must be negative");
        int16 old = banThreshold;
        banThreshold = _threshold;
        emit BanThresholdUpdated(old, _threshold);
    }

    // === AUTHORIZATION ===

    function authorizeContract(address _contractAddress, bool _isAuthorized) external onlyOwner {
        authorizedContracts[_contractAddress] = _isAuthorized;
        emit ContractAuthorized(_contractAddress, _isAuthorized);
    }

    // === SCORE UPDATES ===

    function logBetCreation(address _creator) external onlyAuthorized {
        _increaseScore(_creator, CREATE_BET_POINTS);
    }

    function logBetParticipation(address _participant) external onlyAuthorized {
        _increaseScore(_participant, PARTICIPATE_POINTS);
    }

    function logVote(address _voter) external onlyAuthorized {
        _increaseScore(_voter, VOTE_POINTS);
    }

    /// @notice Apply penalty. Returns true if the user crossed the ban threshold.
    function applyPenalty(address _user) external onlyAuthorized returns (bool hitBanThreshold) {
        if (_user == owner()) return false;
        _decreaseScore(_user, PENALTY_POINTS);
        return scores[_user] <= banThreshold;
    }

    // === VIEWS ===

    function getScore(address _user) public view returns (int16) {
        int16 baseScore = scores[_user];

        if (lastActivityTime[_user] == 0) return baseScore;

        uint256 elapsed = block.timestamp - lastActivityTime[_user];

        if (elapsed < DECAY_PERIOD) {
            return baseScore;
        }

        // Decay applies until banThreshold — even negative scores continue to decay
        if (baseScore <= banThreshold) return baseScore;

        int16 totalDecay = int16(int256(elapsed / DECAY_PERIOD)) * MAX_DECAY_PER_PERIOD;
        int16 decayed = baseScore - totalDecay;
        return decayed < banThreshold ? banThreshold : decayed;
    }

    function getUserTrustInfo(address _user)
        external
        view
        returns (int16 score, bool isAuthorized, uint256 daysSinceActivity)
    {
        score = getScore(_user);
        isAuthorized = authorizedContracts[_user];
        daysSinceActivity = lastActivityTime[_user] == 0
            ? 0
            : (block.timestamp - lastActivityTime[_user]) / DECAY_PERIOD;
    }

    // === INTERNAL SCORE MANAGEMENT ===

    function _increaseScore(address _user, int16 _points) private {
        int16 oldScore = getScore(_user); // applies decay
        int16 newScore = oldScore + _points;
        if (newScore > MAX_SCORE) newScore = MAX_SCORE;

        scores[_user] = newScore;
        lastActivityTime[_user] = block.timestamp;

        emit ScoreUpdated(_user, oldScore, newScore);
    }

    function _decreaseScore(address _user, int16 _points) private {
        int16 oldScore = scores[_user];
        int16 newScore = oldScore - _points;
        // No floor — allow going negative down to banThreshold and beyond

        scores[_user] = newScore;
        lastActivityTime[_user] = block.timestamp;

        emit ScoreUpdated(_user, oldScore, newScore);
    }

    // === ADMIN UTILITIES ===

    function resetScore(address _user) external onlyOwner {
        _resetScore(_user);
    }

    function resetScoreOnBan(address _user) external onlyAuthorized {
        int16 oldScore = scores[_user];
        scores[_user] = banThreshold;
        lastActivityTime[_user] = block.timestamp;
        emit ScoreUpdated(_user, oldScore, banThreshold);
    }

    function resetScoreOnUnban(address _user) external onlyAuthorized {
        _resetScore(_user);
    }

    function _resetScore(address _user) internal {
        int16 oldScore = scores[_user];
        scores[_user] = 0;
        lastActivityTime[_user] = block.timestamp;
        emit ScoreUpdated(_user, oldScore, 0);
    }

    function applyDecay(address _user) external {
        int16 oldScore = scores[_user];
        int16 newScore = getScore(_user);

        if (oldScore != newScore) {
            scores[_user] = newScore;
            uint256 periodsSinceActivity = (block.timestamp - lastActivityTime[_user]) / DECAY_PERIOD;
            emit ScoreDecayed(_user, oldScore, newScore, periodsSinceActivity);
        }
    }
}
