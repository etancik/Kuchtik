/**
 * Tests for iOS shortcuts utilities
 */

import { generateShortcutUrl, isShortcutsSupported } from '../utils/shortcutsUtils.js';

describe('shortcutsUtils', () => {
  describe('generateShortcutUrl', () => {
    test('should generate correct URL with ingredients', () => {
      const ingredients = ['maso', 'cibule', 'paprika'];
      const url = generateShortcutUrl(ingredients);
      
      expect(url).toContain('shortcuts://run-shortcut');
      expect(url).toContain('name=Import%20recept%C5%AF');
      expect(url).toContain('input=text');
      expect(url).toContain('text=maso%0Acibule%0Apaprika');
    });

    test('should handle custom shortcut name', () => {
      const ingredients = ['test'];
      const url = generateShortcutUrl(ingredients, 'Custom Shortcut');
      
      expect(url).toContain('name=Custom%20Shortcut');
    });

    test('should throw error for empty ingredients', () => {
      expect(() => generateShortcutUrl([])).toThrow('No ingredients provided');
      expect(() => generateShortcutUrl(null)).toThrow('No ingredients provided');
      expect(() => generateShortcutUrl(undefined)).toThrow('No ingredients provided');
    });

    test('should handle special characters in ingredients', () => {
      const ingredients = ['test & test', 'test + test'];
      const url = generateShortcutUrl(ingredients);
      
      // Should be URL encoded
      expect(url).toContain('test%20%26%20test');
      expect(url).toContain('test%20%2B%20test');
    });
  });

  describe('isShortcutsSupported', () => {
    const originalUserAgent = navigator.userAgent;

    afterEach(() => {
      // Reset navigator.userAgent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: originalUserAgent
      });
    });

    test('should return true for iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      });
      
      expect(isShortcutsSupported()).toBe(true);
    });

    test('should return true for iPad', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      });
      
      expect(isShortcutsSupported()).toBe(true);
    });

    test('should return false for other browsers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });
      
      expect(isShortcutsSupported()).toBe(false);
    });
  });
});
