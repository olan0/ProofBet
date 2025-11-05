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
    uint8 public constant PENALTY_POINTS = 5;

    event ScoreUpdated(address indexed user, uint8 oldScore, uint8 newScore);
    event ContractAuthorized(address indexed contractAddress, bool isAuthorized);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Not an authorized contract");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Deployer authorized by default for initial setup
        authorizedContracts[msg.sender] = true;
    }

    // === AUTHORIZATION ===
    function authorizeContract(address _contractAddress, bool _isAuthorized) external onlyOwner {
        authorizedContracts[_contractAddress] = _isAuthorized;
        emit ContractAuthorized(_contractAddress, _isAuthorized);
    }

    // === SCORE UPDATES (CALLED BY FACTORY) ===
    function logBetCreation(address _creator) external onlyAuthorized {
        _increaseScore(_creator, CREATE_BET_POINTS);
    }

    function logBetParticipation(address _participant) external onlyAuthorized {
        _increaseScore(_participant, PARTICIPATE_POINTS);
    }

    function logVote(address _voter) external onlyAuthorized {
        _increaseScore(_voter, VOTE_POINTS);
    }

    function applyPenalty(address _user) external onlyAuthorized {
        if (_user == owner()) return; // skip owner safety
        _decreaseScore(_user, PENALTY_POINTS);
    }

    // === VIEWS ===
    function getScore(address _user) public view returns (uint8) {
        return scores[_user];
    }

    function getUserTrustInfo(address _user)
        external
        view
        returns (uint8 score, bool isAuthorized)
    {
        return (scores[_user], authorizedContracts[_user]);
    }

    // === INTERNAL SCORE MANAGEMENT ===
    function _increaseScore(address _user, uint8 _points) private {
        uint8 oldScore = scores[_user];
        uint8 newScore = oldScore + _points;
        if (newScore > 100) newScore = 100;
        scores[_user] = newScore;
        emit ScoreUpdated(_user, oldScore, newScore);
    }

    function _decreaseScore(address _user, uint8 _points) private {
        uint8 oldScore = scores[_user];
        uint8 newScore = oldScore > _points ? oldScore - _points : 0;
        scores[_user] = newScore;
        emit ScoreUpdated(_user, oldScore, newScore);
    }

    // === ADMIN UTILITIES ===
    function resetScore(address _user) external onlyOwner {
        uint8 oldScore = scores[_user];
        scores[_user] = 0;
        emit ScoreUpdated(_user, oldScore, 0);
    }
}
