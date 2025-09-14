/**
 * Recipe Mode Manager - Switch between authenticated and public access
 */

import { gitHubAPIAdapter } from './GitHubAPIAdapter.js';
import { publicGitHubAdapter } from './PublicGitHubAdapter.js';

export const RecipeMode = {
  AUTHENTICATED: 'authenticated',
  PUBLIC: 'public'
};

export class RecipeModeManager {
  constructor() {
    this.currentMode = RecipeMode.PUBLIC; // Default to public
    this.listeners = new Set();
  }

  /**
   * Set the current mode
   */
  setMode(mode) {
    if (this.currentMode !== mode) {
      const previousMode = this.currentMode;
      this.currentMode = mode;
      
      console.log(`🔄 Recipe mode changed: ${previousMode} → ${mode}`);
      
      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener({ previousMode, currentMode: mode });
        } catch (error) {
          console.error('Error in mode change listener:', error);
        }
      }
    }
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.currentMode;
  }

  /**
   * Get the appropriate adapter for current mode
   */
  getAdapter() {
    switch (this.currentMode) {
      case RecipeMode.AUTHENTICATED:
        return gitHubAPIAdapter;
      case RecipeMode.PUBLIC:
        return publicGitHubAdapter;
      default:
        throw new Error(`Unknown recipe mode: ${this.currentMode}`);
    }
  }

  /**
   * Check if current mode allows editing
   */
  canEdit() {
    return this.currentMode === RecipeMode.AUTHENTICATED;
  }

  /**
   * Switch to authenticated mode (if possible)
   */
  async switchToAuthenticated() {
    // Check if we can authenticate
    if (gitHubAPIAdapter.isAuthenticated()) {
      this.setMode(RecipeMode.AUTHENTICATED);
      return true;
    }
    return false;
  }

  /**
   * Switch to public mode
   */
  switchToPublic() {
    this.setMode(RecipeMode.PUBLIC);
  }

  /**
   * Listen for mode changes
   */
  onModeChange(listener) {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  /**
   * Auto-detect best mode based on authentication status
   */
  async autoDetectMode() {
    if (gitHubAPIAdapter.isAuthenticated()) {
      this.setMode(RecipeMode.AUTHENTICATED);
      console.log('🔑 Auto-detected authenticated mode');
    } else {
      this.setMode(RecipeMode.PUBLIC);
      console.log('🌍 Auto-detected public mode');
    }
  }
}

// Create singleton instance
export const recipeModeManager = new RecipeModeManager();
export default recipeModeManager;
