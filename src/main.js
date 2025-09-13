/**
 * Main application entry point
 */

import { loadAllRecipes } from './services/recipeAPI.js';
import { renderRecipeCard } from './components/RecipeCard.js';
import { getSelectedRecipeNames, collectIngredientsFromRecipes } from './utils/recipeUtils.js';
import { openShortcut } from './utils/shortcutsUtils.js';

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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
