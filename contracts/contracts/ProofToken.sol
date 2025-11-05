// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProofToken
 * @dev Platform token with controlled inflation and fee burning.
 * Designed for integration with the ProofBet ecosystem.
 */
contract ProofToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1 billion PROOF tokens

    // Tokenomics configuration
    uint256 public annualInflationRate = 5; // % per year
    uint256 public feeBurnPercentage = 50;  // % of fees burned
    uint256 public lastInflationMint;

    // Accounting
    uint256 public totalBurned;
    uint256 public totalMintedFromInflation;

    // Governance addresses
    address public treasury;

    // Authorized contracts that can burn tokens (e.g., BetFactory)
    mapping(address => bool) public authorizedBurners;

    // Events
    event TokensBurned(address indexed from, uint256 amount, string reason);
    event InflationMinted(address indexed to, uint256 amount, uint256 year);
    event BurnerAuthorized(address indexed burner, bool authorized);
    event InflationRateChanged(uint256 oldRate, uint256 newRate);
    event BurnRateChanged(uint256 oldRate, uint256 newRate);
    event TreasuryChanged(address oldTreasury, address newTreasury);

    modifier onlyAuthorizedBurner() {
        require(authorizedBurners[msg.sender], "Not authorized to burn");
        _;
    }

    constructor() ERC20("ProofBet Token", "PROOF") Ownable(msg.sender){
        _mint(msg.sender, 100_000_000 ether); // 100 million initial supply
        lastInflationMint = block.timestamp;
    }

    // ========= Inflation logic =========

    /**
     * @notice Mint tokens for annual inflation, allowing for catch-up years.
     * @dev Only callable by owner; mints to treasury if set, otherwise owner.
     */
    function mintInflation() external onlyOwner returns (uint256) {
        require(canMintInflation(), "Too soon for inflation mint");

        uint256 currentSupply = totalSupply();
        uint256 yearsElapsed = (block.timestamp - lastInflationMint) / 365 days;
        uint256 inflationAmount = (currentSupply * annualInflationRate * yearsElapsed) / 100;

        require(currentSupply + inflationAmount <= MAX_SUPPLY, "Exceeds max supply");

        address recipient = (treasury != address(0)) ? treasury : owner();
        _mint(recipient, inflationAmount);

        totalMintedFromInflation += inflationAmount;
        lastInflationMint = block.timestamp;

        emit InflationMinted(recipient, inflationAmount, getCurrentYear());
        return inflationAmount;
    }

    // ========= Burn logic =========

    /**
     * @notice Burn tokens from the caller (manual user burn).
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount, "Manual burn");
    }

    /**
     * @notice Burn tokens directly from authorized contracts (e.g., BetFactory).
     */
    function factoryBurn(uint256 amount, string calldata reason) external onlyAuthorizedBurner {
        _burn(msg.sender, amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount, reason);
    }

    /**
     * @notice Burn and keep part of a fee, according to feeBurnPercentage.
     * @dev Designed for authorized burners like BetFactory.
     */
    function burnFromFees(address sender, uint256 totalFeeAmount)
        external
        onlyAuthorizedBurner
        returns (uint256 burnAmount, uint256 keepAmount)
    {
        burnAmount = (totalFeeAmount * feeBurnPercentage) / 100;
        keepAmount = totalFeeAmount - burnAmount;

        require(balanceOf(sender) >= totalFeeAmount, "Insufficient balance");

        if (burnAmount > 0) {
            _burn(sender, burnAmount);
            totalBurned += burnAmount;
            emit TokensBurned(sender, burnAmount, "Fee burn");
        }

        if (keepAmount > 0) {
            _transfer(sender, owner(), keepAmount);
        }
    }

    // ========= Governance setters =========

    function setInflationRate(uint256 _rate) external onlyOwner {
        require(_rate <= 20, "Inflation > 20%");
        uint256 old = annualInflationRate;
        annualInflationRate = _rate;
        emit InflationRateChanged(old, _rate);
    }

    function setBurnRate(uint256 _rate) external onlyOwner {
        require(_rate <= 100, "Burn rate > 100%");
        uint256 old = feeBurnPercentage;
        feeBurnPercentage = _rate;
        emit BurnRateChanged(old, _rate);
    }

    function authorizeBurner(address burner, bool authorized) external onlyOwner {
        authorizedBurners[burner] = authorized;
        emit BurnerAuthorized(burner, authorized);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero treasury");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryChanged(old, _treasury);
    }

    // ========= Views =========

    function canMintInflation() public view returns (bool) {
        return block.timestamp >= lastInflationMint + 365 days;
    }

    function getCurrentYear() public view returns (uint256) {
        return 1970 + (block.timestamp / 365 days);
    }

    function getTokenomics()
        external
        view
        returns (
            uint256 currentSupply,
            uint256 maxSupply,
            uint256 burned,
            uint256 mintedFromInflation,
            uint256 inflationRate,
            uint256 burnRate
        )
    {
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
