/**
 * Refactored Main application entry point using RecipeRepository
 */

import RecipeRepository from './repositories/RecipeRepository.js';
import { renderRecipeCard } from './components/RecipeCard.js';
import { getRecipeId, collectIngredientsGroupedByRecipe, searchRecipesWithHighlighting, generateFilenameFromRecipeName } from './utils/recipeUtils.js';
import { recipeUI } from './components/RecipeUI.js';
import { editorMode, initializeWorkerSession, signInToWorker, workerRecipeAdapter, publicWorkerRecipeAdapter } from './services/workerEditor.js';
import { ingredientsExportService } from './services/ingredientsExport.js';
import { i18n, t } from './i18n/i18n.js';
import { handleFullscreenNavigation, initializeFullscreenFromUrl } from './services/fullscreenRecipe.js';
import { skeletonCardService } from './services/skeletonCardService.js';

let workerSession = null;

// Application state
const state = {
  repository: null,
  recipes: [],
  filteredRecipes: [], // Store filtered results
  currentSearchQuery: '',
  recipeView: 'favorites',
  activeCatalogView: 'favorites',
  selectedRecipeIds: new Set(),
  recipeListElement: null
};

/**
 * Sort recipes by lastModified date (most recently modified first)
 * @param {Array} recipes - Array of recipe objects to sort
 * @returns {Array} Sorted array of recipes
 */
