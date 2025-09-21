/**
 * Public GitHub Adapter - No authentication required
 * Provides read-only access to recipes for public viewing
 */

import { CONFIG } from '../config/github.js';

export class PublicGitHubAdapter {
  constructor() {
    this.baseRawUrl = `https://raw.githubusercontent.com/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/main/recipes`;
    this.baseApiUrl = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}`;
  }

  /**
   * Get list of all recipe files (public API, no auth needed)
   */
  async getFileList() {
    try {
      console.log('🔄 Getting public recipe file list...');
      
      const response = await fetch(`${this.baseApiUrl}/contents/recipes`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file list: ${response.status}`);
      }

      const files = await response.json();
      
      // Filter for JSON files and return just the names
      const jsonFiles = files
        .filter(file => file.type === 'file' && file.name.endsWith('.json'))
        .map(file => file.name);

      console.log(`✅ Found ${jsonFiles.length} public recipe files`);
      return jsonFiles;
      
    } catch (error) {
      console.error('Failed to get public file list:', error);
      throw error;
    }
  }

  /**
   * Get a single recipe file using raw GitHub URL (no auth needed)
   */
  async getFile(filename) {
    try {
      console.log(`🔍 Getting public recipe: ${filename}`);
      
      const response = await fetch(`${this.baseRawUrl}/${filename}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch recipe: ${response.status}`);
      }

      const recipe = await response.json();
      
      // Ensure metadata object exists and has id
      if (!recipe.metadata) {
        recipe.metadata = {};
      }
      if (!recipe.metadata.id) {
        recipe.metadata.id = filename.replace('.json', '');
      }
      if (!recipe.metadata.lastModified) {
        recipe.metadata.lastModified = new Date().toISOString(); // We don't have real modification date
      }
      
      console.log(`✅ Loaded public recipe: ${recipe.name || recipe.metadata.id}`);
      return recipe;
      
    } catch (error) {
      console.error(`Failed to get public recipe ${filename}:`, error);
      return null;
    }
  }

  /**
   * Batch load all recipes using public APIs
   */
  async getAllFiles() {
    try {
      console.log('🚀 Batch loading public recipes...');
      
      const filenames = await this.getFileList();
      const recipes = [];
      
      // Load in batches to be nice to the API
      const batchSize = 10; // Larger batches since no auth limits
      
      for (let i = 0; i < filenames.length; i += batchSize) {
        const batch = filenames.slice(i, i + batchSize);
        console.log(`📦 Loading public batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filenames.length/batchSize)} (${batch.length} files)`);
        
        const batchPromises = batch.map(filename => this.getFile(filename));
        const batchResults = await Promise.all(batchPromises);
        
        recipes.push(...batchResults.filter(recipe => recipe !== null));
        
        // Small delay between batches
        if (i + batchSize < filenames.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`🎉 Successfully loaded ${recipes.length} public recipes`);
      return recipes;
      
    } catch (error) {
      console.error('Failed to batch load public recipes:', error);
      throw error;
    }
  }

  /**
   * Check if this adapter is authenticated (always false for public adapter)
   */
  isAuthenticated() {
    return false;
  }

  /**
   * Get current user info (always null for public adapter)
   */
  getCurrentUser() {
    return null;
  }

  /**
   * List recipe files - alias for getFileList() for compatibility with progressive loading
   */
  async listRecipeFiles() {
    return this.getFileList();
  }

  // These methods are not available for public access
  createFile() { throw new Error('Create operation not available in public mode'); }
  updateFile() { throw new Error('Update operation not available in public mode'); }
  deleteFile() { throw new Error('Delete operation not available in public mode'); }
  checkFileExists() { throw new Error('File existence check not available in public mode'); }
}

export const publicGitHubAdapter = new PublicGitHubAdapter();
export default publicGitHubAdapter;
