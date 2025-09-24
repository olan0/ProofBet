// SPDX-License-Identifier: MIT
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
    
    constructor() ERC20("ProofBet Token", "PROOF") Ownable(msg.sender) {
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
}