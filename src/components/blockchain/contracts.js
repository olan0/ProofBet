import { ethers } from "ethers";

// --- ACTION REQUIRED: PASTE YOUR DEPLOYED CONTRACT ADDRESSES HERE ---
// You can get these from the output of the 'npx hardhat ignition deploy' command.
const CONTRACT_ADDRESSES = {
  BetFactory: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  ProofToken: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  TrustScore: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  // This will be your MockUSDC address on localhost, or the real one on a testnet.
  USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3" 
};

// --- ACTION REQUIRED: PASTE CONTRACT ABIs HERE ---
// You can find these JSON files in your local 'artifacts/contracts/...' directory after compiling.

// This is a standard ABI for token interactions.
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint amount) returns (bool)",
  "function transferFrom(address from, address to, uint amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// Find the full ABI in: 'artifacts/contracts/BetFactory.sol/BetFactory.json'
const BET_FACTORY_ABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_trustScore",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_usdcToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_proofToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_feeCollector",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_creationFeeProof",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_initialVoteStakeAmountProof",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "OwnableInvalidOwner",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "OwnableUnauthorizedAccount",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "betAddress",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "creator",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "title",
          "type": "string"
        }
      ],
      "name": "BetCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalFee",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "burned",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "kept",
          "type": "uint256"
        }
      ],
      "name": "FeeProcessed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "oldAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "newAmount",
          "type": "uint256"
        }
      ],
      "name": "VoteStakeAmountChanged",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "allBets",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "creator",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "title",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "description",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "bettingDeadline",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "proofDeadline",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "votingDeadline",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "minimumBetAmount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "minimumSideStake",
              "type": "uint256"
            },
            {
              "internalType": "uint8",
              "name": "minimumTrustScore",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "voterRewardPercentage",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "platformFeePercentage",
              "type": "uint8"
            }
          ],
          "internalType": "struct Bet.BetDetails",
          "name": "_details",
          "type": "tuple"
        }
      ],
      "name": "createBet",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "creationFeeProof",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "feeCollector",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getBets",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "",
          "type": "address[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "proofToken",
      "outputs": [
        {
          "internalType": "contract ProofToken",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_newFee",
          "type": "uint256"
        }
      ],
      "name": "setCreationFee",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_newCollector",
          "type": "address"
        }
      ],
      "name": "setFeeCollector",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_amount",
          "type": "uint256"
        }
      ],
      "name": "setVoteStakeAmount",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "trustScoreContract",
      "outputs": [
        {
          "internalType": "contract TrustScore",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "usdcToken",
      "outputs": [
        {
          "internalType": "contract IERC20",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "voteStakeAmountProof",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]

// Find the full ABI in: 'artifacts/contracts/Bet.sol/Bet.json'
const BET_ABI = [
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "creator",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "title",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "description",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "bettingDeadline",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "proofDeadline",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "votingDeadline",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "minimumBetAmount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "minimumSideStake",
              "type": "uint256"
            },
            {
              "internalType": "uint8",
              "name": "minimumTrustScore",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "voterRewardPercentage",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "platformFeePercentage",
              "type": "uint8"
            }
          ],
          "internalType": "struct Bet.BetDetails",
          "name": "_details",
          "type": "tuple"
        },
        {
          "internalType": "address",
          "name": "_trustScore",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_usdcToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_proofToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_feeCollector",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_voteStakeAmountProof",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReentrantCall",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [],
      "name": "BetCancelled",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "enum Bet.Side",
          "name": "position",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountUsdc",
          "type": "uint256"
        }
      ],
      "name": "BetPlaced",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "enum Bet.Side",
          "name": "winningSide",
          "type": "uint8"
        }
      ],
      "name": "BetResolved",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountUsdc",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountProof",
          "type": "uint256"
        }
      ],
      "name": "FundsWithdrawn",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "creator",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "proofUrl",
          "type": "string"
        }
      ],
      "name": "ProofSubmitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "enum Bet.Side",
          "name": "vote",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountProof",
          "type": "uint256"
        }
      ],
      "name": "VoteCast",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "checkAndCancelForProof",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "checkAndCloseBetting",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "checkAndResolve",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "claimRefund",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "claimVoterRewards",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "claimWinnings",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "currentStatus",
      "outputs": [
        {
          "internalType": "enum Bet.Status",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "details",
      "outputs": [
        {
          "internalType": "address",
          "name": "creator",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "title",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "description",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "bettingDeadline",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "proofDeadline",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "votingDeadline",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "minimumBetAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "minimumSideStake",
          "type": "uint256"
        },
        {
          "internalType": "uint8",
          "name": "minimumTrustScore",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "voterRewardPercentage",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "platformFeePercentage",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "feeCollector",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "fundsDistributed",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "noVotes",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "participants",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "yesStake",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "noStake",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "hasWithdrawn",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "enum Bet.Side",
          "name": "_position",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "_amountUsdc",
          "type": "uint256"
        }
      ],
      "name": "placeBet",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "proofToken",
      "outputs": [
        {
          "internalType": "contract IERC20",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "proofUrl",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_proofUrl",
          "type": "string"
        }
      ],
      "name": "submitProof",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalNoStake",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalVoteStakeProof",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalYesStake",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "trustScoreContract",
      "outputs": [
        {
          "internalType": "contract TrustScore",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "usdcToken",
      "outputs": [
        {
          "internalType": "contract IERC20",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "enum Bet.Side",
          "name": "_vote",
          "type": "uint8"
        }
      ],
      "name": "vote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "voteStakeAmountProof",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "voted",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "voterStakesProof",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "votes",
      "outputs": [
        {
          "internalType": "enum Bet.Side",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "winningSide",
      "outputs": [
        {
          "internalType": "enum Bet.Side",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "withdrawFunds",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "yesVotes",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
// Find the full ABI array in: 'artifacts/contracts/TrustScore.sol/TrustScore.json'
const TRUST_SCORE_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "OwnableInvalidOwner",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "OwnableUnauthorizedAccount",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "contractAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "isAuthorized",
          "type": "bool"
        }
      ],
      "name": "ContractAuthorized",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint8",
          "name": "oldScore",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint8",
          "name": "newScore",
          "type": "uint8"
        }
      ],
      "name": "ScoreUpdated",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "CREATE_BET_POINTS",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "PARTICIPATE_POINTS",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "PENALTY_POINTS",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "VOTE_POINTS",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        }
      ],
      "name": "applyPenalty",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_contractAddress",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "_isAuthorized",
          "type": "bool"
        }
      ],
      "name": "authorizeContract",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "authorizedContracts",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        }
      ],
      "name": "getScore",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_creator",
          "type": "address"
        }
      ],
      "name": "logBetCreation",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_participant",
          "type": "address"
        }
      ],
      "name": "logBetParticipation",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_voter",
          "type": "address"
        }
      ],
      "name": "logVote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "scores",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

