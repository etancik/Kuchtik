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
  get: jest.fn(),
  on: jest.fn(),
  setGitHubAPI: jest.fn()
};

// Mock template loader
const mockTemplateLoader = {
  loadTemplate: jest.fn().mockResolvedValue('<div id="recipe-modal">Mock Modal</div>')
};

// Mock the imports
jest.unstable_mockModule('../repositories/RecipeRepository.js', () => ({
  default: jest.fn(() => mockRepository)
}));

jest.unstable_mockModule('../adapters/GitHubAPIAdapter.js', () => ({
  default: {}
}));

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
const recipeUI = (await import('../components/RecipeUI.js')).default;

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

  describe('Event Handling', () => {
    beforeEach(() => {
      // Clear previous mock calls to start fresh
      mockRepository.on.mockClear();
      
      // Re-initialize the event handlers by calling setupRepositoryEventHandlers
      if (recipeUI.setupRepositoryEventHandlers) {
        recipeUI.setupRepositoryEventHandlers();
      }
    });

    test('should listen for recipesUpdated events and refresh display', () => {
      // Mock refreshRecipesDisplay method
      recipeUI.refreshRecipesDisplay = jest.fn();
      
      // Find the recipesUpdated event listener call
      const recipesUpdatedCall = mockRepository.on.mock.calls.find(call => call[0] === 'recipesUpdated');
      expect(recipesUpdatedCall).toBeDefined();
      expect(typeof recipesUpdatedCall[1]).toBe('function');
      
      // Simulate the event being triggered with a recipe array
      const mockRecipes = [
        { id: 'recipe1', name: 'Test Recipe 1' },
        { id: 'recipe2', name: 'Test Recipe 2' }
      ];
      
      // Call the event handler
      recipesUpdatedCall[1](mockRecipes);
      
      // Verify refreshRecipesDisplay was called
      expect(recipeUI.refreshRecipesDisplay).toHaveBeenCalled();
    });

    test('should listen for cacheUpdated events and refresh display', () => {
      // Mock handleCacheUpdate method
      recipeUI.handleCacheUpdate = jest.fn();
      
      // Find the cacheUpdated event listener call
      const cacheUpdatedCall = mockRepository.on.mock.calls.find(call => call[0] === 'cacheUpdated');
      expect(cacheUpdatedCall).toBeDefined();
      expect(typeof cacheUpdatedCall[1]).toBe('function');
      
      // Simulate the event being triggered
      const mockEvent = { recipe: { id: 'test', name: 'Test Recipe' } };
      
      // Call the event handler
      cacheUpdatedCall[1](mockEvent);
      
      // Verify handleCacheUpdate was called
      expect(recipeUI.handleCacheUpdate).toHaveBeenCalledWith(mockEvent);
    });

    test('should setup all required repository event listeners', () => {
      // Verify all expected event listeners are registered
      const expectedEvents = [
        'optimisticUpdate',
        'operationSuccess', 
        'operationFailure',
        'rollback',
        'cacheUpdated',
        'recipesUpdated',
        'syncStatusChange'
      ];

      expectedEvents.forEach(eventName => {
        const eventCall = mockRepository.on.mock.calls.find(call => call[0] === eventName);
        expect(eventCall).toBeDefined();
        expect(typeof eventCall[1]).toBe('function'); // Verify the handler is a function
      });

      // Verify we have at least the expected number of event listeners
      const uniqueEventNames = [...new Set(mockRepository.on.mock.calls.map(call => call[0]))];
      expectedEvents.forEach(eventName => {
        expect(uniqueEventNames).toContain(eventName);
      });
    });
  });
});
