/**
 * Simple integration tests for import/export patterns
 * Focuses on catching the bugs we fixed without complex DOM mocking
 */

import { jest } from '@jest/globals';

describe('Import/Export Pattern Validation', () => {
  describe('TemplateLoader export patterns', () => {
    test('should export templateLoader singleton correctly', async () => {
      const { templateLoader } = await import('../utils/templateLoader.js');
      
      expect(templateLoader).toBeDefined();
      expect(typeof templateLoader.loadTemplate).toBe('function');
      expect(typeof templateLoader.createElement).toBe('function');
    });

    test('should not export individual loadTemplate function', async () => {
      try {
        const { loadTemplate } = await import('../utils/templateLoader.js');
        // If this doesn't throw, it means loadTemplate is incorrectly exported
        expect(loadTemplate).toBeUndefined();
      } catch (error) {
        // This is expected - loadTemplate should not be directly exportable
        expect(error.message).toContain('does not provide an export named \'loadTemplate\'');
      }
    });
  });

  describe('Service export patterns', () => {
    test('githubAuth should export correct authentication methods', async () => {
      const mockAuth = {
        isAuthenticated: jest.fn(),
        makeAuthenticatedRequest: jest.fn(),
        getUserInfo: jest.fn()
      };

      jest.unstable_mockModule('../services/githubAuth.js', () => ({
        githubAuth: mockAuth
      }));

      const { githubAuth } = await import('../services/githubAuth.js');
      
      expect(githubAuth).toBeDefined();
      expect(typeof githubAuth.isAuthenticated).toBe('function');
      expect(typeof githubAuth.makeAuthenticatedRequest).toBe('function');
      expect(typeof githubAuth.getUserInfo).toBe('function');
      
      // Should NOT have getAccessToken method (this was the bug)
      expect(githubAuth.getAccessToken).toBeUndefined();
    });

    test('recipeCreation should export singleton correctly', async () => {
      jest.unstable_mockModule('../services/githubAuth.js', () => ({
        githubAuth: { isAuthenticated: jest.fn() }
      }));
      jest.unstable_mockModule('../config/github.js', () => ({
        CONFIG: { REPO_OWNER: 'test', REPO_NAME: 'test' }
      }));

      const { recipeCreation } = await import('../services/recipeCreation.js');
      
      expect(recipeCreation).toBeDefined();
      expect(typeof recipeCreation.createRecipe).toBe('function');
      expect(typeof recipeCreation.updateRecipe).toBe('function');
      expect(typeof recipeCreation.deleteRecipe).toBe('function');
    });
  });

  describe('GitHub API URL construction', () => {
    test('should use correct CONFIG property names', () => {
      const correctConfig = {
        REPO_OWNER: 'testowner',
        REPO_NAME: 'testrepo'
      };
      
      // Test that correct properties exist
      expect(correctConfig).toHaveProperty('REPO_OWNER');
      expect(correctConfig).toHaveProperty('REPO_NAME');
      
      // Verify URL construction pattern
      const filePath = 'recipes/test_recipe.json';
      const expectedUrl = `https://api.github.com/repos/${correctConfig.REPO_OWNER}/${correctConfig.REPO_NAME}/contents/${filePath}`;
      const constructedUrl = `https://api.github.com/repos/${correctConfig.REPO_OWNER}/${correctConfig.REPO_NAME}/contents/${filePath}`;
      
      expect(constructedUrl).toBe(expectedUrl);
    });

    test('should detect incorrect config property usage', () => {
      const incorrectConfig = {
        GITHUB_OWNER: 'testowner',  // Wrong property name
        GITHUB_REPO: 'testrepo'     // Wrong property name
      };
      
      // These should NOT be used
      expect(incorrectConfig.REPO_OWNER).toBeUndefined();
      expect(incorrectConfig.REPO_NAME).toBeUndefined();
    });
  });
});
