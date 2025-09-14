/**
 * Refactored Main application entry point using RecipeRepository
 */

import RecipeRepository from './repositories/RecipeRepository.js';
import gitHubAPIAdapter from './adapters/GitHubAPIAdapter.js';
import { renderRecipeCard } from './components/RecipeCard.js';
import { getSelectedRecipeNames, collectIngredientsFromRecipes, searchRecipesWithHighlighting } from './utils/recipeUtils.js';
import { openShortcut } from './utils/shortcutsUtils.js';
import { recipeUI } from './components/RecipeUI.js';
import { githubAuth } from './services/githubAuth.js';
import { i18n, t } from './i18n/i18n.js';

// Application state
const state = {
  repository: null,
  recipes: [],
  filteredRecipes: [], // Store filtered results
  currentSearchQuery: '',
  recipeListElement: null
};

/**
 * Initialize the application
 */
async function initializeApp() {
  console.log('🚀 Initializing main application with RecipeRepository...');
  
  // Initialize i18n system first
  try {
    await i18n.initialize();
    console.log('✅ i18n system initialized');
    
    // Update HTML content with translations
    updateHTMLTranslations();
    setupLanguageSwitcher();
  } catch (error) {
    console.error('❌ Failed to initialize i18n:', error);
  }
  
  // Initialize RecipeRepository
  
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
  const searchInput = document.getElementById('searchInput');
  
  if (!state.recipeListElement || !exportBtn || !searchInput) {
    console.error('Required DOM elements not found');
    return;
  }
  
  // Load and render recipes using repository
  try {
    console.log('🔄 Loading recipes from repository...');
    state.recipes = await state.repository.getAll();
    state.filteredRecipes = state.recipes.map(recipe => ({ 
      recipe, 
      matches: { name: [], tags: [], ingredients: [] }, 
      shouldExpand: false 
    })); // Initialize filtered recipes with no highlighting
    renderRecipes(state.filteredRecipes);
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
  
  // Setup search functionality
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    // Debounce search to avoid excessive filtering
    if (searchTimeout) {
      window.clearTimeout(searchTimeout);
    }
    searchTimeout = window.setTimeout(() => {
      performSearch(e.target.value.trim());
    }, 300);
  });
  
  // Setup recipe selection change handler
  setupRecipeSelectionHandler(exportBtn);
  
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
 * Set up recipe selection handler for export button visibility
 * @param {HTMLElement} exportBtn - The export button element
 */
function setupRecipeSelectionHandler(exportBtn) {
  // Initially hide the export button
  exportBtn.style.display = 'none';
  
  // Add event listener for checkbox changes
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('selectRecipe')) {
      updateExportButtonVisibility(exportBtn);
    }
  });
}

/**
 * Update export button visibility based on selected recipes
 * @param {HTMLElement} exportBtn - The export button element
 */
function updateExportButtonVisibility(exportBtn) {
  const selectedCheckboxes = document.querySelectorAll('.selectRecipe:checked');
  const hasSelection = selectedCheckboxes.length > 0;
  
  if (hasSelection) {
    exportBtn.style.display = 'block';
    exportBtn.classList.add('sticky-export-btn');
    
    const count = selectedCheckboxes.length;
    let recipesText = '';
    
    if (i18n.getCurrentLanguage() === 'cs') {
      // Czech plural handling
      if (count === 1) {
        recipesText = t('plurals.recipe');
      } else if (count >= 2 && count <= 4) {
        recipesText = t('plurals.recipes2to4');
      } else {
        recipesText = t('plurals.recipes5plus');
      }
      exportBtn.innerHTML = `<i class="fas fa-download me-2"></i>Exportovat ${count} ${recipesText} do Nákupního Seznamu`;
    } else {
      // English plural handling
      const plural = count > 1 ? 's' : '';
      exportBtn.innerHTML = `<i class="fas fa-download me-2"></i>Export ${count} Recipe${plural} to Shopping List`;
    }
  } else {
    exportBtn.style.display = 'none';
    exportBtn.classList.remove('sticky-export-btn');
    exportBtn.innerHTML = `<i class="fas fa-download me-2"></i><span data-i18n="recipes.exportToShoppingList">${t('recipes.exportToShoppingList')}</span>`;
  }
}

/**
 * Update HTML translations
 */
function updateHTMLTranslations() {
  // Update document language
  document.documentElement.lang = i18n.getCurrentLanguage();
  
  // Update title
  document.title = t('recipes.title');
  
  // Update all elements with data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });
  
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.placeholder = t(key);
  });
}

/**
 * Setup language switcher functionality
 */
function setupLanguageSwitcher() {
  const currentLangFlag = document.getElementById('currentLanguageFlag');
  const langLinks = document.querySelectorAll('[data-lang]');
  
  // Update current language flag display
  const currentLang = i18n.getCurrentLanguage();
  const langFlags = { en: '🇺🇸', cs: '🇨🇿' };
  if (currentLangFlag) {
    currentLangFlag.textContent = langFlags[currentLang] || '🇺🇸';
  }
  
  // Add click handlers for language links
  langLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const newLang = link.getAttribute('data-lang');
      if (newLang !== currentLang) {
        await i18n.setLanguage(newLang);
        // Update modal translations if RecipeUI is available
        if (window.recipeUI && window.recipeUI.updateModalTranslations) {
          window.recipeUI.updateModalTranslations();
        }
      }
    });
  });
}

