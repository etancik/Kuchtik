/**
 * Refactored Main application entry point using RecipeRepository
 */

import RecipeRepository from './repositories/RecipeRepository.js';
import gitHubAPIAdapter from './adapters/GitHubAPIAdapter.js';
import { renderRecipeCard } from './components/RecipeCard.js';
import { getSelectedRecipeNames, collectIngredientsFromRecipes } from './utils/recipeUtils.js';
import { openShortcut } from './utils/shortcutsUtils.js';
import { recipeUI } from './components/RecipeUI.js';
import { githubAuth } from './services/githubAuth.js';

// Application state
const state = {
  recipes: [],
  recipeListElement: null,
  repository: null,
};

/**
 * Initialize the application
 */
async function initializeApp() {
  console.log('🚀 Initializing main application with RecipeRepository...');
  
  // Initialize RecipeRepository
  try {
    state.repository = new RecipeRepository({
      syncStrategy: 'immediate',
      cacheExpiry: 5 * 60 * 1000, // 5 minutes
      enableOptimisticUpdates: true,
      maxRetries: 3,
      retryDelay: 1000
    });
    
    // Set the GitHub API adapter
    state.repository.setGitHubAPI(gitHubAPIAdapter);
    
    // Set up repository event listeners
    setupRepositoryEventHandlers();
    
    console.log('✅ RecipeRepository initialized in main app');
  } catch (error) {
    console.error('❌ Failed to initialize RecipeRepository:', error);
  }

  // Get DOM elements
  state.recipeListElement = document.getElementById('recipeList');
  const exportBtn = document.getElementById('exportBtn');
  
  if (!state.recipeListElement || !exportBtn) {
    console.error('Required DOM elements not found');
    return;
  }
  
  // Load and render recipes using repository
  try {
    console.log('🔄 Loading recipes from repository...');
    state.recipes = await state.repository.getAll();
    renderRecipes(state.recipes);
    console.log(`✅ Loaded and rendered ${state.recipes.length} recipes`);
  } catch (error) {
    console.error('❌ Failed to load recipes:', error);
    // Show empty state or error message
    showLoadingError(error);
  }

  // Initialize Recipe UI
  try {
    await recipeUI.initialize();
    console.log('✅ RecipeUI initialized');
  } catch (error) {
    console.error('❌ Failed to initialize RecipeUI:', error);
  }

  // Setup export button
  exportBtn.addEventListener('click', handleExportClick);
  
  // Setup create recipe button
  const createBtn = document.getElementById('createRecipeBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      recipeUI.showCreateForm();
    });
  }
  
  // Update auth status
  updateAuthStatus();
  
  console.log('✅ Main application initialized successfully');
}

/**
 * Set up event listeners for repository events
 */
function setupRepositoryEventHandlers() {
  // Listen for cache updates to refresh the display
  state.repository.on('cacheUpdate', () => {
    console.log('🔄 Repository cache updated, refreshing display...');
    refreshRecipesFromCache();
  });

  // Listen for operation success to update the display
  state.repository.on('operationSuccess', (event) => {
    console.log('✅ Repository operation success:', event);
    refreshRecipesFromCache();
  });

  // Listen for rollbacks to refresh the display
  state.repository.on('rollback', (event) => {
    console.log('↩️ Repository rollback occurred:', event);
    refreshRecipesFromCache();
  });
}

/**
 * Refresh recipes display from repository cache
 */
async function refreshRecipesFromCache() {
  try {
    // Get current recipes from repository (may use cache)
    state.recipes = await state.repository.getAll();
    renderRecipes(state.recipes);
  } catch (error) {
    console.error('❌ Failed to refresh recipes from cache:', error);
  }
}

/**
 * Show loading error message
 * @param {Error} error - The error that occurred
 */
function showLoadingError(error) {
  if (!state.recipeListElement) return;
  
  state.recipeListElement.innerHTML = `
    <div class="col-12">
      <div class="alert alert-warning" role="alert">
        <h4 class="alert-heading">Unable to Load Recipes</h4>
        <p>There was a problem loading the recipes: ${error.message}</p>
        <hr>
        <p class="mb-0">Please check your internet connection and try refreshing the page.</p>
        <button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button>
      </div>
    </div>
  `;
}