let provider;
let signer;

/**
 * Initializes the ethers provider and signer by connecting to the user's wallet.
 * @returns {Promise<string|null>} The connected wallet address or null if connection fails.
 */
export async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    console.error("MetaMask is not installed.");
    // In a real app, you'd show a modal guiding the user to install MetaMask.
    return null;
  }
  
  try {
    // A Web3Provider wraps a standard Web3 provider, which is
    // what MetaMask injects as window.ethereum.
    provider = new ethers.BrowserProvider(window.ethereum);
    // Request account access
    await provider.send("eth_requestAccounts", []);
    // The MetaMask plugin also allows signing transactions to
    // send ether and pay to change state within the blockchain.
    // For this, you need the signer.
    signer = await provider.getSigner();
    return await signer.getAddress();
  } catch (error) {
    console.error("User rejected wallet connection request:", error);
    return null;
  }
}
/**
 * Gets the currently connected wallet address without prompting a connection.
 * @returns {Promise<string|null>}
 */
export async function getConnectedAddress() {
    if (typeof window.ethereum === "undefined") return null;
    
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            return accounts[0];
        }
        return null;
    } catch (error) {
        console.error("Could not get connected address:", error);
        return null;
    }
}
/**
 * Gets a read-only instance of a contract (if no signer is available).
 * @param {string} address The contract address.
 * @param {Array} abi The contract ABI.
 * @returns {ethers.Contract}
 */
export function getContractInstance(address, abi, withSigner = false) {
    if (withSigner) {
        if (!signer) {
            throw new Error("Wallet not connected. Cannot get a contract instance with a signer.");
        }
        return new ethers.Contract(address, abi, signer);
    }
    
    // Fallback to a read-only provider if wallet not connected or for view functions.
    const readProvider = provider || new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(address, abi, readProvider);
}


export const getBetFactoryContract = (withSigner = false) => getContractInstance(CONTRACT_ADDRESSES.BetFactory, BET_FACTORY_ABI, withSigner);
export const getBetContract = (address, withSigner = false) => getContractInstance(address, BET_ABI, withSigner);
export const getProofTokenContract = (withSigner = false) => getContractInstance(CONTRACT_ADDRESSES.ProofToken, ERC20_ABI, withSigner);
export const getUsdcTokenContract = (withSigner = false) => getContractInstance(CONTRACT_ADDRESSES.USDC, ERC20_ABI, withSigner);
export const getTrustScoreContract = (withSigner = false) => getContractInstance(CONTRACT_ADDRESSES.TrustScore, TRUST_SCORE_ABI, withSigner);

/**
 * A utility function to format address to a shorter version.
 * e.g. 0x1234...5678
 * @param {string} address
 * @returns {string}
 */
export function formatAddress(address) {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Formats a BigInt from a contract into a readable string with decimals.
 * @param {BigInt} bigIntValue The value from the contract.
 * @param {number} decimals The number of decimals the token uses (e.g., 18 for PROOF).
 * @returns {string}
 */
export function formatUnits(bigIntValue, decimals = 18) {
    if (typeof bigIntValue === 'undefined') return '0.0';
    return ethers.formatUnits(bigIntValue, decimals);
}