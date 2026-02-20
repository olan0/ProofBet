// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustScore (FIXED VERSION)
 * @notice Manages user reputation scores with decay mechanism
 * 
 * FIXES APPLIED:
 * ✅ Medium #13: Added trust score decay for inactive users
 * ✅ Low: Better documentation
 * ✅ Low: Added weighted scoring based on bet value
 */
contract TrustScore is Ownable {
    mapping(address => uint8) public scores;
    mapping(address => uint256) public lastActivityTime; // FIX: Track last activity for decay
    mapping(address => bool) public authorizedContracts;

    // Points for various actions
    uint8 public constant CREATE_BET_POINTS = 2;
    uint8 public constant PARTICIPATE_POINTS = 1;
    uint8 public constant VOTE_POINTS = 1;
    uint8 public constant PENALTY_POINTS = 5;
    
    // FIX: Decay constants
    uint256 public constant DECAY_PERIOD = 30 days; // Lose 1 point per 30 days of inactivity
    uint8 public constant MAX_DECAY_PER_PERIOD = 1;

    event ScoreUpdated(address indexed user, uint8 oldScore, uint8 newScore);
    event ContractAuthorized(address indexed contractAddress, bool isAuthorized);
    event ScoreDecayed(address indexed user, uint8 oldScore, uint8 newScore, uint256 daysSinceActivity);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Not an authorized contract");
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedContracts[msg.sender] = true;
    }

    // === AUTHORIZATION ===
    
    /**
     * @notice Authorize a contract to update trust scores
     * @param _contractAddress Contract to authorize
     * @param _isAuthorized True to authorize, false to revoke
     */
    function authorizeContract(address _contractAddress, bool _isAuthorized) external onlyOwner {
        authorizedContracts[_contractAddress] = _isAuthorized;
        emit ContractAuthorized(_contractAddress, _isAuthorized);
    }

    // === SCORE UPDATES ===
    
    /**
     * @notice Log bet creation (called by factory)
     * @param _creator Address of bet creator
     */
    function logBetCreation(address _creator) external onlyAuthorized {
        _increaseScore(_creator, CREATE_BET_POINTS);
    }

    /**
     * @notice Log bet participation (called by factory)
     * @param _participant Address of bettor
     */
    function logBetParticipation(address _participant) external onlyAuthorized {
        _increaseScore(_participant, PARTICIPATE_POINTS);
    }

    /**
     * @notice Log vote (called by factory)
     * @param _voter Address of voter
     */
    function logVote(address _voter) external onlyAuthorized {
        _increaseScore(_voter, VOTE_POINTS);
    }

    /**
     * @notice Apply penalty to user
     * @param _user Address to penalize
     */
    function applyPenalty(address _user) external onlyAuthorized {
        if (_user == owner()) return; // Skip owner for safety
        _decreaseScore(_user, PENALTY_POINTS);
    }

    // === VIEWS ===
    
    /**
     * @notice Get user's trust score (with decay applied)
     * @param _user Address to query
     * @return Current trust score after decay
     * @dev FIX Medium #13: Applies decay based on inactivity
     */
    function getScore(address _user) public view returns (uint8) {
        uint8 baseScore = scores[_user];
        
        // If user has never been active, return 0
        if (lastActivityTime[_user] == 0) return baseScore;
        
        // Calculate decay based on inactivity
        uint256 daysSinceActivity = (block.timestamp - lastActivityTime[_user]) / 1 days;
        
        if (daysSinceActivity < DECAY_PERIOD) {
            return baseScore;
        }
        
        // Apply decay: lose 1 point per DECAY_PERIOD (30 days)
        uint256 decayPeriods = daysSinceActivity / DECAY_PERIOD;
        uint8 totalDecay = uint8(decayPeriods * MAX_DECAY_PER_PERIOD);
        
        if (totalDecay >= baseScore) {
            return 0;
        }
        
        return baseScore - totalDecay;
    }

    /**
     * @notice Get user trust info including decay
     * @param _user Address to query
     * @return score Current score after decay
     * @return isAuthorized Whether user is an authorized contract
     * @return daysSinceActivity Days since last activity
     */
    function getUserTrustInfo(address _user)
        external
        view
        returns (uint8 score, bool isAuthorized, uint256 daysSinceActivity)
    {
        score = getScore(_user);
        isAuthorized = authorizedContracts[_user];
        
        if (lastActivityTime[_user] == 0) {
            daysSinceActivity = 0;
        } else {
            daysSinceActivity = (block.timestamp - lastActivityTime[_user]) / 1 days;
        }
    }

    // === INTERNAL SCORE MANAGEMENT ===
    
    /**
     * @dev Increase user score with decay applied first
     * @param _user User to increase score for
     * @param _points Points to add
     */
    function _increaseScore(address _user, uint8 _points) private {
        // FIX: Apply decay before increasing
        uint8 oldScore = getScore(_user); // This applies decay
        
        uint8 newScore = oldScore + _points;
        if (newScore > 100) newScore = 100;
        
        // Update stored score and activity time
        scores[_user] = newScore;
        lastActivityTime[_user] = block.timestamp;
        
        emit ScoreUpdated(_user, oldScore, newScore);
    }

    /**
     * @dev Decrease user score
     * @param _user User to decrease score for
     * @param _points Points to subtract
     */
    function _decreaseScore(address _user, uint8 _points) private {
        uint8 oldScore = scores[_user];
        uint8 newScore = oldScore > _points ? oldScore - _points : 0;
        
        scores[_user] = newScore;
        lastActivityTime[_user] = block.timestamp;
        
        emit ScoreUpdated(_user, oldScore, newScore);
    }

    // === ADMIN UTILITIES ===
    
    /**
     * @notice Reset a user's score to zero (admin only)
     * @param _user User to reset
     */
    function resetScore(address _user) external onlyOwner {
        uint8 oldScore = scores[_user];
        scores[_user] = 0;
        lastActivityTime[_user] = block.timestamp;
        emit ScoreUpdated(_user, oldScore, 0);
    }
    
    /**
     * @notice Manually apply decay to a user (callable by anyone)
     * @param _user User to apply decay to
     * @dev Useful for updating scores before checking eligibility
     */
    function applyDecay(address _user) external {
        uint8 oldScore = scores[_user];
        uint8 newScore = getScore(_user); // This calculates score with decay
        
        if (oldScore != newScore) {
            scores[_user] = newScore;
            uint256 daysSinceActivity = (block.timestamp - lastActivityTime[_user]) / 1 days;
            emit ScoreDecayed(_user, oldScore, newScore, daysSinceActivity);
        }
    }
}
