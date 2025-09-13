/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { templateLoader } from '../utils/templateLoader.js';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TemplateLoader', () => {
  afterEach(() => {
    jest.clearAllMocks();
    templateLoader.clearCache();
  });

  describe('loadTemplate', () => {
    test('should load template from URL', async () => {
      const mockHtml = '<div>Test Template</div>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const result = await templateLoader.loadTemplate('test-template.html');

      expect(mockFetch).toHaveBeenCalledWith('test-template.html');
      expect(result).toBe(mockHtml);
    });

    test('should cache templates', async () => {
      const mockHtml = '<div>Cached Template</div>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      // Load template twice
      const result1 = await templateLoader.loadTemplate('cached-template.html');
      const result2 = await templateLoader.loadTemplate('cached-template.html');

      // Fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toBe(mockHtml);
      expect(result2).toBe(mockHtml);
    });

    test('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(templateLoader.loadTemplate('non-existent.html'))
        .rejects.toThrow('Failed to load template: non-existent.html');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(templateLoader.loadTemplate('error-template.html'))
        .rejects.toThrow('Failed to load template: error-template.html');
    });
  });

  describe('createElement', () => {
    test('should create DOM element from template', async () => {
      const mockHtml = '<div class="test-element">Test Content</div>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const element = await templateLoader.createElement('element-template.html');

      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.className).toBe('test-element');
      expect(element.textContent).toBe('Test Content');
    });
  });

  describe('cache management', () => {
    test('should clear cache', async () => {
      const mockHtml = '<div>Template</div>';
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      // Load template to cache it
      await templateLoader.loadTemplate('cached.html');
      
      // Clear cache
      templateLoader.clearCache();
      
      // Load again - should fetch again
      await templateLoader.loadTemplate('cached.html');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should remove specific template from cache', async () => {
      const mockHtml = '<div>Template</div>';
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      // Load and cache template
      await templateLoader.loadTemplate('specific.html');
      
      // Remove from cache
      templateLoader.removeFromCache('specific.html');
      
      // Load again - should fetch again
      await templateLoader.loadTemplate('specific.html');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
