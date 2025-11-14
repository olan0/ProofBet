const \[activeSection, setActiveSection\] = useState("overview"); const sections = \[ , , , , , , \]; const vestingSchedules = \[ { beneficiary: 'Team & Advisors', total\_allocation: '200,000,000', allocation\_percentage: 20, cliff\_duration\_months: 12, vesting\_duration\_months: 48, status: , unlocked: '25.00' }, { beneficiary: 'Seed Investors', total\_allocation: '150,000,000', allocation\_percentage: 15, cliff\_duration\_months: 6, vesting\_duration\_months: 24, status: , unlocked: '50.00' }, { beneficiary: 'Foundation Treasury', total\_allocation: '100,000,000', allocation\_percentage: 10, cliff\_duration\_months: 0, vesting\_duration\_months: 60, status: , unlocked: '10.00' }, { beneficiary: 'Community & Ecosystem', total\_allocation: '450,000,000', allocation\_percentage: 45, cliff\_duration\_months: 0, vesting\_duration\_months: 72, status: , unlocked: '0.00' } \]; return (

# ProofBet Documentation

Decentralized Prediction Markets with Proof-Based Resolution

Dual-token system (USDC + PROOF)

Community-driven verification

Smart contract powered

Navigation {sections.map((section) => { const Icon = section.icon; return ( ); })}

{activeSection === "overview" && (

What is ProofBet?

ProofBet is a decentralized prediction market platform where users can create, bet on, and verify outcomes of real-world events. Unlike traditional betting platforms, ProofBet requires creators to provide verifiable proof of outcomes, which is then validated by the community through a democratic voting system.

### Proof-Based Resolution

Every bet requires the creator to submit verifiable proof (video, photo, or live stream) when claiming victory.

### Community Verification

Neutral observers vote on submitted proof to determine the true outcome, earning rewards for honest participation.

### Stable Currency

All betting is done in USDC stablecoin, eliminating volatility risk and providing predictable payouts.

### Trust Score System

Users build reputation through honest participation, unlocking access to exclusive high-stakes markets.

How It Works

{\[ { step: 1, title: "Create a Bet", description: "Pay creation fee in PROOF tokens and set your claim with deadlines and proof requirements.", color: "cyan" }, { step: 2, title: "Community Bets", description: "Others stake USDC on YES or NO sides of your claim until the betting deadline.", color: "purple" }, { step: 3, title: "Submit Proof", description: "After the event occurs, submit verifiable proof (video, photo, or stream) of the outcome.", color: "green" }, { step: 4, title: "Community Votes", description: "Neutral observers stake PROOF tokens to vote on whether your proof is valid.", color: "orange" }, { step: 5, title: "Automatic Payout", description: "Smart contracts automatically distribute winnings to correct bettors and reward honest voters.", color: "pink" } \].map((step) => (

))}

)} {activeSection === "tokenomics" && (

PROOF Tokenomics

The PROOF token is the backbone of the ProofBet ecosystem, designed for long-term utility, decentralized governance, and sustainable growth. The total supply is capped at 1 billion tokens.

Token Allocation {\[ , , , , \].map(item => (

))} Vesting & Release Schedule

To ensure long-term commitment and prevent market manipulation, team and investor tokens are subject to a multi-year vesting schedule. This table displays the planned release schedule for all allocated tokens.

Beneficiary Total Allocation (PROOF) Cliff Vesting Period Status Unlocked {vestingSchedules.map((schedule) => { const status = schedule.status; const unlocked = schedule.unlocked; return ( (%) months months % ); })}

Core Mechanics

#### Fee Burning

50% of all PROOF platform fees are permanently burned, creating a deflationary pressure on the token supply.

#### Staking & Rewards

Users can stake PROOF tokens to participate in governance and earn a share of platform revenue.

#### Governance

PROOF holders will be able to vote on key platform decisions, such as fee changes and feature development.

)} {activeSection === "user-guide" && (

Getting Started

### 1 Connect Wallet

Connect your Web3 wallet (e.g., MetaMask) to start interacting with the platform.

### 2 Deposit Funds

Use the Wallet tab to deposit USDC and PROOF tokens from your personal wallet into your gas-efficient internal wallet.

### 3 Start Participating

Browse markets, place bets, create markets, and vote on outcomes using your internal balances.

Internal Wallet Placing Bets Creating Markets Voting The Internal Wallet System

To save on gas fees and improve user experience, ProofBet uses an internal wallet system. Instead of approving every single transaction, you deposit funds once into the platform's smart contract, and all subsequent actions (betting, creating, voting) use this internal balance.

#### Depositing Funds

1\. Go to the "Wallet" tab on the main dashboard.  
2\. Enter the amount of USDC or PROOF you wish to deposit.  
3\. Approve the token transfer in your wallet.  
4\. Confirm the deposit transaction. Your internal balance will update.

#### Withdrawing Funds

1\. Go to the "Wallet" tab.  
2\. In the "Withdraw" section, enter the amount to transfer back to your personal wallet.  
3\. Confirm the withdrawal transaction.  
4\. Your funds will be sent from the contract back to your connected wallet address.

How to Place Bets {\[ "Browse the Markets tab to find active prediction markets", "Check the bet details, deadlines, and minimum trust score requirements", "Ensure you have sufficient USDC deposited in your internal wallet", "Click 'Place Bet' and choose YES or NO side", "Enter your stake amount (in USDC)", "Confirm the transaction (no separate approval needed!)", "Wait for outcome resolution to claim winnings" \].map((step, index) => (

))} Creating Prediction Markets

#### Requirements:

-   • A creation fee in PROOF tokens (set by the contract) from your internal balance.
-   • Must provide a clear, verifiable claim with specific outcomes.
-   • Set appropriate deadlines for betting, proof submission, and voting.

#### Dynamic Creation Fee

The required PROOF fee now scales based on how long the bet’s deadline is:  
**• Less than 7 days:** 1× base fee  
**• 7–14 days:** 1.5× base fee  
**• More than 14 days:** 2× base fee  
  
The default base duration (D) is 7 days, configurable by the platform.

{\[ "Navigate to 'Create Market' (requires wallet connection)", "Fill in the market title and a detailed description", "Set the category and the required proof type (e.g., video, photo)", "Configure financial parameters like minimum bet amount", "Set the three key deadlines for the market lifecycle", "Confirm the transaction. The PROOF fee will be deducted from your internal wallet.", "Your market goes live immediately for others to participate." \].map((step, index) => (

))}

Community Voting System

#### Voting Requirements:

-   • You cannot have a financial stake (bet) in the market you're voting on.
-   • You must have enough PROOF tokens in your internal balance for the vote stake.
-   • Vote honestly based on the provided evidence to earn rewards.

{\[ "Find markets in the 'Voting' tab", "Carefully review the submitted proof link", "Ensure you haven't bet on this market", "Click 'Vote' and choose YES if the proof is valid, or NO if it is not", "Confirm the transaction. The PROOF stake will be deducted from your internal wallet.", "Earn rewards and get your stake back if you vote with the majority.", "Forfeit your stake if you vote against the consensus." \].map((step, index) => (

))}

)} {activeSection === "trust-score" && (

Trust Score System

The Trust Score is a reputation system that tracks user behavior and rewards honest participation. Users with higher trust scores gain access to exclusive markets and are seen as more reliable by the community.

{\[ , , , \].map((tier) => (

))}

How Trust Score is Calculated

#### Positive Factors (Increase Score)

-   • Account age (max 20 points)
-   • Bets participated in (max 30 points)
-   • Bets created (max 25 points)
-   • Voting accuracy (max 25 points)
-   • Consistent activity over time

#### Score Benefits

-   • Access to exclusive markets
-   • Higher betting limits
-   • Reduced platform fees
-   • Community recognition
-   • Future governance voting power

#### Impact on Voting Stake

The higher your Trust Score and account age, the less PROOF you need to stake when voting. New or unproven accounts must stake more, encouraging long-term honest participation.

)} {activeSection === "smart-contracts" && (

`Smart Contract Architecture```   ProofBet runs on a modular system of smart contracts, ensuring transparency, security, and trustless execution. The core logic is split between a central factory and individual market contracts.  {[ { name: "BetFactory.sol", purpose: "The central hub for creating and managing all prediction markets.", features: ["Creates new Bet contracts", "Manages internal USDC/PROOF wallets", "Sets platform-wide fees", "Maintains market registry"] }, { name: "Bet.sol", purpose: "An individual, self-contained contract for a single market.", features: ["Handles all betting logic", "Manages proof submission", "Counts votes & determines outcome", "Processes claims & refunds"] }, { name: "ProofToken.sol", purpose: "The platform's utility and governance token.", features: ["ERC-20 standard token", "Used for fees and voting stakes", "Future governance capabilities"] } ].map((contract) => (  {contract.features.map((feature) => (  ))}  ))}  Key Concepts  #### Internal Wallet System  Users deposit/withdraw funds into the `BetFactory` contract. This allows for gas-less internal transfers for betting and voting, requiring only a single transaction signature instead of multiple on-chain token approvals.  #### Keeper Functions  Functions like `checkAndCloseBetting` and `checkAndResolve` are public and can be called by anyone (a "keeper"). This allows for decentralized, automated maintenance of market statuses once deadlines have passed.       ``

``)} {activeSection === "api" && (  Technical Specifications  ### Blockchain Details  Network: Ethereum Mainnet  Solidity Version: ^0.8.19  Token Standards: ERC-20  Security Audits: Planned  ### Token Addresses  USDC: `0xA0b8...6eB48`  PROOF: `TBD`  BetFactory: `TBD`  TrustScore: `TBD`  Frontend Integration  #### Required Libraries  -   • ethers.js or web3.js -   • @wagmi/core -   • viem -   • @rainbow-me/rainbowkit  #### Key Functions  -   • createBet(...) -   • placeBet(betId, side, amount) -   • submitProof(betId, proofUrl) -   • vote(betId, vote)  )} {activeSection === "roadmap" && (  Development Roadmap {[ { phase: "Phase 1: Core Platform Launch", status: "Completed", color: "green", timeline: "Q3 2025", features: [ "Dual-token system (USDC & PROOF)", "Core bet creation, betting, and voting logic", "Internal wallet system for gasless actions", "Smart contract architecture on local testnet", "Web3 wallet connectivity and basic UI" ] }, { phase: "Phase 2: UX & Feature Polish", status: "In Progress", color: "blue", timeline: "Q4 2025", features: [ "Advanced market filtering and search capabilities", "Mobile-first responsive design improvements", "Social features (e.g., user aliases) and enhanced profiles", "Real-time UI updates for market status changes", "Comprehensive documentation portal" ] }, { phase: "Phase 3: DeFi & Scalability", status: "Planned", color: "purple", timeline: "Q1-Q2 2026", features: [ "PROOF token staking to earn yield from platform revenue", "Lending protocol integration to enable betting without selling assets", "Personalized analytics and statistics dashboard", "Live streaming integration for real-time proof", "Cross-chain support (e.g., Polygon, Arbitrum) for lower gas fees" ] }, { phase: "Phase 4: Decentralized Governance", status: "Vision", color: "orange", timeline: "Q3 2026 and beyond", features: [ "DAO formation for community governance", "On-chain voting with PROOF tokens for platform proposals", "Community-managed treasury", "Public API for third-party developers", "Expansion into enterprise prediction solutions" ] } ].map((phase) => (  {phase.features.map((feature) => (  ))}  ))}  )}``

`); }`