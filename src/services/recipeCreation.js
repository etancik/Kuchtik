/**
 * Recipe Creation Service
 * Handles creating new recipes and committing them to GitHub
 */

import { githubAuth } from './githubAuth.js';
import { CONFIG } from '../config/github.js';
import { t } from '../i18n/i18n.js';

class RecipeCreationService {
  /**
   * Create a new recipe file in the GitHub repository
   * @param {Object} recipeData - Recipe data object
   * @returns {Promise<Object>} Creation result
   */
  async createRecipe(recipeData) {
    console.log('🔄 Starting recipe creation process');
    console.log('📝 Recipe data received:', recipeData);

    // Validate recipe data
    console.log('✅ Validating recipe data...');
    const validation = this.validateRecipeData(recipeData);
    console.log('🔍 Validation result:', validation);
    
    if (!validation || typeof validation !== 'object') {
      console.error('❌ Validation function returned invalid result:', validation);
      throw new Error('Recipe validation failed - invalid validation response');
    }
    
    if (!validation.isValid) {
      console.error('❌ Recipe validation failed:', validation.errors);
      const errorMessage = Array.isArray(validation.errors) 
        ? validation.errors.join(', ') 
        : 'Unknown validation errors';
      throw new Error(`Invalid recipe data: ${errorMessage}`);
    }
    console.log('✅ Recipe data validation passed');

    // Ensure user is authenticated
    console.log('🔐 Checking authentication...');
    if (!githubAuth.isAuthenticated()) {
      console.error('❌ User not authenticated');
      throw new Error('User must be authenticated to create recipes');
    }
    
    const userInfo = githubAuth.getUserInfo();
    console.log('✅ User authenticated:', userInfo?.login || 'Unknown');

    try {
      // Generate filename from recipe name
      console.log('📁 Generating filename...');
      const filename = this.generateFilename(recipeData.name);
      const filePath = `recipes/${filename}`;
      console.log('✅ Generated filename:', filename);
      console.log('✅ Full file path:', filePath);

      // Format recipe data as JSON
      console.log('📄 Formatting recipe content...');
      const content = JSON.stringify(recipeData, null, 2);
      console.log('✅ JSON content length:', content.length, 'characters');
      console.log('📄 Recipe content preview:', content.substring(0, 200) + '...');
      
      const encodedContent = btoa(unescape(encodeURIComponent(content)));
      console.log('✅ Base64 encoded content length:', encodedContent.length, 'characters');

      // Check if file already exists
      console.log('🔍 Checking if file already exists...');
      const existingFile = await this.checkFileExists(filePath);
      if (existingFile) {
        console.error('❌ File already exists:', filePath);
        throw new Error(`Recipe "${recipeData.name}" already exists`);
      }
      console.log('✅ File does not exist, proceeding with creation');

      // Create commit message
      const commitMessage = `Add recipe: ${recipeData.name}`;
      console.log('💬 Commit message:', commitMessage);
      
      const author = {
        name: userInfo?.name || userInfo?.login || 'Recipe Contributor',
        email: userInfo?.email || `${userInfo?.login}@users.noreply.github.com`,
      };
      console.log('👤 Author info:', author);

      // Prepare API request
      const apiUrl = `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`;
      console.log('🔗 GitHub API URL:', `${CONFIG.GITHUB_API_BASE}/${apiUrl}`);
      
      const requestBody = {
        message: commitMessage,
        content: encodedContent,
        author: author,
        committer: author,
      };
      console.log('📦 Request body prepared (content truncated for logging)');

      // Create the file via GitHub API
      console.log('🚀 Sending request to GitHub API...');
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });

      console.log('📡 GitHub API response status:', response.status);
      console.log('📡 GitHub API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ GitHub API Error Response:', errorText);
        
        let errorMessage;
        try {
          const error = JSON.parse(errorText);
          console.error('❌ Parsed error:', error);
          errorMessage = error.message || error.error || 'Unknown API error';
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        
        throw new Error(`Failed to create recipe: ${errorMessage}`);
      }

