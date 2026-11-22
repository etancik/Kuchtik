/**
 * Unit tests for RecipeUI component with RecipeRepository integration
 */

import { jest } from '@jest/globals';

// Mock RecipeRepository
const mockRepository = {
  delete: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  getAll: jest.fn(),
  get: jest.fn()
};

// Mock template loader
const mockTemplateLoader = {
  loadTemplate: jest.fn().mockResolvedValue('<div id="recipe-modal">Mock Modal</div>')
};

// Mock i18n system
jest.unstable_mockModule('../i18n/i18n.js', () => ({
t: jest.fn((key, params = {}) => {
// Mock translations for test cases
const translations = {
'operations.deleteFailed': `Failed to delete recipe: ${params?.error || 'error'}`,
'confirmations.deleteRecipeMessage': `Are you sure you want to delete the recipe "${params?.recipeName}"?

This action cannot be undone and will permanently remove the recipe from your collection.`
};
return translations[key] || key;
}),
i18n: {
getCurrentLanguage: jest.fn(() => 'en')
}
}));jest.unstable_mockModule('../utils/templateLoader.js', () => ({
  templateLoader: mockTemplateLoader
}));

// Mock Bootstrap Modal
global.bootstrap = {
  Modal: jest.fn().mockImplementation(() => ({
    hide: jest.fn(),
    show: jest.fn()
  }))
};

// Mock DOM methods
global.document = {
  getElementById: jest.fn(),
  body: {
    insertAdjacentHTML: jest.fn()
  }
};

// Import the singleton instance after mocking
const { recipeUI } = await import('../components/RecipeUI.js');

describe('RecipeUI Repository Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the repository property
    recipeUI.repository = mockRepository;
    // Mock DOM methods
    global.alert = jest.fn();
    global.confirm = jest.fn();
  });

  describe('Repository Integration', () => {
    test('should delete recipe through repository', async () => {
      mockRepository.delete.mockResolvedValue({ success: true });
      recipeUI.showErrorMessage = jest.fn();

      await recipeUI.handleDeleteRecipe('test-recipe');

      expect(mockRepository.delete).toHaveBeenCalledWith('test-recipe');
      expect(recipeUI.showErrorMessage).not.toHaveBeenCalled();
    });

    test('should handle delete errors gracefully', async () => {
      const errorMessage = 'Network error';
      mockRepository.delete.mockRejectedValue(new Error(errorMessage));
      recipeUI.showErrorMessage = jest.fn();

      await recipeUI.handleDeleteRecipe('test-recipe');

      expect(mockRepository.delete).toHaveBeenCalledWith('test-recipe');
      expect(recipeUI.showErrorMessage).toHaveBeenCalledWith(`Failed to delete recipe: ${errorMessage}`);
    });

    test('should update recipe through repository when editing', async () => {
      const testRecipe = { name: 'Test Recipe', ingredients: ['ingredient1'] };
      mockRepository.update.mockResolvedValue({ success: true });
      recipeUI.editingRecipe = { id: 'original-name', name: 'original-name' }; // Include id field
      recipeUI.isEditing = true;
      recipeUI.modal = { hide: jest.fn() };
      recipeUI.collectFormData = jest.fn().mockReturnValue(testRecipe);

      // Mock form submission event
      const mockEvent = { preventDefault: jest.fn() };
      global.document.getElementById = jest.fn().mockReturnValue({
        disabled: false,
        innerHTML: 'Submit'
      });

      await recipeUI.handleFormSubmit(mockEvent);

      expect(mockRepository.update).toHaveBeenCalledWith('original-name', testRecipe);
      expect(recipeUI.modal.hide).toHaveBeenCalled();
    });

    test('should create recipe through repository when not editing', async () => {
      const testRecipe = { name: 'New Recipe', ingredients: ['ingredient1'] };
      mockRepository.create.mockResolvedValue({ success: true });
      recipeUI.isEditing = false;
      recipeUI.modal = { hide: jest.fn() };
      recipeUI.collectFormData = jest.fn().mockReturnValue(testRecipe);

      // Mock form submission event
      const mockEvent = { preventDefault: jest.fn() };
      global.document.getElementById = jest.fn().mockReturnValue({
        disabled: false,
        innerHTML: 'Submit'
      });

      await recipeUI.handleFormSubmit(mockEvent);

      expect(mockRepository.create).toHaveBeenCalledWith(testRecipe);
      expect(recipeUI.modal.hide).toHaveBeenCalled();
    });
  });

  describe('Confirmation logic', () => {
    test('should call handleDeleteRecipe when user confirms', async () => {
      global.confirm = jest.fn().mockReturnValue(true);
      recipeUI.handleDeleteRecipe = jest.fn().mockResolvedValue();

      await recipeUI.showDeleteConfirmation('test-recipe', 'Test Recipe');

      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to delete the recipe "Test Recipe"?')
      );
      expect(recipeUI.handleDeleteRecipe).toHaveBeenCalledWith('test-recipe');
    });

    test('should not delete when user cancels', async () => {
      global.confirm = jest.fn().mockReturnValue(false);
      recipeUI.handleDeleteRecipe = jest.fn();

      await recipeUI.showDeleteConfirmation('test-recipe', 'Test Recipe');

      expect(recipeUI.handleDeleteRecipe).not.toHaveBeenCalled();
    });
  });

  describe('Recipe form', () => {
    test('should preserve exportDefault values when editing recipe', () => {
      // Setup a recipe with mixed exportDefault values
      const originalRecipe = {
        id: 'test-recipe',
        name: 'Test Recipe',
        ingredients: [
          { text: 'main ingredient', exportDefault: true },
          { text: 'salt', exportDefault: false },
          { text: 'pepper', exportDefault: false }
        ]
      };

      // Setup editing mode
      recipeUI.isEditing = true;
      recipeUI.editingRecipe = originalRecipe;

      // Test the getIngredientExportDefault method directly
      expect(recipeUI.getIngredientExportDefault(0, 'main ingredient')).toBe(true);
      expect(recipeUI.getIngredientExportDefault(1, 'salt')).toBe(false);
      expect(recipeUI.getIngredientExportDefault(2, 'pepper')).toBe(false);
      
      // Test with new ingredient (should get default value)
      expect(recipeUI.getIngredientExportDefault(3, 'new ingredient')).toBe(true);
      
      // Test with modified but similar text
      expect(recipeUI.getIngredientExportDefault(1, 'sea salt')).toBe(false); // Should match 'salt'
    });
  });
});
