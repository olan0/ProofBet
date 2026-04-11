import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, overrideTask } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Post-deploy hook ────────────────────────────────────────────────────────
// Runs automatically after every `npx hardhat ignition deploy ...`.
// Syncs compiled ABIs and contract addresses to the frontend and server.

const postDeployHook = overrideTask(["ignition", "deploy"])
  .setAction(async () => ({
    default: async (args: any, hre: any, runSuper: any) => {
    // Run the standard Ignition deployment first.
    await runSuper(args);

    // Determine which deployed_addresses.json to read.
    const connection = await hre.network.connect();
    const chainId = Number(await connection.provider.request({ method: "eth_chainId" }));
    const deploymentId = args.deploymentId || `chain-${chainId}`;
    const deployedPath = path.join(
      hre.config.paths.ignition, "deployments", deploymentId, "deployed_addresses.json"
    );

    if (!fs.existsSync(deployedPath)) {
      console.log("\n  ⚠️  post-deploy: deployed_addresses.json not found, skipping sync");
      return;
    }

    const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));

    // Resolve addresses — try all module name prefixes used in this project.
    const find = (suffix: string): string | undefined =>
      deployed[`LocalProofBetModule#${suffix}`] ??
      deployed[`SepoliaProofBetModule#${suffix}`] ??
      deployed[`ProofBetModule#${suffix}`];

    const factoryAddress    = find("BetFactory");
    const proofTokenAddress = find("ProofToken");
    const trustScoreAddress = find("TrustScore");
    const usdcAddress       = deployed["LocalProofBetModule#MockERC20"] ?? find("IERC20");

    if (!factoryAddress) {
      console.log("\n  ⚠️  post-deploy: BetFactory address not found in deployed_addresses.json");
      return;
    }

    console.log("\n  Post-deploy sync:");

    // ── Sync ABIs ───────────────────────────────────────────────────────────
    const artifactsBase = path.join(hre.config.paths.root, "artifacts", "contracts");
    const abiTargets: Array<[string, string, string | null]> = [
      [
        "BetFactory.sol/BetFactory.json",
        path.join(__dirname, "..", "src", "abi", "BetFactory.json"),
        path.join(__dirname, "..", "server", "src", "abis", "BetFactory.json"),
      ],
      [
        "Bet.sol/Bet.json",
        path.join(__dirname, "..", "src", "abi", "Bet.json"),
        path.join(__dirname, "..", "server", "src", "abis", "Bet.json"),
      ],
      [
        "TrustScore.sol/TrustScore.json",
        path.join(__dirname, "..", "src", "abi", "TrustScore.json"),
        null,
      ],
    ];

    for (const [rel, frontDest, srvDest] of abiTargets) {
      const artifactPath = path.join(artifactsBase, rel);
      if (!fs.existsSync(artifactPath)) {
        console.log(`  ⚠️  Artifact not found: ${rel}`);
        continue;
      }
      const abiJson = JSON.stringify(
        JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi, null, 2
      );
      fs.mkdirSync(path.dirname(frontDest), { recursive: true });
      fs.writeFileSync(frontDest, abiJson);
      if (srvDest) {
        fs.mkdirSync(path.dirname(srvDest), { recursive: true });
        fs.writeFileSync(srvDest, abiJson);
      }
    }
    console.log("  ✅ ABIs → src/abi/  and  server/src/abis/");

    // ── Patch frontend contracts.js ─────────────────────────────────────────
    const contractsJsPath = path.join(
      __dirname, "..", "src", "components", "blockchain", "contracts.js"
    );
    if (fs.existsSync(contractsJsPath)) {
      let src = fs.readFileSync(contractsJsPath, "utf8");
      src = src.replace(
        /export const CONTRACT_ADDRESSES = \{[\s\S]*?\};/,
        `export const CONTRACT_ADDRESSES = {\n` +
        `  BetFactory: "${factoryAddress}",\n` +
        `  ProofToken: "${proofTokenAddress}",\n` +
        `  TrustScore: "${trustScoreAddress}",\n` +
        `  USDC: "${usdcAddress}"\n` +
        `};`
      );
      fs.writeFileSync(contractsJsPath, src);
      console.log("  ✅ src/components/blockchain/contracts.js patched");
    }

    // ── Patch server/.env ───────────────────────────────────────────────────
    const serverEnvPath = path.join(__dirname, "..", "server", ".env");
    if (fs.existsSync(serverEnvPath)) {
      let src = fs.readFileSync(serverEnvPath, "utf8");
      src = src.replace(/^FACTORY_ADDRESS=.*$/m, `FACTORY_ADDRESS=${factoryAddress}`);
      fs.writeFileSync(serverEnvPath, src);
      console.log("  ✅ server/.env FACTORY_ADDRESS patched");
    }

    // ── Write local-addresses.json (local only) ─────────────────────────────
    if (chainId === 31337) {
      const outFile = path.join(__dirname, "..", "local-addresses.json");
      fs.writeFileSync(outFile, JSON.stringify({
        chainId,
        BetFactory:  factoryAddress,
        ProofToken:  proofTokenAddress,
        TrustScore:  trustScoreAddress,
        USDC:        usdcAddress,
      }, null, 2));
      console.log("  ✅ local-addresses.json written");
    }
    },
  }))
  .build();

// ─── Hardhat config ──────────────────────────────────────────────────────────

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  tasks: [postDeployHook],

  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
         settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
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
      gasMultiplier: 1.5,   // 50% buffer on gas estimates (multi-hop calls: Bet → Factory → TrustScore)
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
