// Basic test to verify Jest setup
import { jest } from '@jest/globals';

describe('Jest Setup', () => {
  test('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  test('should have jsdom environment', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  test('should have mocked fetch', () => {
    expect(typeof fetch).toBe('function');
    expect(jest.isMockFunction(fetch)).toBe(true);
  });
});