/**
 * Refresh recipes display from repository cache
 */
async function refreshRecipesFromCache() {
  try {
    // Get current recipes from repository (may use cache)
    state.recipes = await state.repository.getAll();
    // Re-apply current search if any
    if (state.currentSearchQuery) {
      performSearch(state.currentSearchQuery);
    } else {
      state.filteredRecipes = state.recipes.map(recipe => ({ 
        recipe, 
        matches: { name: [], tags: [], ingredients: [] }, 
        shouldExpand: false 
      }));
      renderRecipes(state.filteredRecipes);
    }
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
        <h4 class="alert-heading">${t('recipes.loadingError')}</h4>
        <p>${t('recipes.loadingErrorMessage', { error: error.message })}</p>
        <hr>
        <p class="mb-0">${t('recipes.connectionMessage')}</p>
        <button class="btn btn-primary mt-2" onclick="location.reload()">${t('common.retry')}</button>
      </div>
    </div>
  `;
}

/**
 * Render all recipes to the DOM
 * @param {Object[]|Object[]} recipes - Array of recipe objects or search results with highlighting
 */
function renderRecipes(recipes) {
  if (!state.recipeListElement) return;
  
  // Clear existing recipes
  state.recipeListElement.innerHTML = '';
  
  if (recipes.length === 0) {
    // Show appropriate empty state message
    const isSearching = state.currentSearchQuery && state.currentSearchQuery.trim() !== '';
    const title = isSearching ? t('recipes.noResultsTitle') : t('recipes.noRecipesTitle');
    const message = isSearching ? t('recipes.noResultsMessage') : t('recipes.noRecipesMessage');
    
    state.recipeListElement.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info text-center" role="alert">
          <h4><i class="fas fa-${isSearching ? 'search' : 'utensils'} me-2"></i>${title}</h4>
          <p>${message}</p>
          ${!isSearching && githubAuth.isAuthenticated() ? 
            `<button class="btn btn-primary" onclick="recipeUI.showCreateForm()"><i class="fas fa-plus me-2"></i>${t('recipes.createRecipe')}</button>` : 
            !isSearching ? `<p><i class="fas fa-info-circle me-2"></i>${t('recipes.signInToManage')}</p>` : ''
          }
        </div>
      </div>
    `;
    return;
  }
  
  recipes.forEach(item => {
    // Handle both old format (just recipe objects) and new format (search results with highlighting)
    const recipe = item.recipe || item;
    const options = item.matches || item.shouldExpand ? {
      matches: item.matches || { name: [], tags: [], ingredients: [] },
      shouldExpand: item.shouldExpand || false
    } : {};
    
    renderRecipeCard(recipe, state.recipeListElement, options);
  });
  
  // Update export button visibility after rendering
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    updateExportButtonVisibility(exportBtn);
  }
}

// Make renderRecipes available globally for RecipeUI
window.renderRecipes = renderRecipes;

// Make recipeUI available globally for template click handlers
window.recipeUI = recipeUI;

// Make repository available globally if needed
window.recipeRepository = state.repository;

/**
 * Perform search and update the display
 * @param {string} query - Search query
 */
function performSearch(query) {
  state.currentSearchQuery = query;
  
  if (!query) {
    // No search query - show all recipes
    state.filteredRecipes = state.recipes.map(recipe => ({ 
      recipe, 
      matches: { name: [], tags: [], ingredients: [] }, 
      shouldExpand: false 
    }));
  } else {
    // Perform search with highlighting
    state.filteredRecipes = searchRecipesWithHighlighting(state.recipes, query, 0.1);
  }
  
  // Re-render with filtered results and highlighting
  renderRecipes(state.filteredRecipes);
}

/**
 * Handle export button click
 */
function handleExportClick() {
  try {
    const selectedNames = getSelectedRecipeNames();
    
    if (selectedNames.length === 0) {
      alert(t('recipes.selectAtLeastOne'));
      return;
    }
    
    const ingredients = collectIngredientsFromRecipes(state.recipes, selectedNames);
    
    if (ingredients.length === 0) {
      alert(t('recipes.noIngredientsToExport'));
      return;
    }
    
    openShortcut(ingredients);
  } catch (error) {
    console.error('Export failed:', error);
    alert(t('recipes.exportFailed'));
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
    const userName = userInfo?.name || userInfo?.login || t('navigation.user');
    authBtn.innerHTML = `<i class="fas fa-user me-2"></i>${userName}`;
    authBtn.classList.remove('btn-outline-primary');
    authBtn.classList.add('btn-outline-success');
    
    if (createBtn) {
      createBtn.style.display = 'inline-block';
    }
    
    // Add sign out functionality
    authBtn.onclick = () => {
      if (confirm(t('confirmations.signOutConfirm'))) {
        githubAuth.signOut();
        updateAuthStatus();
        location.reload();
      }
    };
  } else {
    authBtn.innerHTML = `<i class="fas fa-sign-in-alt me-2"></i><span data-i18n="navigation.signIn">${t('navigation.signIn')}</span>`;
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
        alert(t('confirmations.authenticationFailed', { error: error.message }));
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
