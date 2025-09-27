// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustScore
 * @dev Manages user reputation scores based on platform activity.
 * Scores are integers from 0 to 100.
 */
contract TrustScore is Ownable {
    mapping(address => uint8) public scores;
    mapping(address => bool) public authorizedContracts;

    // Points for various actions
    uint8 public constant CREATE_BET_POINTS = 2;
    uint8 public constant PARTICIPATE_POINTS = 1;
    uint8 public constant VOTE_POINTS = 1;
    uint8 public constant PENALTY_POINTS = 5; // e.g., for a cancelled bet

    event ScoreUpdated(address indexed user, uint8 oldScore, uint8 newScore);
    event ContractAuthorized(address indexed contractAddress, bool isAuthorized);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Not an authorized contract");
        _;
    }

    constructor() Ownable(msg.sender) {
        // The deployer is automatically authorized to perform initial setup
        authorizedContracts[msg.sender] = true;
    }

    /**
     * @dev Authorize or deauthorize a contract to update scores.
     */
    function authorizeContract(address _contractAddress, bool _isAuthorized) external onlyOwner {
        authorizedContracts[_contractAddress] = _isAuthorized;
        emit ContractAuthorized(_contractAddress, _isAuthorized);
    }

    /**
     * @dev Called by an authorized contract (e.g., BetFactory) when a user creates a bet.
     */
    function logBetCreation(address _creator) external onlyAuthorized {
        _increaseScore(_creator, CREATE_BET_POINTS);
    }

    /**
     * @dev Called by an authorized BetFactory contract when a user places a bet in any Bet.
     */
    function logBetParticipation(address _participant) external onlyAuthorized {
        _increaseScore(_participant, PARTICIPATE_POINTS);
    }

    /**
     * @dev Called by an authorized BetFactory contract when a user votes.
     */
    function logVote(address _voter) external onlyAuthorized {
        _increaseScore(_voter, VOTE_POINTS);
    }

    /**
     * @dev Called by an authorized contract when an action warrants a penalty.
     */
    function applyPenalty(address _user) external onlyAuthorized {
        _decreaseScore(_user, PENALTY_POINTS);
    }
    
    /**
     * @dev Get the current trust score for a user.
     */
    function getScore(address _user) public view returns (uint8) {
        return scores[_user];
    }

    /**
     * @dev Internal function to increase a user's score.
     */
    function _increaseScore(address _user, uint8 _points) internal {
        uint8 oldScore = scores[_user];
        if (oldScore + _points >= 100) {
            scores[_user] = 100;
        } else {
            scores[_user] = oldScore + _points;
        }
        emit ScoreUpdated(_user, oldScore, scores[_user]);
    }
    
    /**
     * @dev Internal function to decrease a user's score.
     */
    function _decreaseScore(address _user, uint8 _points) internal {
        uint8 oldScore = scores[_user];
        if (oldScore <= _points) {
            scores[_user] = 0;
        } else {
            scores[_user] = oldScore - _points;
        }
        emit ScoreUpdated(_user, oldScore, scores[_user]);
    }
}