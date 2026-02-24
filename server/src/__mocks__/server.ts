// Mock for server.ts — prevents DB connection and EventSync from running in tests
export const io = { emit: jest.fn() };
