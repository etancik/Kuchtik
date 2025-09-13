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
        'https://api.github.com/repos/etancik/Kuchtik/contents/recipes'
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
    test('should load recipe from GitHub with fallback strategies', async () => {
      const mockRecipe = { name: 'Test Recipe', ingredients: ['test'] };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecipe
      });

      const result = await loadRecipe('test.json');
      
      // Should call with cache busting parameter (first strategy)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/https:\/\/raw\.githubusercontent\.com\/etancik\/Kuchtik\/main\/recipes\/test\.json\?t=\d+/)
      );
      expect(result).toEqual(mockRecipe);
    });

    test('should throw error when all strategies fail', async () => {
      // Mock all strategies to fail
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(loadRecipe('missing.json')).rejects.toThrow('Network error');
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

    test('should handle GitHub API failure gracefully', async () => {
      // Mock GitHub API failure
      fetch.mockRejectedValueOnce(new Error('GitHub API unavailable'));

      await expect(loadAllRecipes()).rejects.toThrow('GitHub API unavailable');
    });

    test('should handle individual recipe load failures', async () => {
      const mockFiles = [
        { type: 'file', name: 'recipe1.json' },
        { type: 'file', name: 'recipe2.json' }
      ];
      
      const mockRecipe1 = { nazev: 'Recipe 1' };

      // Mock GitHub API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFiles
      });

      // Mock both recipes to succeed (since parallel loading means both are attempted)
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRecipe1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ nazev: 'Recipe 2' })
        });

      const result = await loadAllRecipes();
      
      expect(result).toHaveLength(2); // Both recipes should load successfully
    });
  });
});