function sortRecipesByDate(recipes) {
  return recipes.sort((a, b) => {
    // Check multiple possible timestamp fields, prioritize lastModified
    const aDate = a.metadata?.lastModified || a.lastModified || a.metadata?.createdAt || a.metadata?.createdDate || a.createdDate || a.createdAt;
    const bDate = b.metadata?.lastModified || b.lastModified || b.metadata?.createdAt || b.metadata?.createdDate || b.createdDate || b.createdAt;
    
    const aParsed = aDate ? new Date(aDate) : new Date(0);
    const bParsed = bDate ? new Date(bDate) : new Date(0);
    
    // If both have dates, sort by date (newest first)
    if (aParsed.getTime() !== 0 && bParsed.getTime() !== 0) {
      return bParsed.getTime() - aParsed.getTime();
    }
    
    // If only one has a date, prefer the one with a date
    if (aParsed.getTime() !== 0) return -1;
    if (bParsed.getTime() !== 0) return 1;
    
    // If neither has a date, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

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
  try {
    workerSession = await initializeWorkerSession();
    state.repository = new RecipeRepository({
      syncStrategy: 'immediate',
      cacheExpiry: 5 * 60 * 1000, // 5 minutes
      enableOptimisticUpdates: true,
      maxRetries: editorMode ? 1 : 3,
      optimisticUpdates: !editorMode,
      retryDelay: 1000
    });
    
    state.repository.setAdapter(editorMode ? workerRecipeAdapter : publicWorkerRecipeAdapter);
    
    // Set up repository event handlers
    setupRepositoryEventHandlers();
    updateAuthStatus();
    
    console.log('✅ RecipeRepository initialized');
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
    
    // Initialize skeleton card service
    await skeletonCardService.init();
    
    // Show skeleton cards while loading
    if (state.recipeListElement) {
      const estimatedCount = skeletonCardService.estimateCardCount();
      skeletonCardService.showSkeletons(state.recipeListElement, estimatedCount);
    }
    
    state.recipes = await state.repository.getAll();
    
    // Sort recipes with most recently modified first
    sortRecipesByDate(state.recipes);
    
    state.filteredRecipes = state.recipes.map(recipe => ({ 
      recipe, 
      matches: { name: [], tags: [], ingredients: [] }, 
      shouldExpand: false 
    })); // Initialize filtered recipes with no highlighting
    
    // Hide skeletons and render real recipes
    if (state.recipeListElement) {
      skeletonCardService.hideSkeletons(state.recipeListElement);
    }
    renderRecipes(state.filteredRecipes);
    console.log(`✅ Loaded and rendered ${state.recipes.length} recipes`);
  } catch (error) {
    console.error('❌ Failed to load recipes:', error);
    // Hide skeletons on error and show error message
    if (state.recipeListElement && skeletonCardService.isShowingSkeletons(state.recipeListElement)) {
      skeletonCardService.hideSkeletons(state.recipeListElement);
    }
    // Show empty state or error message
    showLoadingError(error);
  }

  // Initialize Recipe UI
  try {
    // Share the repository instance with RecipeUI
    recipeUI.repository = state.repository;
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
  
  document.getElementById('recipeViews').addEventListener('click', event => {
    const button = event.target.closest('[data-recipe-view]');
    if (!button) return;
    window.clearTimeout(searchTimeout);
    const view = button.dataset.recipeView;
    if (view === 'archive') {
      state.recipeView = state.recipeView === 'archive' ? state.activeCatalogView : 'archive';
    } else {
      state.recipeView = view;
      state.activeCatalogView = view;
    }
    performSearch(searchInput.value.trim());
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
  
  // Initialize deeplink functionality
  console.log('🔗 Setting up deeplink navigation...');
  handleFullscreenNavigation(async (normalizedId) => {
    // Find recipe by normalized ID - need to match against all recipes
    const recipes = await state.repository.getAll();
    return recipes.find(recipe => {
      const recipeId = recipe.metadata?.id || recipe.id || generateFilenameFromRecipeName(recipe.name).replace('.json', '');
      return recipeId === normalizedId;
    });
  });
  await initializeFullscreenFromUrl(async (normalizedId) => {
    // Find recipe by normalized ID - need to match against all recipes
    console.log('🔍 DEEPLINK: Looking up recipe with normalized ID:', normalizedId);
    const recipes = await state.repository.getAll();
    
    const foundRecipe = recipes.find(recipe => {
      const recipeId = recipe.metadata?.id || recipe.id || generateFilenameFromRecipeName(recipe.name).replace('.json', '');
      return recipeId === normalizedId;
    });
    
    console.log('📖 DEEPLINK: Found recipe:', foundRecipe ? foundRecipe.name : 'NOT FOUND');
    return foundRecipe;
  });
  
  console.log('✅ Main application initialized successfully');
}

/**
 * Set up event listeners for repository events
 */
function setupRepositoryEventHandlers() {
  // Listen for cache updates to refresh the display
  state.repository.on('cacheUpdated', () => {
    console.log('🔄 Repository cache updated, refreshing display...');
    refreshRecipesFromCache();
  });

  // Listen for recipes updates to refresh the display
  state.repository.on('recipesUpdated', () => {
    console.log('🔄 Repository recipes updated, refreshing display...');
    refreshRecipesFromCache();
  });

    // Listen for operation success to update the display
  state.repository.on('operationSuccess', (event) => {
    console.log('✅ Repository operation success:', event);
    refreshRecipesFromCache();
  });
}

/**
 * Update UI button states based on current authentication status
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
      const { recipeId } = e.target.dataset;
      if (e.target.checked) state.selectedRecipeIds.add(recipeId);
      else state.selectedRecipeIds.delete(recipeId);
      updateExportButtonVisibility(exportBtn);
    }
  });
}

/**
 * Update export button visibility based on selected recipes
 * @param {HTMLElement} exportBtn - The export button element
 */
function updateExportButtonVisibility(exportBtn) {
  const count = state.selectedRecipeIds.size;
  const hasSelection = count > 0;
  
  if (hasSelection) {
    exportBtn.style.display = 'block';
    exportBtn.classList.add('sticky-export-btn');
    
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
  
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
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
  const language = currentLang === 'cs' ? 'cs' : 'en';
  const currentLangLabel = document.getElementById('currentLanguageLabel');
  if (currentLangFlag) currentLangFlag.src = 'src/assets/flag-' + language + '.svg';
  if (currentLangLabel) currentLangLabel.textContent = language === 'cs' ? 'Čeština' : 'English';
  
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
    
    // Sort recipes with most recently modified first
    sortRecipesByDate(state.recipes);
    
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
        <button class="btn btn-primary mt-2" id="retryRecipesBtn">${t('common.retry')}</button>
      </div>
    </div>
  `;
  document.getElementById('retryRecipesBtn')?.addEventListener('click', () => location.reload());
}

/**
 * Render all recipes to the DOM
 * @param {Object[]|Object[]} recipes - Array of recipe objects or search results with highlighting
 */
function renderRecipes(recipes) {
  if (!state.recipeListElement) return;
  
  const isSearching = Boolean(state.currentSearchQuery);
  const isFavorite = recipe => recipe.metadata?.favorite === true && recipe.metadata?.archived !== true;
  document.querySelectorAll('[data-recipe-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.recipeView === state.recipeView));
  });
  recipes = recipes.filter(item => {
    const recipe = item.recipe || item;
    if (state.recipeView === 'archive') return recipe.metadata?.archived === true;
    if (isSearching) return true;
    return state.recipeView === 'favorites' ? isFavorite(recipe) : recipe.metadata?.archived !== true;
  });
  const ids = new Set(state.recipes.map(getRecipeId));
  for (const id of state.selectedRecipeIds) {
    if (!ids.has(id)) state.selectedRecipeIds.delete(id);
  }
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) updateExportButtonVisibility(exportBtn);

  state.recipeListElement.replaceChildren();
  
  if (recipes.length === 0) {
    // Show appropriate empty state message
    const emptyView = !isSearching && state.recipeView !== 'all';
    const title = isSearching ? t('recipes.noResultsTitle') :
      emptyView ? t('recipes.' + state.recipeView) : t('recipes.noRecipesTitle');
    const message = isSearching ? t('recipes.noResultsMessage') :
      emptyView ? t('recipes.empty' + (state.recipeView === 'favorites' ? 'Favorites' : 'Archive')) : t('recipes.noRecipesMessage');
    
    state.recipeListElement.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info text-center" role="alert">
          <h4><i class="fas fa-${isSearching ? 'search' : 'utensils'} me-2"></i>${title}</h4>
          <p>${message}</p>
          ${!isSearching && !emptyView && editorMode ?
            `<button class="btn btn-primary" id="createEmptyRecipeBtn"><i class="fas fa-plus me-2"></i>${t('recipes.createRecipe')}</button>` :
            !isSearching && !emptyView && workerSession === false ? `<p><i class="fas fa-info-circle me-2"></i>${t('recipes.signInToManage')}</p>` : ''
          }
        </div>
      </div>
    `;
    document.getElementById('createEmptyRecipeBtn')?.addEventListener('click', () => recipeUI.showCreateForm());
    return;
  }
  
  recipes.forEach(item => {
    // Handle both old format (just recipe objects) and new format (search results with highlighting)
    const recipe = item.recipe || item;
    const options = item.matches || item.shouldExpand ? {
      matches: item.matches || { name: [], tags: [], ingredients: [] },
      shouldExpand: item.shouldExpand || false
    } : {};
    
    renderRecipeCard(recipe, state.recipeListElement, {
      ...options,
      selected: state.selectedRecipeIds.has(getRecipeId(recipe)),
      onFavorite: editorMode && recipe.metadata?.archived !== true ? toggleFavorite : null
    });
  });
}

async function toggleFavorite(recipe) {
  try {
    await state.repository.update(getRecipeId(recipe), {
      ...recipe,
      metadata: { ...recipe.metadata, favorite: recipe.metadata?.favorite !== true }
    });
    await recipeUI.refreshWorkerRecipes();
  } catch (error) {
    recipeUI.showErrorMessage(t('operations.updateFailed', { error: error.message }));
    await recipeUI.refreshWorkerRecipes();
  }
}

// Make recipeUI available globally for template click handlers
window.recipeUI = recipeUI;


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
async function handleExportClick() {
  try {
    const selectedRecipeIds = [...state.selectedRecipeIds];
    
    if (selectedRecipeIds.length === 0) {
      alert(t('recipes.selectAtLeastOne'));
      return;
    }
    
    const groupedRecipes = collectIngredientsGroupedByRecipe(state.recipes, selectedRecipeIds);
    
    if (groupedRecipes.length === 0) {
      alert(t('recipes.noIngredientsToExport'));
      return;
    }
    
    // Show ingredients modal with grouped recipes (each recipe has its own scale)
    await ingredientsExportService.showModalWithGroupedRecipes(groupedRecipes);
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

  const showSignIn = workerSession === false;
  authBtn.hidden = !showSignIn;
  authBtn.classList.toggle('d-flex', showSignIn);
  authBtn.setAttribute('aria-label', t('navigation.signIn'));
  authBtn.onclick = signInToWorker;
  createBtn?.setAttribute('aria-label', t('recipes.createRecipe'));
  createBtn?.style.setProperty('display', editorMode ? 'inline-flex' : 'none', 'important');
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
