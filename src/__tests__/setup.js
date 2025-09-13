// Jest setup file
// This runs before each test file

// Import jest globals
import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location
delete window.location;
window.location = {
  href: '',
  assign: jest.fn(),
  reload: jest.fn(),
};

// Mock alert
global.alert = jest.fn();

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  fetch.mockClear();
});
