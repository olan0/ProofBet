// frontend/src/__tests__/setup.ts

/**
 * Global test setup
 * Runs before all tests
 */

// Increase timeout for blockchain operations
jest.setTimeout(30000);

// Mock environment variables
// Update these addresses after you deploy contracts to localhost
process.env.REACT_APP_FACTORY_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
process.env.REACT_APP_PROOF_TOKEN_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
process.env.REACT_APP_USDC_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
process.env.REACT_APP_TRUST_SCORE_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
process.env.REACT_APP_RPC_URL = 'http://127.0.0.1:8545';
process.env.REACT_APP_CHAIN_ID = '31337';

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
