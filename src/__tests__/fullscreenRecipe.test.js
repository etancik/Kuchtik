/**
 * Tests for fullscreen recipe functionality
 */

import { jest } from '@jest/globals';
import { showFullscreenRecipe } from '../services/fullscreenRecipe.js';

describe('Fullscreen Recipe', () => {
  beforeEach(() => {
    // Mock Bootstrap
    global.window = Object.create(window);
    global.window.bootstrap = {
      Modal: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        hide: jest.fn()
      }))
    };

    // Mock navigator.wakeLock
    global.navigator.wakeLock = {
      request: jest.fn().mockResolvedValue({
        addEventListener: jest.fn(),
        release: jest.fn().mockResolvedValue(undefined)
      })
    };

    // Clean up any existing modals
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should create and show fullscreen modal with recipe data', () => {
    const mockRecipe = {
      name: 'Test Recipe',
      ingredients: [
        { text: '1 cup flour', exportDefault: true },
        { text: '2 eggs', exportDefault: true }
      ],
      instructions: ['Mix ingredients', 'Cook for 30 minutes'],
      tags: ['quick', 'easy'],
      servings: 4,
      cookingTime: '30 min',
      notes: ['Serve hot']
    };

    showFullscreenRecipe(mockRecipe);

    // Check if modal was created
    const modal = document.getElementById('fullscreenRecipeModal');
    expect(modal).toBeTruthy();

    // Check if recipe name is displayed
    expect(modal.innerHTML).toContain('Test Recipe');

    // Check if ingredients are displayed
    expect(modal.innerHTML).toContain('1 cup flour');
    expect(modal.innerHTML).toContain('2 eggs');

    // Check if instructions are displayed
    expect(modal.innerHTML).toContain('Mix ingredients');
    expect(modal.innerHTML).toContain('Cook for 30 minutes');

    // Check if wake lock toggle is present
    const wakeLockToggle = modal.querySelector('#keepScreenOnToggle');
    expect(wakeLockToggle).toBeTruthy();

    // Check if Bootstrap Modal was initialized
    expect(window.bootstrap.Modal).toHaveBeenCalled();
  });

  test('should handle recipe with minimal data', () => {
    const mockRecipe = {
      name: 'Simple Recipe'
    };

    showFullscreenRecipe(mockRecipe);

    const modal = document.getElementById('fullscreenRecipeModal');
    expect(modal).toBeTruthy();
    expect(modal.innerHTML).toContain('Simple Recipe');
  });

  test('should remove existing modal before creating new one', () => {
    const mockRecipe = { name: 'Recipe 1' };
    
    showFullscreenRecipe(mockRecipe);
    const firstModal = document.getElementById('fullscreenRecipeModal');
    expect(firstModal.innerHTML).toContain('Recipe 1');

    // Show another recipe
    const mockRecipe2 = { name: 'Recipe 2' };
    showFullscreenRecipe(mockRecipe2);
    
    const secondModal = document.getElementById('fullscreenRecipeModal');
    expect(secondModal.innerHTML).toContain('Recipe 2');
    expect(secondModal.innerHTML).not.toContain('Recipe 1');

    // Should only have one modal
    const allModals = document.querySelectorAll('#fullscreenRecipeModal');
    expect(allModals.length).toBe(1);
  });
});