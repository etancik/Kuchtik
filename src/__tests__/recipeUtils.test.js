/**
 * Tests for recipe utility functions
 */

import {
  extractRecipeName,
  findRecipeByName,
  collectIngredientsFromRecipes,
  validateRecipe,
  formatRecipeSubtitle,
  generateFilenameFromRecipeName
} from '../utils/recipeUtils.js';

describe('recipeUtils', () => {
  describe('extractRecipeName', () => {
    test('should extract recipe name from card title', () => {
      const cardTitle = 'Guláš (4 porce, 90 min)';
      expect(extractRecipeName(cardTitle)).toBe('Guláš');
    });

    test('should handle recipe name without parentheses', () => {
      const cardTitle = 'Guláš';
      expect(extractRecipeName(cardTitle)).toBe('Guláš');
    });

    test('should trim whitespace', () => {
      const cardTitle = '  Guláš (4 porce, 90 min)';
      expect(extractRecipeName(cardTitle)).toBe('Guláš');
    });
  });

  describe('findRecipeByName', () => {
    const recipes = [
      { name: 'Guláš', ingredients: ['maso'] },
      { name: 'Palačinky', ingredients: ['mouka'] }
    ];

    test('should find existing recipe', () => {
      const result = findRecipeByName(recipes, 'Guláš');
      expect(result).toEqual({ name: 'Guláš', ingredients: ['maso'] });
    });

    test('should return undefined for non-existing recipe', () => {
      const result = findRecipeByName(recipes, 'Neexistuje');
      expect(result).toBeUndefined();
    });
  });

  describe('collectIngredientsFromRecipes', () => {
    const recipes = [
      { name: 'Guláš', ingredients: ['maso', 'cibule'] },
      { name: 'Palačinky', ingredients: ['mouka', 'mléko'] }
    ];

    test('should collect ingredients from selected recipes', () => {
      const selected = ['Guláš', 'Palačinky'];
      const result = collectIngredientsFromRecipes(recipes, selected);
      expect(result).toEqual(['maso', 'cibule', 'mouka', 'mléko']);
    });

    test('should handle non-existing recipes', () => {
      const selected = ['Neexistuje'];
      const result = collectIngredientsFromRecipes(recipes, selected);
      expect(result).toEqual([]);
    });

    test('should handle empty selection', () => {
      const result = collectIngredientsFromRecipes(recipes, []);
      expect(result).toEqual([]);
    });
  });

  describe('validateRecipe', () => {
    test('should validate complete recipe', () => {
      const recipe = {
        name: 'Test',
        ingredients: ['test'],
        instructions: ['step'],
        tags: ['tag']
      };
      expect(validateRecipe(recipe)).toBe(true);
    });

    test('should reject recipe with missing fields', () => {
      const recipe = { name: 'Test' };
      expect(validateRecipe(recipe)).toBe(false);
    });

    test('should reject null/undefined', () => {
      expect(validateRecipe(null)).toBe(false);
      expect(validateRecipe(undefined)).toBe(false);
    });
  });

  describe('formatRecipeSubtitle', () => {
    test('should format complete recipe info', () => {
      const recipe = { servings: '4', cookingTime: '90 min' };
      expect(formatRecipeSubtitle(recipe)).toBe('4 servings, 90 min');
    });

    test('should handle missing time', () => {
      const recipe = { servings: '4' };
      expect(formatRecipeSubtitle(recipe)).toBe('4 servings');
    });

    test('should handle missing portions', () => {
      const recipe = { cookingTime: '90 min' };
      expect(formatRecipeSubtitle(recipe)).toBe('90 min');
    });

    test('should handle empty recipe', () => {
      const recipe = {};
      expect(formatRecipeSubtitle(recipe)).toBe('');
    });
  });

  describe('generateFilenameFromRecipeName', () => {
    test('should generate filename from recipe name with Czech diacritics', () => {
      expect(generateFilenameFromRecipeName('Guláš')).toBe('gulas.json');
    });

    test('should generate filename from complex recipe names', () => {
      expect(generateFilenameFromRecipeName('Šťáva z arónie')).toBe('stava-z-aronie.json');
    });

    test('should handle spaces and special characters', () => {
      expect(generateFilenameFromRecipeName('Palačinky & šlehačka!')).toBe('palacinky-slehacka.json');
    });

    test('should handle already lowercased names', () => {
      expect(generateFilenameFromRecipeName('bramborový salát')).toBe('bramborovy-salat.json');
    });

    test('should handle multiple consecutive spaces and hyphens', () => {
      expect(generateFilenameFromRecipeName('Test   Recipe -- Name')).toBe('test-recipe-name.json');
    });

    test('should handle leading and trailing special characters', () => {
      expect(generateFilenameFromRecipeName('  --Test Recipe--  ')).toBe('test-recipe.json');
    });

    test('should handle empty or invalid names', () => {
      expect(generateFilenameFromRecipeName('')).toBe('.json');
      expect(generateFilenameFromRecipeName(' ')).toBe('.json');
      expect(generateFilenameFromRecipeName(null)).toBe('.json');
      expect(generateFilenameFromRecipeName(undefined)).toBe('.json');
    });

    test('should match existing recipe filenames', () => {
      // Test that our function generates consistent filenames
      // (Note: Legacy files may have inconsistent naming)
      expect(generateFilenameFromRecipeName('Palačinky')).toBe('palacinky.json');
      expect(generateFilenameFromRecipeName('Guláš')).toBe('gulas.json');
      expect(generateFilenameFromRecipeName('Šťáva z arónie')).toBe('stava-z-aronie.json');
    });
  });
});
