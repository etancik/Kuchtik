/**
 * Main application entry point
 */

import { loadAllRecipes } from './services/recipeAPI.js';
import { renderRecipeCard } from './components/RecipeCard.js';
import { getSelectedRecipeNames, collectIngredientsFromRecipes } from './utils/recipeUtils.js';
import { openShortcut } from './utils/shortcutsUtils.js';
import { recipeCreationUI } from './components/RecipeCreationUI.js';
import { githubAuth } from './services/githubAuth.js';

// Application state
const state = {
  recipes: [],
  recipeListElement: null,
};

/**
 * Initialize the application
 */
async function initializeApp() {
  // Get DOM elements
  state.recipeListElement = document.getElementById('recipeList');
  const exportBtn = document.getElementById('exportBtn');
  
  if (!state.recipeListElement || !exportBtn) {
    console.error('Required DOM elements not found');
    return;
  }
  
  // Load and render recipes
  try {
    state.recipes = await loadAllRecipes();
    renderRecipes(state.recipes);
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
  
  // Setup export button
  exportBtn.addEventListener('click', handleExportClick);
  
  // Setup create recipe button
  const createBtn = document.getElementById('createRecipeBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      recipeCreationUI.show();
    });
  }
  
  // Update auth status
  updateAuthStatus();
}

/**
 * Render all recipes to the DOM
 * @param {Object[]} recipes - Array of recipe objects
 */
function renderRecipes(recipes) {
  if (!state.recipeListElement) return;
  
  recipes.forEach(recipe => {
    renderRecipeCard(recipe, state.recipeListElement);
  });
}

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
      } catch (error) {
        alert(`Authentication failed: ${error.message}`);
      }
    };
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
