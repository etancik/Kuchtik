/**
 * Tests for recipe utility functions
 */

import {
  extractRecipeName,
  findRecipeByName,
  collectIngredientsFromRecipes,
  validateRecipe,
  formatRecipeSubtitle
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
      { nazev: 'Guláš', ingredience: ['maso'] },
      { nazev: 'Palačinky', ingredience: ['mouka'] }
    ];

    test('should find existing recipe', () => {
      const result = findRecipeByName(recipes, 'Guláš');
      expect(result).toEqual({ nazev: 'Guláš', ingredience: ['maso'] });
    });

    test('should return undefined for non-existing recipe', () => {
      const result = findRecipeByName(recipes, 'Neexistuje');
      expect(result).toBeUndefined();
    });
  });

  describe('collectIngredientsFromRecipes', () => {
    const recipes = [
      { nazev: 'Guláš', ingredience: ['maso', 'cibule'] },
      { nazev: 'Palačinky', ingredience: ['mouka', 'mléko'] }
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
        nazev: 'Test',
        ingredience: ['test'],
        postup: ['step'],
        tagy: ['tag']
      };
      expect(validateRecipe(recipe)).toBe(true);
    });

    test('should reject recipe with missing fields', () => {
      const recipe = { nazev: 'Test' };
      expect(validateRecipe(recipe)).toBe(false);
    });

    test('should reject null/undefined', () => {
      expect(validateRecipe(null)).toBe(false);
      expect(validateRecipe(undefined)).toBe(false);
    });
  });

  describe('formatRecipeSubtitle', () => {
    test('should format complete recipe info', () => {
      const recipe = { porce: '4', cas_pripravy: '90 min' };
      expect(formatRecipeSubtitle(recipe)).toBe('4 porce, 90 min');
    });

    test('should handle missing time', () => {
      const recipe = { porce: '4' };
      expect(formatRecipeSubtitle(recipe)).toBe('4 porce');
    });

    test('should handle missing portions', () => {
      const recipe = { cas_pripravy: '90 min' };
      expect(formatRecipeSubtitle(recipe)).toBe('90 min');
    });

    test('should handle empty recipe', () => {
      const recipe = {};
      expect(formatRecipeSubtitle(recipe)).toBe('');
    });
  });
});
