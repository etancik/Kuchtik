/**
 * GitHub API Adapter
 * Bridges the existing GitHub services with the RecipeRepository interface
 * Implements the GitHubAPIIntegration interface expected by RecipeRepository
 */

import { githubAuth } from '../services/githubAuth.js';
import { CONFIG } from '../config/github.js';

// Helper functions for base64 encoding/decoding (browser environment)
function decodeBase64(content) {
  try {
    // Properly decode UTF-8 content from base64
    return decodeURIComponent(escape(window.atob(content)));
  } catch (error) {
    throw new Error(`Failed to decode base64 content: ${error.message}`);
  }
}

function encodeBase64(content) {
  try {
    return window.btoa(unescape(encodeURIComponent(content)));
  } catch (error) {
    throw new Error(`Failed to encode base64 content: ${error.message}`);
  }
}

/**
 * GitHub API Adapter implementing GitHubAPIIntegration interface
 */
export class GitHubAPIAdapter {
  constructor() {
    // We'll implement create/update operations directly here
    // instead of importing the complex RecipeCreationService
  }

  /**
   * Generate a filename from recipe name
   * @private
   * @param {string} name - Recipe name
   * @returns {string} Filename
   */
  generateFilename(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      + '.json';
  }

  /**
   * Validate recipe data
   * @private
   * @param {Object} recipe - Recipe to validate
   * @returns {Object} Validation result
   */
  validateRecipe(recipe) {
    const errors = [];

    if (!recipe.name || typeof recipe.name !== 'string' || recipe.name.trim() === '') {
      errors.push('Recipe name is required');
    }

    if (!recipe.ingredients || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    }

    if (!recipe.instructions || !Array.isArray(recipe.instructions) || recipe.instructions.length === 0) {
      errors.push('Instructions are required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get all recipes from the GitHub repository
   * @returns {Promise<Recipe[]>} Array of recipe objects
   */
  async getAllRecipes() {
    if (!githubAuth.isAuthenticated()) {
      throw new Error('Authentication required to access recipes');
    }

    try {
      console.log('🔄 Fetching all recipes from GitHub...');
      
      // Get the list of recipe files
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/recipes`;
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch recipe list: ${response.status} ${errorText}`);
      }

      const files = await response.json();
      console.log(`📋 Found ${files.length} recipe files`);

      // Filter for JSON files only
      const jsonFiles = files.filter(file => 
        file.type === 'file' && 
        file.name.endsWith('.json')
      );

      console.log(`📄 Processing ${jsonFiles.length} JSON recipe files`);

      // Fetch content for each recipe file
      const recipes = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            console.log(`📖 Fetching recipe: ${file.name}`);
            
            // Get the file content
            const contentResponse = await githubAuth.makeAuthenticatedRequest(file.url);
            
            if (!contentResponse.ok) {
              console.warn(`⚠️ Failed to fetch ${file.name}: ${contentResponse.status}`);
              return null;
            }

            const contentData = await contentResponse.json();
            
            // Decode base64 content
            const content = decodeBase64(contentData.content);
            const recipe = JSON.parse(content);
            
            // Add metadata
            recipe.id = file.name.replace('.json', '');
            recipe.sha = contentData.sha;
            recipe.lastModified = new Date().toISOString(); // GitHub doesn't provide this easily
            
            console.log(`✅ Successfully loaded recipe: ${recipe.name || recipe.id}`);
            return recipe;
            
          } catch (error) {
            console.error(`❌ Error processing recipe ${file.name}:`, error);
            return null;
          }
        })
      );

      // Filter out failed recipes
      const validRecipes = recipes.filter(recipe => recipe !== null);
      console.log(`✅ Successfully loaded ${validRecipes.length} recipes`);
      
      return validRecipes;
      
    } catch (error) {
      console.error('💥 Failed to get all recipes:', error);
      throw error;
    }
  }

  /**
   * Get a specific recipe by ID
   * @param {string} id - Recipe ID (filename without extension)
   * @returns {Promise<Recipe|null>} Recipe object or null if not found
   */
  async getRecipe(id) {
    if (!githubAuth.isAuthenticated()) {
      throw new Error('Authentication required to access recipes');
    }

    try {
      console.log(`🔍 Fetching recipe: ${id}`);
      
      const filename = `${id}.json`;
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/recipes/${filename}`;
      
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl);

      if (response.status === 404) {
        console.log(`❌ Recipe not found: ${id}`);
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch recipe: ${response.status} ${errorText}`);
      }

      const contentData = await response.json();
      
      // Decode base64 content
      const content = decodeBase64(contentData.content);
      const recipe = JSON.parse(content);
      
      // Add metadata
      recipe.id = id;
      recipe.sha = contentData.sha;
      recipe.lastModified = new Date().toISOString();
      
      console.log(`✅ Successfully loaded recipe: ${recipe.name || id}`);
      return recipe;
      
    } catch (error) {
      console.error(`💥 Failed to get recipe ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new recipe
   * @param {Recipe} recipe - Recipe object to create
   * @returns {Promise<Recipe>} Created recipe with metadata
   */
  async createRecipe(recipe) {
    if (!githubAuth.isAuthenticated()) {
      throw new Error('Authentication required to create recipes');
    }

    try {
      console.log(`🔄 Creating recipe: ${recipe.name}`);
      
      // Validate recipe data
      const validation = this.validateRecipe(recipe);
      if (!validation.isValid) {
        throw new Error(`Invalid recipe data: ${validation.errors.join(', ')}`);
      }
      
      // Generate filename
      const filename = this.generateFilename(recipe.name);
      const filePath = `recipes/${filename}`;
      
      // Check if file already exists
      const exists = await this.exists(filename.replace('.json', ''));
      if (exists) {
        throw new Error(`Recipe "${recipe.name}" already exists`);
      }
      
      // Format recipe content
      const content = JSON.stringify(recipe, null, 2);
      const encodedContent = encodeBase64(content);
      
      // Get user info for commit
      const userInfo = githubAuth.getUserInfo();
      const author = {
        name: userInfo?.name || userInfo?.login || 'Recipe Contributor',
        email: userInfo?.email || `${userInfo?.login}@users.noreply.github.com`,
      };
      
      // Create the file
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`;
      const requestBody = {
        message: `Add recipe: ${recipe.name}`,
        content: encodedContent,
        author: author,
        committer: author,
      };
      
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create recipe: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      // Return the recipe with metadata
      const createdRecipe = {
        ...recipe,
        id: filename.replace('.json', ''),
        sha: result.commit.sha,
        lastModified: new Date().toISOString()
      };
      
      console.log(`✅ Successfully created recipe: ${recipe.name}`);
      return createdRecipe;
      
    } catch (error) {
      console.error(`💥 Failed to create recipe ${recipe.name}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing recipe
   * @param {string} id - Recipe ID to update
   * @param {Recipe} recipe - Updated recipe data
   * @returns {Promise<Recipe>} Updated recipe with metadata
   */
  async updateRecipe(id, recipe) {
    if (!githubAuth.isAuthenticated()) {
      throw new Error('Authentication required to update recipes');
    }

    try {
      console.log(`🔄 Updating recipe: ${id}`);
      
      // Validate recipe data
      const validation = this.validateRecipe(recipe);
      if (!validation.isValid) {
        throw new Error(`Invalid recipe data: ${validation.errors.join(', ')}`);
      }
      
      // Get the current recipe to find the SHA
      const currentRecipe = await this.getRecipe(id);
      if (!currentRecipe) {
        throw new Error(`Recipe not found: ${id}`);
      }
      
      // Use the existing filename (don't change it during updates)
      const filename = `${id}.json`;
      const filePath = `recipes/${filename}`;
      
      // Format recipe content
      const content = JSON.stringify(recipe, null, 2);
      const encodedContent = encodeBase64(content);
      
      // Get user info for commit
      const userInfo = githubAuth.getUserInfo();
      const author = {
        name: userInfo?.name || userInfo?.login || 'Recipe Contributor',
        email: userInfo?.email || `${userInfo?.login}@users.noreply.github.com`,
      };
      
      // Update the file
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`;
      const requestBody = {
        message: `Update recipe: ${recipe.name}`,
        content: encodedContent,
        sha: currentRecipe.sha,
        author: author,
        committer: author,
      };
      
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update recipe: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      // Return the updated recipe with metadata
      const updatedRecipe = {
        ...recipe,
        id: id,
        sha: result.commit.sha,
        lastModified: new Date().toISOString()
      };
      
      console.log(`✅ Successfully updated recipe: ${id}`);
      return updatedRecipe;
      
    } catch (error) {
      console.error(`💥 Failed to update recipe ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a recipe
   * @param {string} id - Recipe ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteRecipe(id) {
    if (!githubAuth.isAuthenticated()) {
      throw new Error('Authentication required to delete recipes');
    }

    try {
      console.log(`🗑️ Deleting recipe: ${id}`);
      
      // First get the current file to get its SHA (required for deletion)
      const currentRecipe = await this.getRecipe(id);
      if (!currentRecipe) {
        console.log(`❌ Recipe not found for deletion: ${id}`);
        return false;
      }
      
      const filename = `${id}.json`;
      const filePath = `recipes/${filename}`;
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`;
      
      const userInfo = githubAuth.getUserInfo();
      const author = {
        name: userInfo?.name || userInfo?.login || 'Recipe Contributor',
        email: userInfo?.email || `${userInfo?.login}@users.noreply.github.com`,
      };
      
      const requestBody = {
        message: `Delete recipe: ${currentRecipe.name || id}`,
        sha: currentRecipe.sha,
        author: author,
        committer: author,
      };
      
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl, {
        method: 'DELETE',
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete recipe: ${response.status} ${errorText}`);
      }
      
      console.log(`✅ Successfully deleted recipe: ${id}`);
      return true;
      
    } catch (error) {
      console.error(`💥 Failed to delete recipe ${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a recipe exists
   * @param {string} id - Recipe ID to check
   * @returns {Promise<boolean>} True if recipe exists
   */
  async exists(id) {
    try {
      const recipe = await this.getRecipe(id);
      return recipe !== null;
    } catch (error) {
      console.error(`💥 Failed to check if recipe exists ${id}:`, error);
      return false;
    }
  }

  /**
   * Get repository metadata
   * @returns {Promise<Object>} Repository information
   */
  async getRepoInfo() {
    if (!githubAuth.isAuthenticated()) {
      throw new Error('Authentication required to access repository information');
    }

    try {
      console.log('📊 Fetching repository information...');
      
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}`;
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch repository info: ${response.status} ${errorText}`);
      }
      
      const repoData = await response.json();
      
      const info = {
        owner: repoData.owner.login,
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        lastUpdated: repoData.updated_at,
        isPrivate: repoData.private
      };
      
      console.log('✅ Repository information fetched:', info);
      return info;
      
    } catch (error) {
      console.error('💥 Failed to get repository info:', error);
      throw error;
    }
  }

  /**
   * Check authentication status
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return githubAuth.isAuthenticated();
  }

  /**
   * Get current user information
   * @returns {Object|null} User information or null
   */
  getCurrentUser() {
    return githubAuth.getUserInfo();
  }

  // ============================================================================
  // RecipeRepository Interface Compatibility Methods
  // ============================================================================

  /**
   * Get list of recipe filenames (RecipeRepository interface)
   * @returns {Promise<string[]>} Array of recipe filenames
   */
  async getFileList() {
    try {
      console.log('🔄 Getting file list...');
      
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/recipes`;
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch file list: ${response.status} ${errorText}`);
      }

      const files = await response.json();
      
      // Filter for JSON files and return just the names
      const jsonFiles = files
        .filter(file => file.type === 'file' && file.name.endsWith('.json'))
        .map(file => file.name);

      console.log(`✅ Found ${jsonFiles.length} recipe files`);
      return jsonFiles;
      
    } catch (error) {
      console.error('💥 Failed to get file list:', error);
      throw error;
    }
  }

  /**
   * Get file contents by filename (RecipeRepository interface)
   * @param {string} filename - Recipe filename (e.g., "recipe-name.json")
   * @returns {Promise<Object|null>} Recipe object or null if not found
   */
  async getFile(filename) {
    try {
      // Extract recipe ID from filename
      const recipeId = filename.replace('.json', '');
      console.log(`🔍 Getting file: ${filename} (ID: ${recipeId})`);
      
      const recipe = await this.getRecipe(recipeId);
      return recipe;
      
    } catch (error) {
      console.error(`💥 Failed to get file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists (RecipeRepository interface)
   * @param {string} recipeName - Recipe name to check
   * @returns {Promise<boolean>} True if file exists
   */
  async checkFileExists(recipeName) {
    try {
      // Generate filename from recipe name
      const filename = this.generateFilename(recipeName);
      const recipeId = filename.replace('.json', '');
      
      console.log(`🔍 Checking if file exists: ${recipeName} -> ${filename}`);
      return await this.exists(recipeId);
      
    } catch (error) {
      console.error(`💥 Failed to check if file exists ${recipeName}:`, error);
      return false;
    }
  }

  /**
   * Create file (RecipeRepository interface)
   * @param {string} filename - Recipe filename 
   * @param {Object} data - Recipe data
   * @returns {Promise<Object>} Created recipe
   */
  async createFile(filename, data) {
    try {
      console.log(`🔄 Creating file: ${filename}`);
      
      const recipe = await this.createRecipe(data);
      console.log(`✅ Created file: ${filename}`);
      return recipe;
      
    } catch (error) {
      console.error(`💥 Failed to create file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Update file (RecipeRepository interface)
   * @param {string} filename - Recipe filename
   * @param {Object} data - Updated recipe data
   * @returns {Promise<Object>} Updated recipe
   */
  async updateFile(filename, data) {
    try {
      // Extract recipe ID from filename
      const recipeId = filename.replace('.json', '');
      console.log(`🔄 Updating file: ${filename} (ID: ${recipeId})`);
      
      const recipe = await this.updateRecipe(recipeId, data);
      console.log(`✅ Updated file: ${filename}`);
      return recipe;
      
    } catch (error) {
      console.error(`💥 Failed to update file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Delete file (RecipeRepository interface)
   * @param {string} filename - Recipe filename
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteFile(filename) {
    try {
      // Extract recipe ID from filename
      const recipeId = filename.replace('.json', '');
      console.log(`🗑️ Deleting file: ${filename} (ID: ${recipeId})`);
      
      const result = await this.deleteRecipe(recipeId);
      console.log(`✅ Deleted file: ${filename}`);
      return result;
      
    } catch (error) {
      console.error(`💥 Failed to delete file ${filename}:`, error);
      throw error;
    }
  }
}

// Create and export singleton instance
export const gitHubAPIAdapter = new GitHubAPIAdapter();
export default gitHubAPIAdapter;
