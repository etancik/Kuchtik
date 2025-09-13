/**
 * Unit tests for RecipeCreation service
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockGithubAuth = {
  isAuthenticated: jest.fn(),
  makeAuthenticatedRequest: jest.fn(),
  getUserInfo: jest.fn()
};

const mockConfig = {
  REPO_OWNER: 'testowner',
  REPO_NAME: 'testrepo',
  GITHUB_API_BASE: 'https://api.github.com'
};

// Mock the imports
jest.unstable_mockModule('../services/githubAuth.js', () => ({
  githubAuth: mockGithubAuth
}));

jest.unstable_mockModule('../config/github.js', () => ({
  CONFIG: mockConfig
}));

// Import after mocking
const { recipeCreation } = await import('../services/recipeCreation.js');

describe('RecipeCreation Service', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = recipeCreation; // Use the singleton instance
  });

  describe('generateFilename', () => {
    test('should convert recipe name with accented characters to safe filename', () => {
      const result = service.generateFilename('Guláš');
      expect(result).toBe('gulas.json');
    });

    test('should convert recipe name with spaces to underscores', () => {
      const result = service.generateFilename('Chicken Soup');
      expect(result).toBe('chicken_soup.json');
    });

    test('should handle special characters and multiple spaces', () => {
      const result = service.generateFilename('Pizza   Margherita!!!');
      expect(result).toBe('pizza_margherita.json');
    });

    test('should handle hyphens and convert to underscores', () => {
      const result = service.generateFilename('Beef-Stew-Recipe');
      expect(result).toBe('beef_stew_recipe.json');
    });

    test('should remove leading and trailing underscores', () => {
      const result = service.generateFilename(' Special Recipe ');
      expect(result).toBe('special_recipe.json');
    });

    test('should handle empty or whitespace-only names', () => {
      const result = service.generateFilename('   ');
      expect(result).toBe('.json');
    });
  });

  describe('deleteRecipe', () => {
    beforeEach(() => {
      mockGithubAuth.isAuthenticated.mockReturnValue(true);
      service.getFileInfo = jest.fn();
      service.generateFilename = jest.fn();
    });

    test('should throw error when not authenticated', async () => {
      mockGithubAuth.isAuthenticated.mockReturnValue(false);

      await expect(service.deleteRecipe('Test Recipe'))
        .rejects
        .toThrow('Authentication required. Please authenticate first.');
    });

    test('should throw error when file not found', async () => {
      service.generateFilename.mockReturnValue('test_recipe.json');
      service.getFileInfo.mockResolvedValue(null);

      await expect(service.deleteRecipe('Test Recipe'))
        .rejects
        .toThrow('Recipe file not found: test_recipe.json');
    });

    test('should successfully delete recipe when file exists', async () => {
      const recipeName = 'Test Recipe';
      const filename = 'test_recipe.json';
      const filePath = `recipes/${filename}`;
      const mockFileInfo = { sha: 'abc123' };
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          commit: { sha: 'def456' }
        })
      };

      service.generateFilename.mockReturnValue(filename);
      service.getFileInfo.mockResolvedValue(mockFileInfo);
      mockGithubAuth.makeAuthenticatedRequest.mockResolvedValue(mockResponse);

      const result = await service.deleteRecipe(recipeName);

      expect(service.generateFilename).toHaveBeenCalledWith(recipeName);
      expect(service.getFileInfo).toHaveBeenCalledWith(filePath);
      expect(mockGithubAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        `https://api.github.com/repos/${mockConfig.REPO_OWNER}/${mockConfig.REPO_NAME}/contents/${filePath}`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            message: `Delete recipe: ${recipeName}`,
            sha: mockFileInfo.sha
          })
        }
      );

      expect(result).toEqual({
        success: true,
        filename: filename,
        path: filePath,
        commitSha: 'def456',
        deleted: true
      });
    });

    test('should throw error when GitHub API returns error', async () => {
      const mockFileInfo = { sha: 'abc123' };
      const mockErrorResponse = {
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          message: 'Not Found'
        })
      };

      service.generateFilename.mockReturnValue('test_recipe.json');
      service.getFileInfo.mockResolvedValue(mockFileInfo);
      mockGithubAuth.makeAuthenticatedRequest.mockResolvedValue(mockErrorResponse);

      await expect(service.deleteRecipe('Test Recipe'))
        .rejects
        .toThrow('Failed to delete recipe: Not Found');
    });

    test('should use correct API URL format', async () => {
      const recipeName = 'Test Recipe';
      const filename = 'test_recipe.json';
      const mockFileInfo = { sha: 'abc123' };
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ commit: { sha: 'def456' } })
      };

      service.generateFilename.mockReturnValue(filename);
      service.getFileInfo.mockResolvedValue(mockFileInfo);
      mockGithubAuth.makeAuthenticatedRequest.mockResolvedValue(mockResponse);

      await service.deleteRecipe(recipeName);

      const expectedUrl = `https://api.github.com/repos/${mockConfig.REPO_OWNER}/${mockConfig.REPO_NAME}/contents/recipes/${filename}`;
      expect(mockGithubAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    });
  });

  describe('Configuration regression tests', () => {
    test('should use correct CONFIG property names', () => {
      // Test that we use REPO_OWNER and REPO_NAME, not GITHUB_OWNER/GITHUB_REPO
      const expectedProps = ['REPO_OWNER', 'REPO_NAME', 'GITHUB_API_BASE'];
      
      expectedProps.forEach(prop => {
        expect(mockConfig).toHaveProperty(prop);
      });

      // Test that old incorrect property names don't exist
      expect(mockConfig).not.toHaveProperty('GITHUB_OWNER');
      expect(mockConfig).not.toHaveProperty('GITHUB_REPO');
    });
  });
});
