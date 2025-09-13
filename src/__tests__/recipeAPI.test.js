/**
 * Tests for recipe API service
 */

import { getRecipeFileList, loadRecipe, loadAllRecipes } from '../services/recipeAPI.js';

describe('recipeAPI', () => {
  describe('getRecipeFileList', () => {
    test('should fetch and filter recipe files', async () => {
      const mockFiles = [
        { type: 'file', name: 'gulas.json' },
        { type: 'file', name: 'palacinky.json' },
        { type: 'file', name: 'README.md' },
        { type: 'dir', name: 'subfolder' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFiles
      });

      const result = await getRecipeFileList();
      
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/etancik/Kuchtik/contents/recepty'
      );
      expect(result).toEqual(['gulas.json', 'palacinky.json']);
    });

    test('should throw error on API failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(getRecipeFileList()).rejects.toThrow('GitHub API error: 404');
    });
  });

  describe('loadRecipe', () => {
    test('should load recipe from URL', async () => {
      const mockRecipe = { nazev: 'Test Recipe', ingredience: ['test'] };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecipe
      });

      const result = await loadRecipe('recepty/test.json');
      
      expect(fetch).toHaveBeenCalledWith('recepty/test.json');
      expect(result).toEqual(mockRecipe);
    });

    test('should throw error on load failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(loadRecipe('recepty/missing.json')).rejects.toThrow(
        'Failed to load recipe: recepty/missing.json (404)'
      );
    });
  });

  describe('loadAllRecipes', () => {
    test('should load all recipes via GitHub API', async () => {
      const mockFiles = [
        { type: 'file', name: 'recipe1.json' },
        { type: 'file', name: 'recipe2.json' }
      ];
      
      const mockRecipe1 = { nazev: 'Recipe 1' };
      const mockRecipe2 = { nazev: 'Recipe 2' };

      // Mock GitHub API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFiles
      });

      // Mock individual recipe loads
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRecipe1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRecipe2
        });

      const result = await loadAllRecipes();
      
      expect(result).toEqual([mockRecipe1, mockRecipe2]);
      expect(fetch).toHaveBeenCalledTimes(3); // 1 for file list + 2 for recipes
    });

    test('should fallback to hardcoded list on GitHub API failure', async () => {
      const mockRecipe = { nazev: 'Fallback Recipe' };

      // Mock GitHub API failure
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Mock fallback recipe loads
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRecipe
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRecipe
        });

      const result = await loadAllRecipes();
      
      expect(result).toEqual([mockRecipe, mockRecipe]);
      expect(fetch).toHaveBeenCalledWith('recepty/gulas.json');
      expect(fetch).toHaveBeenCalledWith('recepty/palacinky.json');
    });
  });
});