      console.log('✅ GitHub API request successful');
      const result = await response.json();
      console.log('📋 GitHub API response data:', {
        commit: result.commit?.sha,
        content: {
          name: result.content?.name,
          path: result.content?.path,
          downloadUrl: result.content?.download_url
        }
      });

      const successResult = {
        success: true,
        filename: filename,
        path: filePath,
        commitSha: result.commit.sha,
        downloadUrl: result.content.download_url,
      };
      
      console.log('🎉 Recipe creation completed successfully:', successResult);
      return successResult;
      
    } catch (error) {
      console.error('💥 Recipe creation failed with error:', error);
      console.error('💥 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Update an existing recipe file in the GitHub repository
   * @param {Object} recipeData - Recipe data object
   * @param {string} originalName - Original recipe name (for filename)
   * @returns {Promise<Object>} Update result
   */
  async updateRecipe(recipeData, originalName) {
    console.log('🔄 Starting recipe update process');
    console.log('📝 Recipe data received:', recipeData);
    console.log('📝 Original recipe name:', originalName);

    // Validate recipe data
    console.log('✅ Validating recipe data...');
    const validation = this.validateRecipeData(recipeData);
    console.log('🔍 Validation result:', validation);
    
    if (!validation || typeof validation !== 'object') {
      console.error('❌ Validation function returned invalid result:', validation);
      throw new Error('Recipe validation failed - invalid validation response');
    }
    
    if (!validation.isValid) {
      console.error('❌ Recipe validation failed:', validation.errors);
      const errorMessage = Array.isArray(validation.errors) 
        ? validation.errors.join(', ') 
        : 'Unknown validation errors';
      throw new Error(`Invalid recipe data: ${errorMessage}`);
    }
    console.log('✅ Recipe data validation passed');

    // Ensure user is authenticated
    console.log('🔐 Checking authentication...');
    if (!githubAuth.isAuthenticated()) {
      console.error('❌ User not authenticated');
      throw new Error('User must be authenticated to update recipes');
    }
    
    const userInfo = githubAuth.getUserInfo();
    console.log('✅ User authenticated:', userInfo?.login || 'Unknown');

    try {
      // Generate filename from original name (recipes shouldn't change filenames)
      console.log('📁 Generating filename from original name...');
      const filename = this.generateFilename(originalName);
      const filePath = `recipes/${filename}`;
      console.log('✅ Generated filename:', filename);
      console.log('✅ Full file path:', filePath);

      // Get current file info to get SHA (required for updates)
      console.log('🔍 Getting current file info...');
      const currentFile = await this.getFileInfo(filePath);
      if (!currentFile) {
        throw new Error(`Recipe file not found: ${filename}`);
      }
      console.log('✅ Current file SHA:', currentFile.sha);

      // Format recipe data as JSON
      console.log('📄 Formatting recipe content...');
      const content = JSON.stringify(recipeData, null, 2);
      console.log('✅ JSON content length:', content.length, 'characters');
      
      const encodedContent = btoa(unescape(encodeURIComponent(content)));
      console.log('✅ Base64 encoded content length:', encodedContent.length, 'characters');

      // Create commit message
      const commitMessage = `Update recipe: ${recipeData.name}`;
      console.log('💬 Commit message:', commitMessage);
      
      const author = {
        name: userInfo?.name || userInfo?.login || 'Recipe Contributor',
        email: userInfo?.email || `${userInfo?.login}@users.noreply.github.com`,
      };
      console.log('👤 Commit author:', author);

      const apiUrl = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`;
      console.log('🌐 GitHub API URL:', apiUrl);

      const requestBody = {
        message: commitMessage,
        content: encodedContent,
        sha: currentFile.sha, // Required for updates
        author: author,
        committer: author,
      };
      console.log('📦 Request body prepared (content truncated for logging)');

      // Update the file via GitHub API
      console.log('🚀 Sending update request to GitHub API...');
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });

      console.log('📡 GitHub API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ GitHub API Error Response:', errorText);
        
        let errorMessage;
        try {
          const error = JSON.parse(errorText);
          console.error('❌ Parsed error:', error);
          errorMessage = error.message || error.error || 'Unknown API error';
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        
        throw new Error(`Failed to update recipe: ${errorMessage}`);
      }

      console.log('✅ GitHub API request successful');
      const result = await response.json();
      console.log('📋 GitHub API response data:', {
        commit: result.commit?.sha,
        content: {
          name: result.content?.name,
          path: result.content?.path,
          downloadUrl: result.content?.download_url
        }
      });

      const successResult = {
        success: true,
        filename: filename,
        path: filePath,
        commitSha: result.commit.sha,
        downloadUrl: result.content.download_url,
        updated: true
      };
      
      console.log('🎉 Recipe update completed successfully:', successResult);
      return successResult;
      
    } catch (error) {
      console.error('💥 Recipe update failed with error:', error);
      console.error('💥 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Delete a recipe file from the GitHub repository
   * @param {string} recipeName - Name of the recipe to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRecipe(recipeName) {
    console.log('🗑️ Starting recipe deletion process');
    console.log('📝 Recipe name:', recipeName);

    try {
      // Validate authentication
      if (!githubAuth.isAuthenticated()) {
        throw new Error('Authentication required. Please authenticate first.');
      }
      console.log('✅ User authenticated');

      // Generate filename
      const filename = this.generateFilename(recipeName);
      const filePath = `recipes/${filename}`;
      console.log('✅ Generated filename:', filename);
      console.log('✅ Full file path:', filePath);

      // Get current file info to get SHA (required for deletion)
      console.log('🔍 Getting current file info...');
      const currentFile = await this.getFileInfo(filePath);
      if (!currentFile) {
        throw new Error(`Recipe file not found: ${filename}`);
      }
      console.log('✅ Current file SHA:', currentFile.sha);

      // Create commit message
      const commitMessage = `Delete recipe: ${recipeName}`;
      console.log('✅ Commit message:', commitMessage);

      // Prepare API request
      const apiUrl = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`;
      console.log('✅ GitHub API URL:', apiUrl);

      const requestBody = {
        message: commitMessage,
        sha: currentFile.sha
      };

      console.log('🔄 Making GitHub API request to delete file...');
      const response = await githubAuth.makeAuthenticatedRequest(apiUrl, {
        method: 'DELETE',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error('💥 GitHub API request failed');
        console.error('💥 Response status:', response.status, response.statusText);
        
        let errorMessage;
        try {
          const errorData = await response.json();
          console.error('💥 API error response:', errorData);
          errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          const errorText = await response.text();
          console.error('💥 Raw error response:', errorText);
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        
        throw new Error(`Failed to delete recipe: ${errorMessage}`);
      }

      console.log('✅ GitHub API request successful');
      const result = await response.json();
      console.log('📋 GitHub API response data:', {
        commit: result.commit?.sha
      });

      const successResult = {
        success: true,
        filename: filename,
        path: filePath,
        commitSha: result.commit.sha,
        deleted: true
      };
      
      console.log('🎉 Recipe deletion completed successfully:', successResult);
      return successResult;
      
    } catch (error) {
      console.error('💥 Recipe deletion failed with error:', error);
      console.error('💥 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
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
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
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
   * Get file information including SHA (needed for updates)
   * @private
   * @param {string} filePath - File path to get info for
   * @returns {Promise<Object|null>} File info object or null if not found
   */
  async getFileInfo(filePath) {
    try {
      console.log('🔍 Getting file info for:', filePath);
      const response = await githubAuth.makeAuthenticatedRequest(
        `repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${filePath}`
      );
      
      if (response.ok) {
        const fileInfo = await response.json();
        console.log('✅ File info retrieved:', {
          name: fileInfo.name,
          path: fileInfo.path,
          sha: fileInfo.sha,
          size: fileInfo.size
        });
        return fileInfo;
      } else {
        console.log('❌ File not found:', filePath);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      return null;
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
      errors.push(t('validation.servingsPositiveNumber'));
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
