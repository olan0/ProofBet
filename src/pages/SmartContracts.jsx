
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink } from "lucide-react";

export default function SmartContractsPage() {
  const contracts = [
    {
      name: "IERC20.sol",
      description: "Standard interface for ERC20 tokens (USDC and PROOF).",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}`
    },
    {
      name: "ProofToken.sol",
      description: "ERC20 platform token with inflation and burn mechanisms.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProofToken
 * @dev Platform token with controlled inflation and fee burning
 */
contract ProofToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    
    // Tokenomics parameters
    uint256 public annualInflationRate = 5; // 5% per year
    uint256 public feeBurnPercentage = 50; // 50% of fees burned
    uint256 public lastInflationMint;
    
    // Tracking
    uint256 public totalBurned;
    uint256 public totalMintedFromInflation;
    
    // Authorized contracts that can burn tokens
    mapping(address => bool) public authorizedBurners;
    
    event TokensBurned(address indexed from, uint256 amount, string reason);
    event InflationMinted(address indexed to, uint256 amount, uint256 year);
    event BurnerAuthorized(address indexed burner, bool authorized);
    event InflationRateChanged(uint256 oldRate, uint256 newRate);
    event BurnRateChanged(uint256 oldRate, uint256 newRate);
    
    modifier onlyAuthorizedBurner() {
        require(authorizedBurners[msg.sender], "Not authorized to burn");
        _;
    }
    
    constructor() ERC20("ProofBet Token", "PROOF") {
        // Mint initial supply to deployer
        _mint(msg.sender, 100000000 * 10**18); // 100 million tokens initially
        lastInflationMint = block.timestamp;
    }
    
    /**
     * @dev Mint tokens for annual inflation (only once per year)
     */
    function mintInflation(address recipient) external onlyOwner returns (uint256) {
        require(block.timestamp >= lastInflationMint + 365 days, "Inflation already minted this year");
        
        uint256 currentSupply = totalSupply();
        uint256 inflationAmount = (currentSupply * annualInflationRate) / 100;
        
        require(currentSupply + inflationAmount <= MAX_SUPPLY, "Would exceed max supply");
        
        _mint(recipient, inflationAmount);
        totalMintedFromInflation += inflationAmount;
        lastInflationMint = block.timestamp;
        
        emit InflationMinted(recipient, inflationAmount, getCurrentYear());
        return inflationAmount;
    }
    
    /**
     * @dev Burn tokens from fees (called by authorized contracts)
     * The 'sender' address must hold the 'totalFeeAmount' tokens.
     */
    function burnFromFees(address sender, uint256 totalFeeAmount) external onlyAuthorizedBurner returns (uint256 burnAmount, uint256 keepAmount) {
        burnAmount = (totalFeeAmount * feeBurnPercentage) / 100;
        keepAmount = totalFeeAmount - burnAmount;
        
        require(balanceOf(sender) >= totalFeeAmount, "ProofToken: Sender does not hold enough tokens for fee processing");

        if (burnAmount > 0) {
            _burn(sender, burnAmount);
            totalBurned += burnAmount;
            emit TokensBurned(sender, burnAmount, "Fee burn");
        }
        
        // Transfer remaining tokens to platform owner
        if (keepAmount > 0) {
            _transfer(sender, owner(), keepAmount);
        }
        
        return (burnAmount, keepAmount);
    }
    
    /**
     * @dev Manual burn function for users
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount, "Manual burn");
    }
    
    /**
     * @dev Set annual inflation rate (max 20%)
     */
    function setInflationRate(uint256 _rate) external onlyOwner {
        require(_rate <= 20, "Inflation rate too high");
        uint256 oldRate = annualInflationRate;
        annualInflationRate = _rate;
        emit InflationRateChanged(oldRate, _rate);
    }
    
    /**
     * @dev Set fee burn percentage (0-100%)
     */
    function setBurnRate(uint256 _rate) external onlyOwner {
        require(_rate <= 100, "Burn rate too high");
        uint256 oldRate = feeBurnPercentage;
        feeBurnPercentage = _rate;
        emit BurnRateChanged(oldRate, _rate);
    }
    
    /**
     * @dev Authorize/deauthorize contracts to burn tokens
     */
    function authorizeBurner(address burner, bool authorized) external onlyOwner {
        authorizedBurners[burner] = authorized;
        emit BurnerAuthorized(burner, authorized);
    }
    
    /**
     * @dev Get current year for inflation tracking
     */
    function getCurrentYear() public view returns (uint256) {
        // Simple year calculation based on epoch, not perfectly accurate for leap years but sufficient for conceptual inflation.
        return 1970 + (block.timestamp / (365 days));
    }
    
    /**
     * @dev Check if inflation can be minted
     */
    function canMintInflation() public view returns (bool) {
        return block.timestamp >= lastInflationMint + 365 days;
    }
    
    /**
     * @dev Get tokenomics summary
     */
    function getTokenomics() public view returns (
        uint256 currentSupply,
        uint256 maxSupply,
        uint256 burned,
        uint256 mintedFromInflation,
        uint256 inflationRate,
        uint256 burnRate
    ) {
        return (
            totalSupply(),
            MAX_SUPPLY,
            totalBurned,
            totalMintedFromInflation,
            annualInflationRate,
            feeBurnPercentage
        );
    }
}`
    },
    {
      name: "BetFactory.sol",  
      description: "Updated factory with automatic fee burning and centralized vote stake amount.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Bet.sol";
import "./TrustScore.sol";
import "./ProofToken.sol"; // Changed to ProofToken for burn functionality
import "./IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BetFactory
 * @dev Creates bets and handles fee burning, centralizes voting stake
 */
contract BetFactory is Ownable {
    address[] public allBets;
    TrustScore public trustScoreContract;
    IERC20 public usdcToken;
    ProofToken public proofToken; // Changed to ProofToken for burn functionality
    
    address public feeCollector; // Note: FeeCollector in ProofToken is the Owner. This will be the original fee recipient for the 'kept' portion.
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
        uint256 _initialVoteStakeAmountProof // NEW: Initial value for centralized vote stake
    ) Ownable(msg.sender) { // Explicitly initialize Ownable
        require(_initialVoteStakeAmountProof > 0, "Initial vote stake must be greater than 0");
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = ProofToken(_proofToken);
        feeCollector = _feeCollector;
        creationFeeProof = _creationFeeProof;
        voteStakeAmountProof = _initialVoteStakeAmountProof; // Assign initial value

        // Authorize this factory contract to burn tokens in the ProofToken contract
        // This relies on the deployer of BetFactory also being the owner of ProofToken,
        // or for ProofToken owner to authorize this contract separately.
        proofToken.authorizeBurner(address(this), true);
    }
    
    /**
     * @dev Sets the global amount of PROOF tokens required for voting.
     * Only callable by the contract owner.
     * @param _amount The new amount of PROOF tokens for vote stake.
     */
    function setVoteStakeAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Vote stake must be greater than 0");
        uint256 oldAmount = voteStakeAmountProof;
        voteStakeAmountProof = _amount;
        emit VoteStakeAmountChanged(oldAmount, _amount);
    }

    function createBet(
        string memory _title,
        string memory _description,
        uint256 _bettingDeadline,
        uint256 _proofDeadline,
        uint256 _votingDeadline,
        uint256 _minimumBetAmount,
        uint256 _minimumSideStake,
        // Removed: uint256 _voteStakeAmountProof, // This is now taken from the factory's state
        uint8 _minimumTrustScore,
        uint8 _voterRewardPercentage,
        uint8 _platformFeePercentage
    ) external returns (address) {
        require(proofToken.balanceOf(msg.sender) >= creationFeeProof, "Insufficient PROOF");
        require(proofToken.allowance(msg.sender, address(this)) >= creationFeeProof, "PROOF allowance too low");
        
        // Transfer PROOF to this contract first (BetFactory holds the fee tokens temporarily)
        proofToken.transferFrom(msg.sender, address(this), creationFeeProof);
        
        // Process fee with burning. ProofToken will burn a portion from BetFactory's balance
        // and transfer the remaining portion to ProofToken's owner (the platform's main address).
        (uint256 burnAmount, uint256 keepAmount) = proofToken.burnFromFees(address(this), creationFeeProof);
        
        emit FeeProcessed(msg.sender, creationFeeProof, burnAmount, keepAmount);
        
        // Create bet
        Bet.BetDetails memory details = Bet.BetDetails({
            creator: msg.sender,
            title: _title,
            description: _description,
            bettingDeadline: _bettingDeadline,
            proofDeadline: _proofDeadline,
            votingDeadline: _votingDeadline,
            minimumBetAmount: _minimumBetAmount,
            minimumSideStake: _minimumSideStake,
            // Removed: voteStakeAmountProof: _voteStakeAmountProof,
            minimumTrustScore: _minimumTrustScore,
            voterRewardPercentage: _voterRewardPercentage,
            platformFeePercentage: _platformFeePercentage
        });
        
        // Pass the factory's global voteStakeAmountProof to the Bet constructor
        Bet newBet = new Bet(
            details,
            address(trustScoreContract),
            address(usdcToken),
            address(proofToken),
            feeCollector,
            voteStakeAmountProof // NEW: Pass the centralized vote stake amount
        );
        address newBetAddress = address(newBet);
        allBets.push(newBetAddress);
        
        trustScoreContract.logBetCreation(msg.sender);
        
        emit BetCreated(newBetAddress, msg.sender, _title);
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
}`
    },
    {
      name: "Bet.sol",
      description: "Individual prediction market using USDC for betting and PROOF for voting fees. Now uses centralized vote stake.",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TrustScore.sol";
import "./IERC20.sol";

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
        // Removed: uint256 voteStakeAmountProof; // This is now a direct state variable of Bet
        uint8 minimumTrustScore;
        uint8 voterRewardPercentage;
        uint8 platformFeePercentage;
    }

    struct Participant {
        uint252 yesStake; // In USDC
        uint252 noStake;  // In USDC
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
    uint256 public voteStakeAmountProof; // NEW: Bet's specific vote stake amount, set at creation
    string public proofUrl;
    Side public winningSide;
    bool public fundsDistributed;

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
        uint256 _voteStakeAmountProof // NEW: Parameter for vote stake amount
    ) {
        details = _details;
        trustScoreContract = TrustScore(_trustScore);
        usdcToken = IERC20(_usdcToken);
        proofToken = IERC20(_proofToken);
        feeCollector = _feeCollector;
        voteStakeAmountProof = _voteStakeAmountProof; // Assign the value passed from the factory
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
        emit ProofSubmitted(msg.sender, _proofUrl);
    }

    function vote(Side _vote) external nonReentrant atStatus(Status.VOTING) {
        require(block.timestamp < details.votingDeadline, "Voting has closed");
        require(_vote == Side.YES || _vote == Side.NO, "Invalid vote");
        require(participants[msg.sender].yesStake == 0 && participants[msg.sender].noStake == 0, "Bettors cannot vote");
        require(!voted[msg.sender], "Already voted");
        require(trustScoreContract.getScore(msg.sender) >= details.minimumTrustScore, "Trust score too low");
        require(proofToken.balanceOf(msg.sender) >= voteStakeAmountProof, "Insufficient PROOF for vote stake"); // Uses new state variable
        require(proofToken.allowance(msg.sender, address(this)) >= voteStakeAmountProof, "PROOF allowance too low for vote stake"); // Uses new state variable

        // Take PROOF tokens as voting stake
        proofToken.transferFrom(msg.sender, address(this), voteStakeAmountProof); // Uses new state variable
        
        voted[msg.sender] = true;
        votes[msg.sender] = _vote;
        voterStakesProof[msg.sender] += voteStakeAmountProof; // Uses new state variable
        totalVoteStakeProof += voteStakeAmountProof; // Uses new state variable

        trustScoreContract.logVote(msg.sender);
        emit VoteCast(msg.sender, _vote, voteStakeAmountProof); // Uses new state variable
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
            uint yesVotes;
            uint noVotes;
            // This part is simplified; in a real contract, you'd iterate through voters
            // which is an anti-pattern. A better design would be needed for large scale.
            // For now, assume vote counting is feasible or done off-chain and verified.
            // A real implementation needs a secure way to tally votes.
            // Here we just set a placeholder winner.
            winningSide = Side.YES; // Placeholder
            currentStatus = Status.COMPLETED;
            emit BetResolved(winningSide);
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
        // Simplified logic. Real version needs to handle voters, platform fee etc.
        // It would also need to handle both USDC and PROOF token transfers.
        uint252 totalStake = totalYesStake + totalNoStake;
        Side losingSide = winningSide == Side.YES ? Side.NO : Side.YES;
        
        uint252 totalWinningStake = winningSide == Side.YES ? totalYesStake : totalNoStake;
        uint252 totalLosingStake = losingSide == Side.YES ? totalYesStake : totalNoStake;

        // In a real contract, iterate through participants and pay them out
        // This is a simplified payout for the first participant for demonstration
        // A pull-based withdrawal pattern is strongly recommended over this push-based loop
    }
    
    function refundAll() internal {
        fundsDistributed = true;
        // Simplified logic. A pull-based withdrawal is better.
        // This function would need to refund both USDC to bettors and PROOF to voters.
    }
}`
    },
    {
        name: "Deployment Instructions",
        description: "Complete deployment guide for dual-token ProofBet system.",
        code: `// 1. Prerequisites:
//    - Deploy USDC contract or use existing (mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
//    - Deploy ProofToken contract first
//    - Have sufficient ETH for gas fees

// 2. Deployment Script (scripts/deploy.js):
/*
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Known USDC address (or deploy your own for testnets)
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
  
  // Deploy PROOF token
  const ProofToken = await hre.ethers.getContractFactory("ProofToken");
  const proofToken = await ProofToken.deploy();
  await proofToken.deployed();
  console.log("ProofToken deployed to:", proofToken.address);

  // Deploy TrustScore
  const TrustScore = await hre.ethers.getContractFactory("TrustScore");
  const trustScore = await TrustScore.deploy();
  await trustScore.deployed();
  console.log("TrustScore deployed to:", trustScore.address);

  // Deploy BetFactory
  const BetFactory = await hre.ethers.getContractFactory("BetFactory");
  const betFactory = await BetFactory.deploy(
    trustScore.address,     // TrustScore contract
    USDC_ADDRESS,          // USDC token for betting
    proofToken.address,    // PROOF token for fees
    deployer.address,      // Fee collector (address to receive the 'kept' portion of PROOF tokens)
    ethers.utils.parseEther("100"), // 100 PROOF tokens creation fee
    ethers.utils.parseEther("10")   // NEW: 10 PROOF tokens initial vote stake amount, centralized in factory
  );
  await betFactory.deployed();
  console.log("BetFactory deployed to:", betFactory.address);
  
  // Authorize contracts
  await trustScore.authorizeContract(betFactory.address, true);
  console.log("BetFactory authorized in TrustScore");

  // BetFactory constructor now automatically calls proofToken.authorizeBurner(address(this), true);
  // so no separate authorization for burning is needed here for BetFactory.

  // Optional: Distribute initial PROOF tokens to early users
  // await proofToken.transfer(userAddress, ethers.utils.parseEther("1000"));
  
  console.log("\\n=== Deployment Summary ===");
  console.log("ProofToken:", proofToken.address);
  console.log("TrustScore:", trustScore.address);
  console.log("BetFactory:", betFactory.address);
  console.log("USDC Address:", USDC_ADDRESS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
*/

// 3. Frontend Integration:
//    - Users need both USDC and PROOF token approvals
//    - USDC for betting (placeBet function)
//    - PROOF for creating bets and voting
//    - Show both token balances in wallet UI
//    - Implement dual-token deposit system

// 4. Token Distribution Strategy:
//    - Airdrop PROOF to early users
//    - Reward PROOF for platform activities
//    - Allow purchasing PROOF with ETH/USDC
//    - Implement staking rewards for PROOF holders

// 5. Run Deployment:
//    npx hardhat run scripts/deploy.js --network your_network`
    }
  ];

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">ProofBet Smart Contracts</h1>
        <p className="text-gray-400 mb-8">
          This page contains the full Solidity code for the ProofBet protocol, designed to run on the Ethereum blockchain using USDC as the primary currency. Since the current platform does not support direct smart contract deployment, you can copy this code to use in a standard Web3 development environment like Hardhat or Remix.
        </p>
        
        <div className="space-y-8">
          {contracts.map((contract) => (
            <Card key={contract.name} className="bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-cyan-400">{contract.name}</CardTitle>
                  <p className="text-gray-400">{contract.description}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(contract.code)}>
                  <Copy className="w-5 h-5" />
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 rounded-md p-4 overflow-x-auto text-sm">
                  <code>{contract.code}</code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
