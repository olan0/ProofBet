import { ethers } from "ethers";
// ABIs are auto-synced from compiled artifacts by the seeder scripts.
// Do not edit these files manually — run the seeder to update them.
import BetFactoryAbiData from "../../abi/BetFactory.json";
import BetAbiData from "../../abi/Bet.json";
import TrustScoreAbiData from "../../abi/TrustScore.json";

// Contract addresses are auto-patched by the seeder scripts.
export const CONTRACT_ADDRESSES = {
  BetFactory: "0xAc58bF171A2ef03F0674620FFd96693a5c6b1B74",
  ProofToken: "0xfaB32c9b6736E5Bc6D44a591DAa267d8D723c83D",
  TrustScore: "0x2e9542955D70c51fcd00A9a95f0418D7E6500eD6",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
};

// Standard ABI for ERC-20 token interactions.
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint amount) returns (bool)",
  "function transferFrom(address from, address to, uint amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function owner() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export const BET_FACTORY_ABI = BetFactoryAbiData;
export const BET_ABI = BetAbiData;
export const TRUST_SCORE_ABI = TrustScoreAbiData;

let provider;
let signer;

/**
 * Initializes the ethers provider and signer by connecting to the user's wallet.
 * @returns {Promise<string|null>} The connected wallet address or null if connection fails.
 */
export async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    console.error("MetaMask is not installed.");
    alert("Please install MetaMask to use this application.");
    return null;
  }
  
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    // Request account access
    await provider.send("eth_requestAccounts", []);
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
 * Disconnects the wallet by clearing the provider and signer
 * @returns {Promise<void>}
 */
export async function disconnectWallet() {
    try {
        // Clear the provider and signer
        provider = null;
        signer = null;
        
        // Clear any stored wallet state
        if (typeof window !== 'undefined') {
            localStorage.removeItem('walletAddress'); // Example: clear a stored address
            // You might want to add more state clearing depending on your app's needs
        }
        
        console.log("Wallet disconnected successfully");
        // Optionally, trigger a UI update or page reload to reflect disconnection
        // window.location.reload(); 
    } catch (error) {
        console.error("Error disconnecting wallet:", error);
    }
}


/**
 * Gets an instance of a contract.
 * @param {string} address The contract address.
 * @param {Array} abi The contract ABI.
 * @param {boolean} withSigner If true, returns a contract instance that can sign transactions.
 * @returns {ethers.Contract}
 */
/**
 * Signs a payload string with the connected wallet.
 * Returns { signature, timestamp } to include in API requests.
 */
export async function signPayload(message) {
    if (!signer) throw new Error("Wallet not connected");
    const timestamp = Date.now();
    const signature = await signer.signMessage(`${message}:${timestamp}`);
    return { signature, timestamp };
}

export  function getContractInstance(address, abi, withSigner = false) {
    if (withSigner) {
        if (!signer) {
            throw new Error("Wallet not connected. Cannot create a contract instance with a signer.");
        }
        return new ethers.Contract(address, abi, signer);
    }
    const readProvider = provider || (typeof window !== 'undefined' ? new ethers.BrowserProvider(window.ethereum) : undefined);
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
 * Returns the current block timestamp as a JS Date.
 * On local Hardhat nodes this may differ significantly from wall-clock time
 * due to evm_increaseTime calls.
 */
export async function getBlockTimestamp() {
    try {
        const p = provider || (typeof window !== 'undefined' && window.ethereum
            ? new ethers.BrowserProvider(window.ethereum)
            : null);
        if (!p) return new Date();
        const block = await p.getBlock('latest');
        return new Date(Number(block.timestamp) * 1000);
    } catch {
        return new Date();
    }
}

// Listen for account changes and reload the page
if(typeof window !== 'undefined' && window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            window.location.reload();
        } else {
            // Handle user locking their wallet or disconnecting all accounts
            console.log("Wallet disconnected.");
            window.location.reload();
        }
    });
}
