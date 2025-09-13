/**
 * Recipe Creation Service
 * Handles creating new recipes and committing them to GitHub
 */

import { githubAuth } from './githubAuth.js';
import { CONFIG } from '../config/github.js';
import { validateRecipe } from '../utils/recipeUtils.js';

class RecipeCreationService {
  /**
   * Create a new recipe file in the GitHub repository
   * @param {Object} recipeData - Recipe data object
   * @returns {Promise<Object>} Creation result
   */
  async createRecipe(recipeData) {
    // Validate recipe data
    const validation = validateRecipe(recipeData);
    if (!validation.isValid) {
      throw new Error(`Invalid recipe data: ${validation.errors.join(', ')}`);
    }

    // Ensure user is authenticated
    if (!githubAuth.isAuthenticated()) {
      throw new Error('User must be authenticated to create recipes');
    }

    try {
      // Generate filename from recipe name
      const filename = this.generateFilename(recipeData.name);
      const filePath = `recipes/${filename}`;

      // Format recipe data as JSON
      const content = JSON.stringify(recipeData, null, 2);
      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      // Check if file already exists
      const existingFile = await this.checkFileExists(filePath);
      if (existingFile) {
        throw new Error(`Recipe "${recipeData.name}" already exists`);
      }

      // Create commit message
      const commitMessage = `Add recipe: ${recipeData.name}`;
      const userInfo = githubAuth.getUserInfo();
      const author = {
        name: userInfo?.name || userInfo?.login || 'Recipe Contributor',
        email: userInfo?.email || `${userInfo?.login}@users.noreply.github.com`,
      };

      // Create the file via GitHub API
      const response = await githubAuth.makeAuthenticatedRequest(
        `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: commitMessage,
            content: encodedContent,
            author: author,
            committer: author,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create recipe: ${error.message}`);
      }

      const result = await response.json();
      return {
        success: true,
        filename: filename,
        path: filePath,
        commitSha: result.commit.sha,
        downloadUrl: result.content.download_url,
      };
    } catch (error) {
      console.error('Recipe creation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a safe filename from recipe name
   * @private
   * @param {string} recipeName - Recipe name
   * @returns {string} Safe filename
   */
  generateFilename(recipeName) {
    return recipeName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-+/g, '_') // Replace hyphens with underscores
      .replace(/_+/g, '_') // Remove duplicate underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      + '.json';
  }

  /**
   * Check if a file already exists in the repository
   * @private
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async checkFileExists(filePath) {
    try {
      const response = await githubAuth.makeAuthenticatedRequest(
        `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`
      );
      return response.ok;
    } catch {
      // File doesn't exist or other error
      return false;
    }
  }

  /**
   * Validate recipe data structure
   * @param {Object} recipeData - Recipe data to validate
   * @returns {Object} Validation result
   */
  validateRecipeData(recipeData) {
    const errors = [];

    // Required fields
    if (!recipeData.name || typeof recipeData.name !== 'string') {
      errors.push('Recipe name is required and must be a string');
    }

    if (!recipeData.ingredients || !Array.isArray(recipeData.ingredients) || recipeData.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    }

    if (!recipeData.instructions || !Array.isArray(recipeData.instructions) || recipeData.instructions.length === 0) {
      errors.push('At least one instruction is required');
    }

    // Validate ingredients structure
    if (recipeData.ingredients) {
      recipeData.ingredients.forEach((ingredient, index) => {
        if (typeof ingredient !== 'string' || ingredient.trim() === '') {
          errors.push(`Ingredient ${index + 1} must be a non-empty string`);
        }
      });
    }

    // Validate instructions structure
    if (recipeData.instructions) {
      recipeData.instructions.forEach((instruction, index) => {
        if (typeof instruction !== 'string' || instruction.trim() === '') {
          errors.push(`Instruction ${index + 1} must be a non-empty string`);
        }
      });
    }

    // Optional fields validation
    if (recipeData.cookingTime && typeof recipeData.cookingTime !== 'string') {
      errors.push('Cooking time must be a string');
    }

    if (recipeData.servings && (typeof recipeData.servings !== 'number' || recipeData.servings <= 0)) {
      errors.push('Servings must be a positive number');
    }

    if (recipeData.difficulty && !['easy', 'medium', 'hard'].includes(recipeData.difficulty.toLowerCase())) {
      errors.push('Difficulty must be "easy", "medium", or "hard"');
    }

    if (recipeData.tags && (!Array.isArray(recipeData.tags) || !recipeData.tags.every(tag => typeof tag === 'string'))) {
      errors.push('Tags must be an array of strings');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Create recipe template with default values
   * @param {string} name - Recipe name
   * @returns {Object} Recipe template
   */
  createRecipeTemplate(name = '') {
    return {
      name: name,
      ingredients: [''],
      instructions: [''],
      cookingTime: '',
      servings: 1,
      difficulty: 'medium',
      tags: [],
      description: '',
      author: githubAuth.getUserInfo()?.login || 'Anonymous',
      created: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const recipeCreation = new RecipeCreationService();
export default recipeCreation;
