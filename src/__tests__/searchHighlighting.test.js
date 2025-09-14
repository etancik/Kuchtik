/**
 * Tests for search highlighting functionality
 */

import { searchRecipesWithHighlighting, highlightText } from '../utils/recipeUtils.js';

describe('Search highlighting functionality', () => {
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
    }
  ];

  describe('highlightText', () => {
    it('should return original text when no matches', () => {
      const result = highlightText('Hello World', []);
      expect(result).toBe('Hello World');
    });

    it('should return empty string for empty text', () => {
      const result = highlightText('', []);
      expect(result).toBe('');
    });

    it('should highlight single match', () => {
      const matches = [{ start: 0, end: 5, type: 'exact' }];
      const result = highlightText('Hello World', matches);
      expect(result).toBe('<mark class="search-highlight">Hello</mark> World');
    });

    it('should highlight multiple matches', () => {
      const matches = [
        { start: 0, end: 5, type: 'substring' },
        { start: 6, end: 11, type: 'substring' }
      ];
      const result = highlightText('Hello World', matches);
      expect(result).toBe('<mark class="search-highlight">Hello</mark> <mark class="search-highlight">World</mark>');
    });

    it('should handle overlapping matches by sorting', () => {
      const matches = [
        { start: 6, end: 11, type: 'substring' },
        { start: 0, end: 5, type: 'substring' }
      ];
      const result = highlightText('Hello World', matches);
      expect(result).toBe('<mark class="search-highlight">Hello</mark> <mark class="search-highlight">World</mark>');
    });

    it('should handle matches at the end of text', () => {
      const matches = [{ start: 6, end: 11, type: 'substring' }];
      const result = highlightText('Hello World', matches);
      expect(result).toBe('Hello <mark class="search-highlight">World</mark>');
    });
  });

  describe('searchRecipesWithHighlighting', () => {
    it('should return all recipes with empty matches when no query', () => {
      const results = searchRecipesWithHighlighting(sampleRecipes, '');
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.recipe).toBeDefined();
        expect(result.matches).toEqual({ name: [], tags: [], ingredients: [] });
        expect(result.shouldExpand).toBe(false);
      });
    });

    it('should return recipes with name matches highlighted', () => {
      const results = searchRecipesWithHighlighting(sampleRecipes, 'Chocolate');
      expect(results.length).toBeGreaterThan(0);
      
      const chocolateResult = results.find(r => r.recipe.name === 'Chocolate Cake');
      expect(chocolateResult).toBeDefined();
      expect(chocolateResult.matches.name).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            start: expect.any(Number),
            end: expect.any(Number),
            type: expect.any(String)
          })
        ])
      );
    });

    it('should return recipes with tag matches highlighted', () => {
      const results = searchRecipesWithHighlighting(sampleRecipes, 'dessert');
      expect(results.length).toBeGreaterThan(0);
      
      const dessertResult = results.find(r => r.recipe.name === 'Chocolate Cake');
      expect(dessertResult).toBeDefined();
      expect(dessertResult.matches.tags.length).toBeGreaterThan(0);
    });

    it('should return recipes with ingredient matches and shouldExpand=true', () => {
      const results = searchRecipesWithHighlighting(sampleRecipes, 'chicken');
      expect(results.length).toBeGreaterThan(0);
      
      const chickenResult = results.find(r => r.recipe.name === 'Chicken Soup');
      expect(chickenResult).toBeDefined();
      expect(chickenResult.matches.ingredients.length).toBeGreaterThan(0);
      expect(chickenResult.shouldExpand).toBe(true);
    });

    it('should sort results by score (highest first)', () => {
      const results = searchRecipesWithHighlighting(sampleRecipes, 'soup');
      expect(results.length).toBeGreaterThan(0);
      
      // Results should be sorted by score
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should handle empty recipe array', () => {
      const results = searchRecipesWithHighlighting([], 'anything');
      expect(results).toHaveLength(0);
    });

    it('should filter by minimum score', () => {
      const results = searchRecipesWithHighlighting(sampleRecipes, 'xyz', 0.8);
      expect(results).toHaveLength(0);
    });

    it('should handle recipes with missing fields', () => {
      const incompleteRecipes = [
        { id: 1, name: 'Test Recipe' }, // No tags or ingredients
      ];
      
      const results = searchRecipesWithHighlighting(incompleteRecipes, 'test');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].recipe.name).toBe('Test Recipe');
      expect(results[0].matches).toBeDefined();
    });
  });
});
