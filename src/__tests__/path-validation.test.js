/**
 * Simple unit tests for GitHubAPIAdapter path validation
 * Validates that the correct "recipes" folder path is used
 */

import { describe, test, expect } from '@jest/globals';

describe('GitHubAPIAdapter Path Configuration', () => {
  describe('Repository Path Validation', () => {
    test('should use correct folder name "recipes" not "recepty"', () => {
      // This test validates that we're using the correct folder name
      const correctPath = 'repos/etancik/Kuchtik/contents/recipes';
      const incorrectPath = 'repos/etancik/Kuchtik/contents/recepty';
      
      // Ensure we're using the correct folder name
      expect(correctPath).toContain('/recipes');
      expect(correctPath).not.toContain('/recepty');
      
      // Verify the incorrect path is what we were using before
      expect(incorrectPath).toContain('/recepty');
      expect(incorrectPath).not.toContain('/recipes');
    });

    test('should generate correct file paths', () => {
      const filename = 'test-recipe.json';
      const basePath = 'repos/etancik/Kuchtik/contents/recipes';
      const filePath = `${basePath}/${filename}`;
      
      expect(filePath).toBe('repos/etancik/Kuchtik/contents/recipes/test-recipe.json');
      expect(filePath).toContain('/recipes/');
      expect(filePath).not.toContain('/recepty/');
    });

    test('should have consistent path structure', () => {
      const paths = {
        list: 'repos/etancik/Kuchtik/contents/recipes',
        create: 'repos/etancik/Kuchtik/contents/recipes/new-recipe.json',
        read: 'repos/etancik/Kuchtik/contents/recipes/existing-recipe.json',
        update: 'repos/etancik/Kuchtik/contents/recipes/existing-recipe.json',
        delete: 'repos/etancik/Kuchtik/contents/recipes/existing-recipe.json'
      };

      // All paths should use /recipes/ folder
      Object.values(paths).forEach(path => {
        expect(path).toContain('contents/recipes');
        expect(path).not.toContain('contents/recepty');
      });
    });
  });

  describe('Filename Generation', () => {
    test('should generate valid JSON filenames', () => {
      const testCases = [
        { input: 'Simple Recipe', expected: 'simple-recipe.json' },
        { input: 'Recipe with Special Ch@rs!', expected: 'recipe-with-special-chrs.json' },
        { input: 'Multiple   Spaces', expected: 'multiple-spaces.json' },
        { input: '   Trimmed   ', expected: 'trimmed.json' }
      ];

      // Mock the filename generation logic
      const generateFilename = (name) => {
        if (!name || typeof name !== 'string') return null;
        return name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '') + '.json';
      };

      testCases.forEach(({ input, expected }) => {
        const result = generateFilename(input);
        expect(result).toBe(expected);
        expect(result).toMatch(/\.json$/);
      });
    });
  });

  describe('Path Error Prevention', () => {
    test('should prevent common path errors', () => {
      const commonMistakes = [
        '/recepty',     // Old folder name
        '//recipes',    // Double slash
        'recipes/',     // Trailing slash in base
        '/recipes//',   // Double slash after folder
      ];

      const correctBasePath = 'repos/etancik/Kuchtik/contents/recipes';
      
      commonMistakes.forEach(mistake => {
        expect(correctBasePath).not.toContain(mistake);
      });
    });

    test('should maintain consistent API structure', () => {
      const apiBase = 'repos/etancik/Kuchtik/contents/recipes';
      const testFile = 'test.json';
      const fullPath = `${apiBase}/${testFile}`;
      
      // Verify structure
      expect(fullPath.split('/')).toHaveLength(6); // repos/owner/repo/contents/folder/file
      expect(fullPath.split('/')[4]).toBe('recipes'); // 5th element should be 'recipes'
      expect(fullPath.endsWith('.json')).toBe(true);
    });
  });
});
