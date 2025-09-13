/**
 * Unit tests for RecipeUI component (simplified)
 * Focus on testable logic without complex DOM mocking
 */

import { jest } from '@jest/globals';

// Mock dependencies first
const mockGithubAuth = {
  isAuthenticated: jest.fn(),
  makeAuthenticatedRequest: jest.fn()
};

const mockRecipeCreation = {
  createRecipe: jest.fn(),
  updateRecipe: jest.fn(),
  deleteRecipe: jest.fn()
};

// Mock the imports
jest.unstable_mockModule('../services/githubAuth.js', () => ({
  githubAuth: mockGithubAuth
}));

jest.unstable_mockModule('../services/recipeCreation.js', () => ({
  recipeCreation: mockRecipeCreation
}));

jest.unstable_mockModule('../utils/templateLoader.js', () => ({
  templateLoader: { loadTemplate: jest.fn() }
}));

jest.unstable_mockModule('../services/recipeAPI.js', () => ({
  loadAllRecipes: jest.fn(),
  clearRecipeCache: jest.fn(),
  getCacheStatus: jest.fn()
}));

// Import the class after mocking
const { recipeUI } = await import('../components/RecipeUI.js');

describe('RecipeUI - Core Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance state
    recipeUI.isEditing = false;
    recipeUI.editingRecipe = null;
  });

  describe('Authentication checks', () => {
    test('should check authentication before delete', async () => {
      mockGithubAuth.isAuthenticated.mockReturnValue(false);
      global.alert = jest.fn();

      await recipeUI.handleDeleteRecipe('Test Recipe');

      expect(mockGithubAuth.isAuthenticated).toHaveBeenCalled();
      expect(global.alert).toHaveBeenCalledWith('Authentication required. Please authenticate first.');
      expect(mockRecipeCreation.deleteRecipe).not.toHaveBeenCalled();
    });

    test('should proceed with delete when authenticated', async () => {
      mockGithubAuth.isAuthenticated.mockReturnValue(true);
      mockRecipeCreation.deleteRecipe.mockResolvedValue({ success: true });
      
      // Mock the methods that would normally interact with DOM
      recipeUI.refreshRecipes = jest.fn().mockResolvedValue();
      recipeUI.showSuccessMessage = jest.fn();

      await recipeUI.handleDeleteRecipe('Test Recipe');

      expect(mockRecipeCreation.deleteRecipe).toHaveBeenCalledWith('Test Recipe');
      expect(recipeUI.refreshRecipes).toHaveBeenCalled();
      expect(recipeUI.showSuccessMessage).toHaveBeenCalledWith('Recipe "Test Recipe" deleted successfully!');
    });
  });

  describe('Error handling', () => {
    test('should handle delete errors gracefully', async () => {
      mockGithubAuth.isAuthenticated.mockReturnValue(true);
      const errorMessage = 'Network error';
      mockRecipeCreation.deleteRecipe.mockRejectedValue(new Error(errorMessage));
      global.alert = jest.fn();

      await recipeUI.handleDeleteRecipe('Test Recipe');

      expect(global.alert).toHaveBeenCalledWith(`Failed to delete recipe: ${errorMessage}`);
    });
  });

  describe('Confirmation logic', () => {
    test('should call handleDeleteRecipe when user confirms', async () => {
      global.confirm = jest.fn().mockReturnValue(true);
      recipeUI.handleDeleteRecipe = jest.fn().mockResolvedValue();

      await recipeUI.showDeleteConfirmation('Test Recipe');

      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to delete the recipe "Test Recipe"?')
      );
      expect(recipeUI.handleDeleteRecipe).toHaveBeenCalledWith('Test Recipe');
    });

    test('should not delete when user cancels', async () => {
      global.confirm = jest.fn().mockReturnValue(false);
      recipeUI.handleDeleteRecipe = jest.fn();

      await recipeUI.showDeleteConfirmation('Test Recipe');

      expect(recipeUI.handleDeleteRecipe).not.toHaveBeenCalled();
    });
  });
});
