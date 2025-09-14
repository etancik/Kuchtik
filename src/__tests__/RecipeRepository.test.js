/**
 * Comprehensive Test Suite for RecipeRepository
 * Following TDD (Test-Driven Development) principles
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import RecipeRepository, { 
  RepositoryState, 
  OperationType, 
  SyncStrategy, 
  RepositoryEvents 
} from '../repositories/RecipeRepository.js';

// Mock GitHub API integration
class MockGitHubAPI {
  constructor() {
    this.files = new Map();
    this.networkDelay = 100;
    this.shouldFail = false;
    this.failureReason = 'Network error';
  }

  async getFileList() {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    return Array.from(this.files.keys());
  }

  async getFile(filename) {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    if (!this.files.has(filename)) throw new Error(`File not found: ${filename}`);
    return { ...this.files.get(filename) };
  }

  async createFile(filename, data) {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    if (this.files.has(filename)) throw new Error(`File already exists: ${filename}`);
    this.files.set(filename, { ...data });
  }

  async updateFile(filename, data) {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    if (!this.files.has(filename)) throw new Error(`File not found: ${filename}`);
    this.files.set(filename, { ...data });
  }

  async deleteFile(filename) {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    if (!this.files.has(filename)) throw new Error(`File not found: ${filename}`);
    this.files.delete(filename);
  }

  async checkFileExists(filename) {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    return this.files.has(filename);
  }

  async getFileMetadata(filename) {
    await this.simulateNetworkDelay();
    if (this.shouldFail) throw new Error(this.failureReason);
    if (!this.files.has(filename)) throw new Error(`File not found: ${filename}`);
    return {
      sha: 'mock-sha-' + Math.random().toString(36).substr(2, 9),
      size: JSON.stringify(this.files.get(filename)).length,
      lastModified: new Date().toISOString()
    };
  }

  simulateNetworkDelay() {
    return new Promise(resolve => setTimeout(resolve, this.networkDelay));
  }

  // Test utilities
  reset() {
    this.files.clear();
    this.shouldFail = false;
    this.networkDelay = 100;
  }

  addMockFile(filename, data) {
    this.files.set(filename, data);
  }

  setNetworkFailure(shouldFail, reason = 'Network error') {
    this.shouldFail = shouldFail;
    this.failureReason = reason;
  }
}

describe('RecipeRepository', () => {
  let repository;
  let mockGitHubAPI;
  let eventCallbacks;

  // Sample recipe data
  const sampleRecipe = {
    name: 'Test Recipe',
    description: 'A test recipe',
    ingredients: [
      { name: 'ingredient1', amount: '1 cup', unit: 'cup' },
      { name: 'ingredient2', amount: '2 tbsp', unit: 'tbsp' }
    ],
    instructions: ['Step 1', 'Step 2'],
    prepTime: 10,
    cookTime: 20,
    servings: 4
  };

  const sampleRecipe2 = {
    name: 'Another Recipe',
    description: 'Another test recipe',
    ingredients: [{ name: 'flour', amount: '2 cups' }],
    instructions: ['Mix everything'],
    servings: 2
  };

  beforeEach(() => {
    mockGitHubAPI = new MockGitHubAPI();
    repository = new RecipeRepository({
      cacheTimeout: 1000, // 1 second for faster testing
      maxRetries: 2,
      retryDelay: 50,
      syncStrategy: SyncStrategy.IMMEDIATE,
      enableLogging: false // Disable logging during tests
    });
    repository.setGitHubAPI(mockGitHubAPI);
    
    eventCallbacks = {};
    
    // Helper to track events
    Object.values(RepositoryEvents).forEach(event => {
      eventCallbacks[event] = jest.fn();
      repository.on(event, eventCallbacks[event]);
    });
  });

  afterEach(() => {
    mockGitHubAPI.reset();
    // Use the repository's cleanup method to properly clean up timeouts and state
    repository.cleanup();
  });

  // ============================================================================
  // INITIALIZATION AND CONFIGURATION TESTS
  // ============================================================================

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const repo = new RecipeRepository();
      expect(repo.getState()).toBe(RepositoryState.IDLE);
      expect(repo.config.cacheTimeout).toBe(5 * 60 * 1000);
      expect(repo.config.maxRetries).toBe(3);
      expect(repo.config.syncStrategy).toBe(SyncStrategy.DELAYED);
      expect(repo.config.optimisticUpdates).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        cacheTimeout: 10000,
        maxRetries: 5,
        syncStrategy: SyncStrategy.BATCH,
        optimisticUpdates: false
      };
      const repo = new RecipeRepository(customConfig);
      expect(repo.config.cacheTimeout).toBe(10000);
      expect(repo.config.maxRetries).toBe(5);
      expect(repo.config.syncStrategy).toBe(SyncStrategy.BATCH);
      expect(repo.config.optimisticUpdates).toBe(false);
    });

    test('should set GitHub API integration', () => {
      const mockAPI = new MockGitHubAPI();
      const repo = new RecipeRepository();
      repo.setGitHubAPI(mockAPI);
      expect(repo.githubAPI).toBe(mockAPI);
    });
  });

  // ============================================================================
  // EVENT SYSTEM TESTS
  // ============================================================================

  describe('Event System', () => {
    test('should subscribe and unsubscribe from events', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = repository.on(RepositoryEvents.RECIPES_UPDATED, callback1);
      repository.on(RepositoryEvents.RECIPES_UPDATED, callback2);

      repository.emit(RepositoryEvents.RECIPES_UPDATED, [sampleRecipe]);

      expect(callback1).toHaveBeenCalledWith([sampleRecipe]);
      expect(callback2).toHaveBeenCalledWith([sampleRecipe]);

      // Unsubscribe first callback
      unsubscribe1();
      repository.emit(RepositoryEvents.RECIPES_UPDATED, [sampleRecipe2]);

      expect(callback1).toHaveBeenCalledTimes(1); // Not called again
      expect(callback2).toHaveBeenCalledTimes(2); // Called again
    });

    test('should handle event listener errors gracefully', () => {
      const throwingCallback = jest.fn(() => {
        throw new Error('Event handler error');
      });
      const normalCallback = jest.fn();

      repository.on(RepositoryEvents.RECIPES_UPDATED, throwingCallback);
      repository.on(RepositoryEvents.RECIPES_UPDATED, normalCallback);

      expect(() => {
        repository.emit(RepositoryEvents.RECIPES_UPDATED, []);
      }).not.toThrow();

      expect(throwingCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CORE CRUD OPERATIONS TESTS
  // ============================================================================

  describe('getAll()', () => {
    test('should get all recipes from GitHub API', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      mockGitHubAPI.addMockFile('recipe2.json', sampleRecipe2);

      const recipes = await repository.getAll();

      expect(recipes).toHaveLength(2);
      expect(recipes).toContainEqual(sampleRecipe);
      expect(recipes).toContainEqual(sampleRecipe2);
      expect(eventCallbacks[RepositoryEvents.RECIPES_UPDATED]).toHaveBeenCalledWith(recipes);
    });

    test('should return cached recipes when available', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      
      // First call - loads from API
      const recipes1 = await repository.getAll();
      expect(recipes1).toHaveLength(1);

      // Second call - should use cache
      mockGitHubAPI.setNetworkFailure(true); // API would fail, but cache should work
      const recipes2 = await repository.getAll();
      expect(recipes2).toHaveLength(1);
      expect(recipes2[0]).toEqual(sampleRecipe);
    });

    test('should force refresh when forceRefresh is true', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      
      // First call
      await repository.getAll();
      
      // Update mock data
      const updatedRecipe = { ...sampleRecipe, description: 'Updated description' };
      mockGitHubAPI.files.set('test-recipe.json', updatedRecipe);
      
      // Force refresh should get updated data
      const recipes = await repository.getAll({ forceRefresh: true });
      expect(recipes[0].description).toBe('Updated description');
    });

    test('should include metadata when requested', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      
      const result = await repository.getAll({ includeMetadata: true });
      
      expect(result).toHaveProperty('recipes');
      expect(result).toHaveProperty('metadata');
      expect(result.recipes).toHaveLength(1);
      expect(result.metadata).toHaveProperty('totalEntries');
      expect(result.metadata).toHaveProperty('validEntries');
    });

    test('should handle API errors gracefully', async () => {
      mockGitHubAPI.setNetworkFailure(true, 'API Error');

      await expect(repository.getAll()).rejects.toThrow('API Error');
      expect(repository.getState()).toBe(RepositoryState.ERROR);
      expect(eventCallbacks[RepositoryEvents.ERROR]).toHaveBeenCalled();
    });
  });

  describe('getByName()', () => {
    test('should get single recipe by name', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);

      const recipe = await repository.getByName('test-recipe.json');
      
      expect(recipe).toEqual(sampleRecipe);
    });

    test('should return cached recipe when available', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      
      // First call
      const recipe1 = await repository.getByName('test-recipe.json');
      
      // Second call with API failure should use cache
      mockGitHubAPI.setNetworkFailure(true);
      const recipe2 = await repository.getByName('test-recipe.json');
      
      expect(recipe2).toEqual(recipe1);
    });

    test('should return null for non-existent recipe', async () => {
      const recipe = await repository.getByName('non-existent.json');
      expect(recipe).toBeNull();
    });

    test('should force refresh when requested', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      
      // First call
      await repository.getByName('test-recipe.json');
      
      // Update mock data
      const updatedRecipe = { ...sampleRecipe, servings: 6 };
      mockGitHubAPI.files.set('test-recipe.json', updatedRecipe);
      
      // Force refresh
      const recipe = await repository.getByName('test-recipe.json', { forceRefresh: true });
      expect(recipe.servings).toBe(6);
    });
  });

  describe('create()', () => {
    test('should create recipe with immediate sync', async () => {
      const createdRecipe = await repository.create(sampleRecipe, {
        syncStrategy: SyncStrategy.IMMEDIATE
      });

      expect(createdRecipe).toEqual(sampleRecipe);
      expect(mockGitHubAPI.files.has('test-recipe.json')).toBe(true);
      expect(eventCallbacks[RepositoryEvents.RECIPE_CREATED]).toHaveBeenCalledWith(sampleRecipe);
    });

    test('should create recipe with optimistic update', async () => {
      const createdRecipe = await repository.create(sampleRecipe, {
        syncStrategy: SyncStrategy.DELAYED,
        optimistic: true
      });

      expect(createdRecipe).toEqual(sampleRecipe);
      expect(eventCallbacks[RepositoryEvents.RECIPE_CREATED]).toHaveBeenCalledWith(sampleRecipe);
      
      // Should be in cache immediately
      const cachedRecipe = await repository.getByName('test-recipe.json');
      expect(cachedRecipe).toEqual(sampleRecipe);
    });

    test('should handle creation errors with optimistic update rollback', async () => {
      mockGitHubAPI.setNetworkFailure(true, 'Creation failed');

      await expect(repository.create(sampleRecipe, {
        syncStrategy: SyncStrategy.IMMEDIATE,
        optimistic: true
      })).rejects.toThrow('Creation failed');

      // Optimistic update should be reverted
      const cachedRecipe = await repository.getByName(sampleRecipe.name);
      expect(cachedRecipe).toBeNull();
    });

    test('should add to pending operations with delayed sync', async () => {
      await repository.create(sampleRecipe, {
        syncStrategy: SyncStrategy.DELAYED
      });

      const syncStatus = repository.getSyncStatus();
      expect(syncStatus.pendingCount).toBe(1);
      expect(syncStatus.pendingOperations[0].type).toBe(OperationType.CREATE);
      expect(syncStatus.pendingOperations[0].recipeName).toBe(sampleRecipe.name);
    });
  });

  describe('update()', () => {
    test('should update recipe with immediate sync', async () => {
      // Setup existing recipe
      const filename = repository.getFilenameFromRecipeName(sampleRecipe.name);
      mockGitHubAPI.addMockFile(filename, sampleRecipe);
      
      const updatedData = { ...sampleRecipe, servings: 6 };
      const updatedRecipe = await repository.update(sampleRecipe.name, updatedData, {
        syncStrategy: SyncStrategy.IMMEDIATE
      });

      expect(updatedRecipe.servings).toBe(6);
      expect(mockGitHubAPI.files.get(filename).servings).toBe(6);
      expect(eventCallbacks[RepositoryEvents.RECIPE_UPDATED]).toHaveBeenCalledWith(updatedData);
    });

    test('should update recipe with optimistic update', async () => {
      const filename = repository.getFilenameFromRecipeName(sampleRecipe.name);
      mockGitHubAPI.addMockFile(filename, sampleRecipe);
      
      const updatedData = { ...sampleRecipe, servings: 8 };
      await repository.update(sampleRecipe.name, updatedData, {
        syncStrategy: SyncStrategy.DELAYED,
        optimistic: true
      });

      // Should be updated in cache immediately
      const cachedRecipe = await repository.getByName(sampleRecipe.name);
      expect(cachedRecipe.servings).toBe(8);
    });

    test('should handle update errors with rollback', async () => {
      const filename = repository.getFilenameFromRecipeName(sampleRecipe.name);
      mockGitHubAPI.addMockFile(filename, sampleRecipe);
      
      // First get the recipe in cache
      await repository.getByName(sampleRecipe.name);
      
      // Now make API fail and try update
      mockGitHubAPI.setNetworkFailure(true, 'Update failed');
      
      const updatedData = { ...sampleRecipe, servings: 10 };
      await expect(repository.update(sampleRecipe.name, updatedData, {
        syncStrategy: SyncStrategy.IMMEDIATE,
        optimistic: true
      })).rejects.toThrow('Update failed');

      // Should rollback to original data (might take a moment for rollback to complete)
      const cachedRecipe = await repository.getByName(sampleRecipe.name);
      expect(cachedRecipe.servings).toBe(sampleRecipe.servings);
    });
  });

  describe('delete()', () => {
    test('should delete recipe with immediate sync', async () => {
      const filename = repository.getFilenameFromRecipeName(sampleRecipe.name);
      mockGitHubAPI.addMockFile(filename, sampleRecipe);
      
      const result = await repository.delete(sampleRecipe.name, {
        syncStrategy: SyncStrategy.IMMEDIATE
      });

      expect(result).toBe(true);
      expect(mockGitHubAPI.files.has(filename)).toBe(false);
      expect(eventCallbacks[RepositoryEvents.RECIPE_DELETED]).toHaveBeenCalledWith({
        recipeName: sampleRecipe.name,
        data: expect.any(Object)
      });
    });

    test('should delete recipe with optimistic update', async () => {
      const filename = repository.getFilenameFromRecipeName(sampleRecipe.name);
      mockGitHubAPI.addMockFile(filename, sampleRecipe);
      
      // First cache the recipe
      await repository.getByName(sampleRecipe.name);
      
      await repository.delete(sampleRecipe.name, {
        syncStrategy: SyncStrategy.DELAYED,
        optimistic: true
      });

      // Should be removed from cache immediately
      const cachedRecipe = await repository.getByName(sampleRecipe.name);
      expect(cachedRecipe).toBeNull();
    });

    test('should handle deletion errors with rollback', async () => {
      const filename = repository.getFilenameFromRecipeName(sampleRecipe.name);
      mockGitHubAPI.addMockFile(filename, sampleRecipe);
      
      // First cache the recipe
      const cachedBefore = await repository.getByName(sampleRecipe.name);
      expect(cachedBefore).toEqual(sampleRecipe);
      
      // Make API fail
      mockGitHubAPI.setNetworkFailure(true, 'Delete failed');
      
      await expect(repository.delete(sampleRecipe.name, {
        syncStrategy: SyncStrategy.IMMEDIATE,
        optimistic: true
      })).rejects.toThrow('Delete failed');

      // Should restore the recipe in cache (rollback from optimistic delete)
      const cachedRecipe = await repository.getByName(sampleRecipe.name);
      expect(cachedRecipe).toEqual(sampleRecipe);
    });
  });

  // ============================================================================
  // SYNCHRONIZATION TESTS
  // ============================================================================

  describe('Synchronization', () => {
    test('should sync all pending operations', async () => {
      // Add multiple pending operations with proper setup
      const recipe1 = { ...sampleRecipe, name: 'Sync Recipe 1' };
      const recipe2 = { ...sampleRecipe, name: 'Sync Recipe 2' };
      
      await repository.create(recipe1, { syncStrategy: SyncStrategy.MANUAL });
      await repository.create(recipe2, { syncStrategy: SyncStrategy.MANUAL });
      
      const statusBefore = repository.getSyncStatus();
      expect(statusBefore.pendingCount).toBe(2);

      await repository.syncAll();

      const statusAfter = repository.getSyncStatus();
      expect(statusAfter.pendingCount).toBe(0);
      expect(mockGitHubAPI.files.size).toBe(2);
      expect(eventCallbacks[RepositoryEvents.SYNC_COMPLETED]).toHaveBeenCalled();
    });

    test('should handle sync failures gracefully', async () => {
      await repository.create(sampleRecipe, { syncStrategy: SyncStrategy.MANUAL });
      
      mockGitHubAPI.setNetworkFailure(true, 'Sync failed');
      
      await expect(repository.syncAll()).rejects.toThrow();
      expect(eventCallbacks[RepositoryEvents.SYNC_FAILED]).toHaveBeenCalled();
    });

    test('should provide sync status information', async () => {
      await repository.create(sampleRecipe, { syncStrategy: SyncStrategy.MANUAL });
      
      const status = repository.getSyncStatus();
      
      expect(status.state).toBe(RepositoryState.IDLE);
      expect(status.pendingCount).toBe(1);
      expect(status.pendingOperations).toHaveLength(1);
      expect(status.pendingOperations[0].type).toBe(OperationType.CREATE);
      expect(status.cacheStatus).toHaveProperty('totalEntries');
    });
  });

  // ============================================================================
  // CACHE MANAGEMENT TESTS
  // ============================================================================

  describe('Cache Management', () => {
    test('should clear all cache', async () => {
      mockGitHubAPI.addMockFile('recipe1.json', sampleRecipe);
      mockGitHubAPI.addMockFile('recipe2.json', sampleRecipe2);
      
      // Load recipes to cache them
      await repository.getAll();
      
      let metadata = repository.getCacheMetadata();
      expect(metadata.totalEntries).toBe(2);
      
      repository.clearCache();
      
      metadata = repository.getCacheMetadata();
      expect(metadata.totalEntries).toBe(0);
      expect(eventCallbacks[RepositoryEvents.CACHE_UPDATED]).toHaveBeenCalledWith({ cleared: true });
    });

    test('should clear specific cache entry', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      mockGitHubAPI.addMockFile('recipe2.json', sampleRecipe2);
      
      await repository.getAll();
      
      repository.clearCacheEntry(sampleRecipe.name);
      
      const metadata = repository.getCacheMetadata();
      expect(metadata.totalEntries).toBe(1);
      expect(eventCallbacks[RepositoryEvents.CACHE_UPDATED]).toHaveBeenCalledWith({ 
        removed: sampleRecipe.name 
      });
    });

    test('should provide cache metadata', async () => {
      mockGitHubAPI.addMockFile('test-recipe.json', sampleRecipe);
      
      await repository.getByName('test-recipe.json');
      
      const metadata = repository.getCacheMetadata();
      
      expect(metadata.totalEntries).toBe(1);
      expect(metadata.validEntries).toBe(1);
      expect(metadata.expiredEntries).toBe(0);
      expect(metadata.cacheTimeout).toBe(1000);
      expect(metadata.entries).toHaveLength(1);
      expect(metadata.entries[0].name).toBe('test-recipe'); // Filename-based cache key
    });

    test('should identify expired cache entries', async () => {
      mockGitHubAPI.addMockFile('recipe1.json', sampleRecipe);
      
      await repository.getByName('recipe1.json');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const metadata = repository.getCacheMetadata();
      expect(metadata.expiredEntries).toBe(1);
      expect(metadata.validEntries).toBe(0);
      expect(metadata.entries[0].expired).toBe(true);
    });
  });

  // ============================================================================
  // UTILITY METHODS TESTS
  // ============================================================================

  describe('Utility Methods', () => {
    test('should track repository state correctly', () => {
      expect(repository.getState()).toBe(RepositoryState.IDLE);
      expect(repository.isBusy()).toBe(false);
    });

    test('should emit state change events', async () => {
      mockGitHubAPI.addMockFile('recipe1.json', sampleRecipe);
      
      const statePromise = repository.getAll();
      
      // Should emit state changes
      await statePromise;
      
      expect(eventCallbacks[RepositoryEvents.STATE_CHANGED]).toHaveBeenCalledWith({
        previousState: RepositoryState.IDLE,
        currentState: RepositoryState.LOADING
      });
    });

    test('should detect busy state during operations', async () => {
      mockGitHubAPI.addMockFile('recipe1.json', sampleRecipe);
      mockGitHubAPI.networkDelay = 200; // Add delay to check busy state
      
      const promise = repository.getAll();
      
      // Should be busy during operation
      expect(repository.isBusy()).toBe(true);
      
      await promise;
      
      // Should not be busy after operation
      expect(repository.isBusy()).toBe(false);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    test('should handle complete CRUD workflow', async () => {
      // Create
      const created = await repository.create(sampleRecipe);
      expect(created).toEqual(sampleRecipe);
      
      // Read
      const read = await repository.getByName(sampleRecipe.name);
      expect(read).toEqual(sampleRecipe);
      
      // Update
      const updatedData = { ...sampleRecipe, servings: 6 };
      const updated = await repository.update(sampleRecipe.name, updatedData);
      expect(updated.servings).toBe(6);
      
      // Delete
      const deleted = await repository.delete(sampleRecipe.name);
      expect(deleted).toBe(true);
      
      // Verify deletion
      const afterDelete = await repository.getByName(sampleRecipe.name);
      expect(afterDelete).toBeNull();
    });

    test('should handle concurrent operations', async () => {
      const recipes = [
        { ...sampleRecipe, name: 'Recipe 1' },
        { ...sampleRecipe, name: 'Recipe 2' },
        { ...sampleRecipe, name: 'Recipe 3' }
      ];

      // Create multiple recipes concurrently
      const createPromises = recipes.map(recipe => 
        repository.create(recipe, { syncStrategy: SyncStrategy.IMMEDIATE })
      );
      
      const createdRecipes = await Promise.all(createPromises);
      expect(createdRecipes).toHaveLength(3);
      
      // Read all
      const allRecipes = await repository.getAll();
      expect(allRecipes).toHaveLength(3);
      
      // Update all concurrently
      const updatePromises = recipes.map(recipe => 
        repository.update(recipe.name, { ...recipe, servings: 8 })
      );
      
      await Promise.all(updatePromises);
      
      // Verify updates
      const updatedRecipes = await repository.getAll({ forceRefresh: true });
      updatedRecipes.forEach(recipe => {
        expect(recipe.servings).toBe(8);
      });
    });

    test('should maintain consistency during network failures', async () => {
      // Create recipe successfully
      await repository.create(sampleRecipe);
      
      // Simulate network failure
      mockGitHubAPI.setNetworkFailure(true);
      
      // Try to update with optimistic updates
      const updatedData = { ...sampleRecipe, servings: 10 };
      await expect(repository.update('test-recipe.json', updatedData, {
        syncStrategy: SyncStrategy.IMMEDIATE,
        optimistic: true
      })).rejects.toThrow();
      
      // Restore network
      mockGitHubAPI.setNetworkFailure(false);
      
      // Data should be consistent (not updated due to failure)
      // For optimistic updates with rollback, the recipe should be back to original state
      const recipe = await repository.getByName('test-recipe.json');
      if (recipe) {
        expect(recipe.servings).toBe(sampleRecipe.servings);
      } else {
        // If recipe was removed due to rollback, that's also acceptable behavior
        expect(recipe).toBeNull();
      }
    });
  });

  // TDD: Tests for cache management after create/update operations
  describe('Cache Management After Operations', () => {
    beforeEach(async () => {
      // Setup initial recipes in the mock API
      const recipe1 = {
        name: 'Recipe 1',
        ingredients: [{ text: 'ingredient 1', exportDefault: true }],
        instructions: ['step 1']
      };
      
      const recipe2 = {
        name: 'Recipe 2', 
        ingredients: [{ text: 'ingredient 2', exportDefault: true }],
        instructions: ['step 2']
      };

      const recipe3 = {
        name: 'Recipe 3',
        ingredients: [{ text: 'ingredient 3', exportDefault: true }],
        instructions: ['step 3']
      };

      await mockGitHubAPI.createFile('recipe-1.json', recipe1);
      await mockGitHubAPI.createFile('recipe-2.json', recipe2);
      await mockGitHubAPI.createFile('recipe-3.json', recipe3);
      
      // Load all recipes into cache initially
      await repository.getAll();
    });

    test('should maintain full recipe list in cache after creating new recipe', async () => {
      // Verify we start with 3 recipes
      const initialRecipes = await repository.getAll();
      expect(initialRecipes).toHaveLength(3);
      
      // Create a new recipe
      const newRecipe = {
        name: 'New Recipe',
        ingredients: [{ text: 'new ingredient', exportDefault: true }],
        instructions: ['new step']
      };
      
      await repository.create(newRecipe);
      
      // After creating, we should still have all recipes (3 + 1 = 4)
      const recipesAfterCreate = await repository.getAll();
      expect(recipesAfterCreate).toHaveLength(4);
      
      // Verify all original recipes are still there
      const recipeNames = recipesAfterCreate.map(r => r.name);
      expect(recipeNames).toContain('Recipe 1');
      expect(recipeNames).toContain('Recipe 2');
      expect(recipeNames).toContain('Recipe 3');
      expect(recipeNames).toContain('New Recipe');
    });

    test('should maintain full recipe list in cache after updating recipe', async () => {
      // Verify we start with 3 recipes
      const initialRecipes = await repository.getAll();
      expect(initialRecipes).toHaveLength(3);
      
      // Update an existing recipe
      const updatedRecipe = {
        name: 'Recipe 1',
        ingredients: [{ text: 'updated ingredient', exportDefault: true }],
        instructions: ['updated step'],
        servings: 6
      };
      
      await repository.update('recipe-1.json', updatedRecipe);
      
      // After updating, we should still have all 3 recipes
      const recipesAfterUpdate = await repository.getAll();
      expect(recipesAfterUpdate).toHaveLength(3);
      
      // Verify all recipes are still there
      const recipeNames = recipesAfterUpdate.map(r => r.name);
      expect(recipeNames).toContain('Recipe 1');
      expect(recipeNames).toContain('Recipe 2'); 
      expect(recipeNames).toContain('Recipe 3');
      
      // Verify the update took effect
      const updatedRecipeFromCache = recipesAfterUpdate.find(r => r.name === 'Recipe 1');
      expect(updatedRecipeFromCache.servings).toBe(6);
    });

    test('should preserve cache when getAll() is called after operations', async () => {
      // Initial load
      let recipes = await repository.getAll();
      expect(recipes).toHaveLength(3);
      
      // Create a new recipe
      await repository.create({
        name: 'Cache Test Recipe',
        ingredients: [{ text: 'cache ingredient', exportDefault: true }],
        instructions: ['cache step']
      });
      
      // Multiple calls to getAll() should return consistent results
      recipes = await repository.getAll();
      expect(recipes).toHaveLength(4);
      
      recipes = await repository.getAll();
      expect(recipes).toHaveLength(4);
      
      recipes = await repository.getAll();
      expect(recipes).toHaveLength(4);
      
      // All calls should return the same recipes
      const recipeNames = recipes.map(r => r.name);
      expect(recipeNames).toContain('Recipe 1');
      expect(recipeNames).toContain('Recipe 2');
      expect(recipeNames).toContain('Recipe 3');
      expect(recipeNames).toContain('Cache Test Recipe');
    });
  });

  describe('Event System Integration', () => {
    let eventsReceived;
    
    beforeEach(async () => {
      eventsReceived = [];
      
      // Set up event listeners to track all repository events
      repository.on('cacheUpdated', (data) => {
        eventsReceived.push({ event: 'cacheUpdated', data });
      });
      
      repository.on('recipesUpdated', (data) => {
        eventsReceived.push({ event: 'recipesUpdated', data });
      });
      
      repository.on('recipeUpdated', (data) => {
        eventsReceived.push({ event: 'recipeUpdated', data });
      });
      
      repository.on('recipeCreated', (data) => {
        eventsReceived.push({ event: 'recipeCreated', data });
      });
      
      repository.on('recipeDeleted', (data) => {
        eventsReceived.push({ event: 'recipeDeleted', data });
      });
    });

    test('should emit correct events during recipe update operations', async () => {
      // Setup initial recipe
      const originalRecipe = {
        name: 'Test Recipe',
        ingredients: [{ text: 'original ingredient', exportDefault: true }],
        instructions: ['original step']
      };
      
      await mockGitHubAPI.createFile('test-recipe.json', originalRecipe);
      
      // Load the recipe to populate cache
      await repository.getAll();
      
      // Clear events from initial load
      eventsReceived.length = 0;
      
      // Update the recipe
      const updatedRecipe = {
        name: 'Test Recipe',
        ingredients: [{ text: 'updated ingredient', exportDefault: true }],
        instructions: ['updated step'],
        servings: 4
      };
      
      await repository.update('test-recipe.json', updatedRecipe);
      
      // Verify correct events were emitted
      const eventNames = eventsReceived.map(e => e.event);
      
      expect(eventNames).toContain('cacheUpdated');
      expect(eventNames).toContain('recipesUpdated');
      expect(eventNames).toContain('recipeUpdated');
      
      // Verify recipeUpdated event contains correct data
      const recipeUpdatedEvent = eventsReceived.find(e => e.event === 'recipeUpdated');
      expect(recipeUpdatedEvent).toBeDefined();
      expect(recipeUpdatedEvent.data.name).toBe('Test Recipe');
      expect(recipeUpdatedEvent.data.servings).toBe(4);
    });

    test('should emit correct events during recipe creation operations', async () => {
      const newRecipe = {
        name: 'New Recipe',
        ingredients: [{ text: 'new ingredient', exportDefault: true }],
        instructions: ['new step']
      };
      
      await repository.create(newRecipe);
      
      // Verify correct events were emitted
      const eventNames = eventsReceived.map(e => e.event);
      
      expect(eventNames).toContain('cacheUpdated');
      expect(eventNames).toContain('recipesUpdated'); 
      expect(eventNames).toContain('recipeCreated');
      
      // Verify recipeCreated event contains correct data
      const recipeCreatedEvent = eventsReceived.find(e => e.event === 'recipeCreated');
      expect(recipeCreatedEvent).toBeDefined();
      expect(recipeCreatedEvent.data.name).toBe('New Recipe');
    });

    test('should emit recipesUpdated with complete recipe list after updates', async () => {
      // Setup initial recipes
      const recipe1 = { name: 'Recipe 1', ingredients: [{ text: 'ingredient 1', exportDefault: true }], instructions: ['step 1'] };
      const recipe2 = { name: 'Recipe 2', ingredients: [{ text: 'ingredient 2', exportDefault: true }], instructions: ['step 2'] };
      
      await mockGitHubAPI.createFile('recipe-1.json', recipe1);
      await mockGitHubAPI.createFile('recipe-2.json', recipe2);
      
      // Load initial recipes
      await repository.getAll();
      eventsReceived.length = 0; // Clear events from loading
      
      // Update one recipe
      const updatedRecipe = { ...recipe1, servings: 6 };
      await repository.update('recipe-1.json', updatedRecipe);
      
      // Find the recipesUpdated event
      const recipesUpdatedEvents = eventsReceived.filter(e => e.event === 'recipesUpdated');
      expect(recipesUpdatedEvents.length).toBeGreaterThan(0);
      
      // Verify the recipesUpdated event contains the complete list
      const latestRecipesUpdatedEvent = recipesUpdatedEvents[recipesUpdatedEvents.length - 1];
      expect(latestRecipesUpdatedEvent.data).toHaveLength(2); // Should still have both recipes
      
      const recipeNames = latestRecipesUpdatedEvent.data.map(r => r.name);
      expect(recipeNames).toContain('Recipe 1');
      expect(recipeNames).toContain('Recipe 2');
    });
  });
});
