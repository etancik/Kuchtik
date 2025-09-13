/**
 * Unit test for recipe validation fix in GitHubAPIAdapter
 */

import { GitHubAPIAdapter } from '../adapters/GitHubAPIAdapter.js';

describe('GitHubAPIAdapter Recipe Validation', () => {
  let adapter;

  beforeEach(() => {
    adapter = new GitHubAPIAdapter();
  });

  describe('validateRecipe', () => {
    test('should accept valid recipe with instructions as array', () => {
      const validRecipe = {
        name: 'Test Recipe',
        ingredients: ['ingredient 1', 'ingredient 2'],
        instructions: ['step 1', 'step 2', 'step 3']
      };

      const validation = adapter.validateRecipe(validRecipe);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject recipe with empty instructions array', () => {
      const invalidRecipe = {
        name: 'Test Recipe',
        ingredients: ['ingredient 1'],
        instructions: [] // Empty array should be invalid
      };

      const validation = adapter.validateRecipe(invalidRecipe);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Instructions are required');
    });

    test('should reject recipe with missing instructions', () => {
      const invalidRecipe = {
        name: 'Test Recipe',
        ingredients: ['ingredient 1']
        // No instructions property
      };

      const validation = adapter.validateRecipe(invalidRecipe);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Instructions are required');
    });

    test('should reject recipe with null instructions', () => {
      const invalidRecipe = {
        name: 'Test Recipe',
        ingredients: ['ingredient 1'],
        instructions: null
      };

      const validation = adapter.validateRecipe(invalidRecipe);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Instructions are required');
    });

    test('should reject recipe with instructions as string (old format)', () => {
      const invalidRecipe = {
        name: 'Test Recipe',
        ingredients: ['ingredient 1'],
        instructions: 'Some instructions as a string' // Should be array now
      };

      const validation = adapter.validateRecipe(invalidRecipe);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Instructions are required');
    });

    test('should accept complete valid recipe', () => {
      const validRecipe = {
        name: 'Guláš',
        ingredients: [
          '500 g hovězí kližky',
          '2 cibule',
          '2 stroužky česneku'
        ],
        instructions: [
          'Nakrájej maso na kostky.',
          'Orestuj cibuli do zlatova.',
          'Přidej maso a koření.'
        ],
        cookingTime: '90 min',
        servings: 4,
        tags: ['Czech', 'meat'],
        notes: ['Traditional recipe']
      };

      const validation = adapter.validateRecipe(validRecipe);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
