// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Bet.sol";
import "./TrustScore.sol";
import "./ProofToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BetFactory
 * @dev Creates bets by accepting a BetDetails struct to avoid stack too deep errors.
 */
contract BetFactory is Ownable {
    address[] public allBets;
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    ProofToken public proofToken;
    
    address public feeCollector;
    uint256 public creationFeeProof;
    uint256 public voteStakeAmountProof; // Centralized vote stake amount
    
    event BetCreated(address indexed betAddress, address indexed creator, string title);
    event FeeProcessed(address indexed user, uint256 totalFee, uint256 burned, uint256 kept);
    event VoteStakeAmountChanged(uint256 oldAmount, uint256 newAmount);
    
    constructor(
        address _trustScore,
        address _usdcToken,
        address _proofToken,
        address _feeCollector,
        uint256 _creationFeeProof,
        uint256 _initialVoteStakeAmountProof
    ) Ownable(msg.sender) {
        require(_initialVoteStakeAmountProof > 0, "Initial vote stake must be greater than 0");
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = ProofToken(_proofToken);
        feeCollector = _feeCollector;
        creationFeeProof = _creationFeeProof;
        voteStakeAmountProof = _initialVoteStakeAmountProof;

        // NOTE: The authorization call to ProofToken has been REMOVED from the constructor.
        // This is now handled as a post-deployment step in the Ignition script for
        // correctness and to avoid potential deployment errors.
    }
    
    /**
     * @dev Sets the global amount of PROOF tokens required for voting.
     */
    function setVoteStakeAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Vote stake must be greater than 0");
        uint256 oldAmount = voteStakeAmountProof;
        voteStakeAmountProof = _amount;
        emit VoteStakeAmountChanged(oldAmount, _amount);
    }

    /**
     * @dev Creates a new bet by taking a single struct parameter to avoid stack limit issues.
     * The creator address in the struct is ignored and set to msg.sender.
     * @param _details A struct containing all the bet's configuration parameters.
     */
    function createBet(Bet.BetDetails memory _details) external returns (address) {
        require(proofToken.balanceOf(msg.sender) >= creationFeeProof, "Insufficient PROOF");
        require(proofToken.allowance(msg.sender, address(this)) >= creationFeeProof, "PROOF allowance too low");
        
        // Transfer PROOF to this contract first for fee processing
        proofToken.transferFrom(msg.sender, address(this), creationFeeProof);
        
        // Process fee with burning mechanism
        (uint256 burnAmount, uint256 keepAmount) = proofToken.burnFromFees(address(this), creationFeeProof);
        
        emit FeeProcessed(msg.sender, creationFeeProof, burnAmount, keepAmount);
        
        // Ensure the creator is the message sender
        _details.creator = msg.sender;
        
        // Instantiate the new Bet contract
        Bet newBet = new Bet(
            _details,
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken),
            feeCollector,
            voteStakeAmountProof // Use the factory's global vote stake amount
        );
        address newBetAddress = address(newBet);
        allBets.push(newBetAddress);
        
        // Update the creator's trust score
        trustScoreContract.logBetCreation(msg.sender);
        
        emit BetCreated(newBetAddress, msg.sender, _details.title);
        return newBetAddress;
    }
    
    function setCreationFee(uint256 _newFee) external onlyOwner {
        creationFeeProof = _newFee;
    }
    
    function setFeeCollector(address _newCollector) external onlyOwner {
        feeCollector = _newCollector;
    }
    
    function getBets() external view returns (address[] memory) {
        return allBets;
    }
}