/**
 * Render all recipes to the DOM
 * @param {Object[]} recipes - Array of recipe objects
 */
function renderRecipes(recipes) {
  if (!state.recipeListElement) return;
  
  // Clear existing recipes
  state.recipeListElement.innerHTML = '';
  
  if (recipes.length === 0) {
    // Show empty state
    state.recipeListElement.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info text-center" role="alert">
          <h4><i class="fas fa-utensils me-2"></i>No Recipes Found</h4>
          <p>You don't have any recipes yet. Create your first recipe to get started!</p>
          ${githubAuth.isAuthenticated() ? 
            '<button class="btn btn-primary" onclick="recipeUI.showCreateForm()"><i class="fas fa-plus me-2"></i>Create Recipe</button>' : 
            '<p><i class="fas fa-info-circle me-2"></i>Sign in to create and manage recipes.</p>'
          }
        </div>
      </div>
    `;
    return;
  }
  
  recipes.forEach(recipe => {
    renderRecipeCard(recipe, state.recipeListElement);
  });
}

// Make renderRecipes available globally for RecipeUI
window.renderRecipes = renderRecipes;

// Make recipeUI available globally for template click handlers
window.recipeUI = recipeUI;

// Make repository available globally if needed
window.recipeRepository = state.repository;

/**
 * Handle export button click
 */
function handleExportClick() {
  try {
    const selectedNames = getSelectedRecipeNames();
    
    if (selectedNames.length === 0) {
      alert('Prosím vyberte alespoň jeden recept!');
      return;
    }
    
    const ingredients = collectIngredientsFromRecipes(state.recipes, selectedNames);
    
    if (ingredients.length === 0) {
      alert('Žádné ingredience k exportu!');
      return;
    }
    
    openShortcut(ingredients);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Chyba při exportu receptů!');
  }
}

/**
 * Update authentication status in UI
 */
function updateAuthStatus() {
  const authBtn = document.getElementById('authBtn');
  const createBtn = document.getElementById('createRecipeBtn');
  
  if (!authBtn) return;
  
  if (githubAuth.isAuthenticated()) {
    const userInfo = githubAuth.getUserInfo();
    const userName = userInfo?.name || userInfo?.login || 'User';
    authBtn.innerHTML = `<i class="fas fa-user me-2"></i>${userName}`;
    authBtn.classList.remove('btn-outline-primary');
    authBtn.classList.add('btn-outline-success');
    
    if (createBtn) {
      createBtn.style.display = 'inline-block';
    }
    
    // Add sign out functionality
    authBtn.onclick = () => {
      if (confirm('Are you sure you want to sign out?')) {
        githubAuth.signOut();
        updateAuthStatus();
        location.reload();
      }
    };
  } else {
    authBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Sign In';
    authBtn.classList.remove('btn-outline-success');
    authBtn.classList.add('btn-outline-primary');
    
    if (createBtn) {
      createBtn.style.display = 'none';
    }
    
    // Add sign in functionality
    authBtn.onclick = async () => {
      try {
        await githubAuth.authenticate();
        updateAuthStatus();
        // Refresh recipes after authentication
        if (state.repository) {
          await refreshRecipesFromCache();
        }
      } catch (error) {
        alert(`Authentication failed: ${error.message}`);
      }
    };
  }
}

/**
 * Manual refresh function for debugging/testing
 */
window.refreshRecipes = async () => {
  console.log('🔄 Manual refresh triggered...');
  if (state.repository) {
    await refreshRecipesFromCache();
  }
};

/**
 * Get repository cache status for debugging
 */
window.getCacheStatus = () => {
  if (state.repository) {
    return state.repository.getCacheMetadata();
  }
  return null;
};

/**
 * Clear repository cache for debugging
 */
window.clearCache = () => {
  if (state.repository) {
    state.repository.clearCache();
    console.log('🗑️ Repository cache cleared');
  }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
