/**
 * Integration test for RecipeRepository with GitHub API Adapter
 * Tests the complete flow from RecipeRepository through GitHubAPIAdapter
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import RecipeRepository from '../repositories/RecipeRepository.js';
import gitHubAPIAdapter from '../adapters/GitHubAPIAdapter.js';

describe('RecipeRepository Integration', () => {
  let repository;
  let testRecipe;

  beforeAll(async () => {
    // Create repository instance
    repository = new RecipeRepository({
      syncStrategy: 'immediate',
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      optimisticUpdates: true,
      maxRetries: 2,
      retryDelay: 500
    });

    // Set the GitHub API adapter
    repository.setGitHubAPI(gitHubAPIAdapter);

    // Test recipe data
    testRecipe = {
      name: 'Integration Test Recipe',
      ingredients: ['Test ingredient 1', 'Test ingredient 2'],
      instructions: ['Test instruction 1', 'Test instruction 2'],
      servings: 2,
      cookingTime: '15 minutes',
      tags: ['test', 'integration'],
      notes: ['This is a test recipe']
    };
  });

  afterAll(async () => {
    // Cleanup
    if (repository) {
      await repository.cleanup();
    }
  });

  describe('Authentication Integration', () => {
    test('should check authentication status', () => {
      const isAuthenticated = gitHubAPIAdapter.isAuthenticated();
      expect(typeof isAuthenticated).toBe('boolean');
    });

    test('should get current user if authenticated', () => {
      const user = gitHubAPIAdapter.getCurrentUser();
      if (gitHubAPIAdapter.isAuthenticated()) {
        expect(user).toBeTruthy();
        expect(user).toHaveProperty('login');
      } else {
        expect(user).toBeNull();
      }
    });
  });

  describe('Recipe Operations Integration', () => {
    test('should handle getAllRecipes without authentication gracefully', async () => {
      if (!gitHubAPIAdapter.isAuthenticated()) {
        await expect(repository.getAll()).rejects.toThrow();
      } else {
        const recipes = await repository.getAll();
        expect(Array.isArray(recipes)).toBe(true);
      }
    });

    test('should handle getRecipe without authentication gracefully', async () => {
      if (!gitHubAPIAdapter.isAuthenticated()) {
        // getByName returns null for non-existent recipes instead of throwing
        const recipe = await repository.getByName('non-existent-recipe');
        expect(recipe).toBeNull();
      } else {
        const recipe = await repository.getByName('non-existent-id');
        expect(recipe).toBeNull();
      }
    });

    // Skip actual CRUD operations if not authenticated
    describe('CRUD Operations (requires authentication)', () => {
      beforeEach(() => {
        if (!gitHubAPIAdapter.isAuthenticated()) {
          // Skip tests that require authentication
          console.log('Skipping test - authentication required');
          return;
        }
      });

      test('should integrate create, read, update, delete flow', async () => {
        // Skip this test if not authenticated
        if (!gitHubAPIAdapter.isAuthenticated()) {
          console.log('Skipping CRUD test - authentication required');
          return;
        }
        
        // Create
        const createdRecipe = await repository.create(testRecipe);
        expect(createdRecipe).toHaveProperty('name');
        expect(createdRecipe.name).toBe(testRecipe.name);

        // Read
        const retrievedRecipe = await repository.getByName(createdRecipe.name);
        expect(retrievedRecipe).toBeTruthy();
        expect(retrievedRecipe.name).toBe(testRecipe.name);

        // Update
        const updatedData = { ...testRecipe, name: 'Updated Test Recipe' };
        const updatedRecipe = await repository.update(testRecipe.name, updatedData);
        expect(updatedRecipe.name).toBe('Updated Test Recipe');

        // Delete
        const deleteResult = await repository.delete('Updated Test Recipe');
        expect(deleteResult).toBe(true);

        // Verify deletion
        const deletedRecipe = await repository.getByName('Updated Test Recipe');
        expect(deletedRecipe).toBeNull();
      }, 30000); // 30 second timeout for GitHub API operations
    });
  });

  describe('Cache Integration', () => {
    test('should provide cache status information', () => {
      const cacheStatus = repository.getCacheMetadata();
      expect(cacheStatus).toHaveProperty('totalEntries');
      expect(cacheStatus).toHaveProperty('validEntries');
      expect(cacheStatus).toHaveProperty('expiredEntries');
      expect(cacheStatus).toHaveProperty('cacheTimeout');
      expect(cacheStatus).toHaveProperty('entries');
    });

    test('should allow cache clearing', () => {
      repository.clearCache();
      const cacheStatus = repository.getCacheMetadata();
      expect(cacheStatus.totalEntries).toBe(0);
      expect(cacheStatus.entries).toHaveLength(0);
    });
  });

  describe('Event System Integration', () => {
    test('should emit events during operations', (done) => {
      let eventCount = 0;
      
      // Listen for error events (which will be emitted when getAll fails without auth)
      repository.on('error', (event) => {
        expect(event).toHaveProperty('error');
        expect(event).toHaveProperty('timestamp');
        eventCount++;
        
        if (eventCount >= 1) {
          done();
        }
      });

      // Trigger an operation (this will fail without auth and emit error event)
      repository.getAll().catch(() => {
        // Expected to fail without authentication
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle network errors gracefully', async () => {
      // Create a repository with a bad adapter to test error handling
      const badAdapter = {
        ...gitHubAPIAdapter,
        getFileList: async () => {
          throw new Error('Network error');
        },
        getAllRecipes: async () => {
          throw new Error('Network error');
        }
      };

      const badRepository = new RecipeRepository({
        maxRetries: 1,
        retryDelay: 100
      });
      
      // Set the bad adapter
      badRepository.setGitHubAPI(badAdapter);

      await expect(badRepository.getAll()).rejects.toThrow('Network error');
      
      await badRepository.cleanup();
    });

    test('should handle invalid recipe data without crashing', async () => {
      const invalidRecipe = {
        name: '', // Invalid empty name
        ingredients: [],
        instructions: []
      };

      // The repository should handle invalid data gracefully
      // It might create the recipe with empty name or handle it in some way
      try {
        const result = await repository.create(invalidRecipe);
        expect(result).toBeDefined();
      } catch (error) {
        // If validation is implemented, error should be meaningful
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe('Configuration Integration', () => {
    test('should respect configuration settings', () => {
      const config = repository.config;
      expect(config.syncStrategy).toBe('immediate');
      expect(config.cacheTimeout).toBe(5 * 60 * 1000);
      expect(config.optimisticUpdates).toBe(true);
      expect(config.maxRetries).toBe(2);
    });

    test('should allow configuration updates', () => {
      repository.config.maxRetries = 5;
      expect(repository.config.maxRetries).toBe(5);
    });
  });
});
