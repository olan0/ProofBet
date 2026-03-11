import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
         settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,  // ← ADD THIS to default profile
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
              outputSelection: {
      "*": {
        "*": ["evm.bytecode", "evm.deployedBytecode", "abi"]
      }
    },
  
          viaIR: true,
        },
      },
    },
  },
  networks: {
     localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
     },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      // Keys live in the Hardhat keystore — never in .env.
      // npx hardhat keystore set SEPOLIA_PRIVATE_KEY    (account 1: deployer / creator)
      // npx hardhat keystore set SEPOLIA_PRIVATE_KEY_2  (account 2: bettor YES)
      // npx hardhat keystore set SEPOLIA_PRIVATE_KEY_3  (account 3: bettor NO)
      // npx hardhat keystore set SEPOLIA_PRIVATE_KEY_4  (account 4: voter 1)
      // npx hardhat keystore set SEPOLIA_PRIVATE_KEY_5  (account 5: voter 2)
      // npx hardhat keystore set SEPOLIA_PRIVATE_KEY_6  (account 6: voter 3)
      // Set SIGNER_COUNT=6 in .env to activate all six accounts.
      accounts: (["SEPOLIA_PRIVATE_KEY","SEPOLIA_PRIVATE_KEY_2","SEPOLIA_PRIVATE_KEY_3","SEPOLIA_PRIVATE_KEY_4","SEPOLIA_PRIVATE_KEY_5","SEPOLIA_PRIVATE_KEY_6"]
        .slice(0, parseInt(process.env.SIGNER_COUNT ?? "1", 10))
        .map(k => configVariable(k))
      ),
    },
  },
};

export default config;
