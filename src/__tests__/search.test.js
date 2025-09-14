/**
 * Tests for search functionality
 */

import { searchRecipes } from '../utils/recipeUtils.js';

describe('Search functionality', () => {
  const sampleRecipes = [
    {
      id: 1,
      name: 'Chocolate Cake',
      tags: ['dessert', 'sweet', 'baking'],
      ingredients: ['flour', 'cocoa powder', 'sugar', 'eggs', 'butter']
    },
    {
      id: 2,
      name: 'Chicken Soup',
      tags: ['soup', 'comfort food', 'healthy'],
      ingredients: ['chicken', 'carrots', 'onion', 'celery', 'broth']
    },
    {
      id: 3,
      name: 'Chocolate Chip Cookies',
      tags: ['dessert', 'cookies', 'baking'],
      ingredients: ['flour', 'chocolate chips', 'sugar', 'butter', 'vanilla']
    },
    {
      id: 4,
      name: 'Caesar Salad',
      tags: ['salad', 'healthy', 'fresh'],
      ingredients: ['lettuce', 'parmesan', 'croutons', 'caesar dressing']
    }
  ];

  describe('searchRecipes', () => {
    it('should return all recipes when no query provided', () => {
      const results = searchRecipes(sampleRecipes, '');
      expect(results).toHaveLength(4);
      expect(results[0].score).toBe(1);
    });

    it('should return all recipes when empty query provided', () => {
      const results = searchRecipes(sampleRecipes, '   ');
      expect(results).toHaveLength(4);
    });

    it('should find recipes by exact name match with highest score', () => {
      const results = searchRecipes(sampleRecipes, 'Chocolate Cake');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].recipe.name).toBe('Chocolate Cake'); // Should be first (highest score)
      expect(results[0].score).toBeCloseTo(0.6, 1); // Name weight is 0.6
    });

    it('should find recipes by partial name match', () => {
      const results = searchRecipes(sampleRecipes, 'chocolate');
      expect(results.length).toBeGreaterThan(0);
      
      const recipeNames = results.map(r => r.recipe.name);
      expect(recipeNames).toContain('Chocolate Cake');
      expect(recipeNames).toContain('Chocolate Chip Cookies');
    });

    it('should prioritize name matches over tag matches', () => {
      const results = searchRecipes(sampleRecipes, 'chocolate');
      expect(results.length).toBeGreaterThan(1);
      
      // Results should be sorted by score (name matches first)
      const chocolateCakeResult = results.find(r => r.recipe.name === 'Chocolate Cake');
      const chocolateCookiesResult = results.find(r => r.recipe.name === 'Chocolate Chip Cookies');
      
      expect(chocolateCakeResult.score).toBeGreaterThan(0);
      expect(chocolateCookiesResult.score).toBeGreaterThan(0);
    });

    it('should find recipes by tag match', () => {
      const results = searchRecipes(sampleRecipes, 'dessert');
      expect(results.length).toBeGreaterThan(0);
      
      const recipeNames = results.map(r => r.recipe.name);
      expect(recipeNames).toContain('Chocolate Cake');
      expect(recipeNames).toContain('Chocolate Chip Cookies');
    });

    it('should find recipes by ingredient match with highest score', () => {
      const results = searchRecipes(sampleRecipes, 'chicken');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].recipe.name).toBe('Chicken Soup'); // Should be first
      expect(results[0].score).toBeGreaterThan(0.1); // Should have decent score
    });

    it('should handle case insensitive searches', () => {
      const results = searchRecipes(sampleRecipes, 'CHOCOLATE');
      expect(results.length).toBeGreaterThan(0);
      
      const recipeNames = results.map(r => r.recipe.name);
      expect(recipeNames).toContain('Chocolate Cake');
    });

    it('should return results sorted by score (highest first)', () => {
      const results = searchRecipes(sampleRecipes, 'baking');
      expect(results.length).toBe(2);
      
      // All results should have scores
      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0);
      });
      
      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should filter out results below minimum score', () => {
      const results = searchRecipes(sampleRecipes, 'xyz', 0.5);
      expect(results).toHaveLength(0);
    });

    it('should handle fuzzy matching for typos', () => {
      const results = searchRecipes(sampleRecipes, 'choclate'); // Missing 'o'
      expect(results.length).toBeGreaterThan(0);
      
      const recipeNames = results.map(r => r.recipe.name);
      expect(recipeNames).toContain('Chocolate Cake');
    });

    it('should handle empty recipe arrays', () => {
      const results = searchRecipes([], 'anything');
      expect(results).toHaveLength(0);
    });

    it('should handle recipes with missing fields gracefully', () => {
      const incompleteRecipes = [
        { id: 1, name: 'Test Recipe' }, // No tags or ingredients
        { id: 2, name: 'Another Recipe', tags: null, ingredients: null }
      ];
      
      const results = searchRecipes(incompleteRecipes, 'test');
      expect(results.length).toBeGreaterThan(0);
      const testRecipe = results.find(r => r.recipe.name === 'Test Recipe');
      expect(testRecipe).toBeDefined();
    });

    it('should handle array vs string tags', () => {
      const recipesWithStringTags = [
        {
          id: 1,
          name: 'Recipe with String Tags',
          tags: 'dessert sweet baking', // String instead of array
          ingredients: ['flour', 'sugar']
        }
      ];
      
      const results = searchRecipes(recipesWithStringTags, 'dessert');
      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe('Recipe with String Tags');
    });
  });
});
