/**
 * Tests for fullscreen recipe functionality
 */

import { jest } from '@jest/globals';
import { showFullscreenRecipe } from '../services/fullscreenRecipe.js';

describe('Fullscreen Recipe', () => {
  beforeEach(() => {
    // Mock fetch for template loading
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('fullscreen-modal.html')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            <div class="modal fade" id="fullscreenRecipeModal" tabindex="-1" aria-labelledby="fullscreenRecipeModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-fullscreen">
                <div class="modal-content bg-dark text-light">
                  <div class="modal-header border-secondary d-flex justify-content-between">
                    <h1 class="modal-title fs-4 me-3" id="fullscreenRecipeModalLabel">{{recipeName}}</h1>
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="keepScreenOnToggle">
                      <label class="form-check-label text-light" for="keepScreenOnToggle">
                        {{keepScreenOnLabel}}
                      </label>
                    </div>
                  </div>
                  <div class="modal-body">
                    {{ingredients}}
                    {{instructions}}
                  </div>
                </div>
              </div>
            </div>
          `)
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });

    // Mock window.location and history
    delete window.location;
    delete window.history;
    
    window.location = {
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      toString: () => 'http://localhost:3000/'
    };
    
    window.history = {
      pushState: jest.fn(),
      replaceState: jest.fn()
    };

    // Mock URL constructor
    global.URL = class MockURL {
      constructor(url) {
        if (typeof url === 'object') {
          this.href = url.href || 'http://localhost:3000/';
        } else {
          this.href = url;
        }
        this.searchParams = {
          set: jest.fn(),
          get: jest.fn(),
          delete: jest.fn(),
          toString: jest.fn(() => '')
        };
      }
      toString() {
        return this.href;
      }
    };

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

  test('should create and show fullscreen modal with recipe data', async () => {
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

    await showFullscreenRecipe(mockRecipe);

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

  test('should handle recipe with minimal data', async () => {
    const mockRecipe = {
      name: 'Simple Recipe'
    };

    await showFullscreenRecipe(mockRecipe);

    const modal = document.getElementById('fullscreenRecipeModal');
    expect(modal).toBeTruthy();
    expect(modal.innerHTML).toContain('Simple Recipe');
  });

  test('should remove existing modal before creating new one', async () => {
    const mockRecipe = { name: 'Recipe 1' };
    
    await showFullscreenRecipe(mockRecipe);
    const firstModal = document.getElementById('fullscreenRecipeModal');
    expect(firstModal.innerHTML).toContain('Recipe 1');

    // Show another recipe
    const mockRecipe2 = { name: 'Recipe 2' };
    await showFullscreenRecipe(mockRecipe2);
    
    const secondModal = document.getElementById('fullscreenRecipeModal');
    expect(secondModal.innerHTML).toContain('Recipe 2');
    expect(secondModal.innerHTML).not.toContain('Recipe 1');

    // Should only have one modal
    const allModals = document.querySelectorAll('#fullscreenRecipeModal');
    expect(allModals.length).toBe(1);
  });
});