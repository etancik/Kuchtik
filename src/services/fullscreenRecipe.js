/**
 * Fullscreen recipe viewer with screen wake lock functionality and deeplink support
 */

import { t } from '../i18n/i18n.js';
import { escapeHtml, generateFilenameFromRecipeName } from '../utils/recipeUtils.js';
import { templateLoader } from '../utils/templateLoader.js';
import { editorMode } from './workerEditor.js';

// Global variables for modal management
let currentModal = null;
let wakeLock = null;

/**
 * Update URL to include fullscreen recipe parameter
 * @param {string} recipeId - Recipe ID to include in URL
 */
export function updateUrlForFullscreen(recipeId) {
  const url = new window.URL(window.location);
  url.searchParams.set('recipe', recipeId);
  window.history.pushState(
    { fullscreenRecipe: recipeId },
    '',
    url.toString().replace(window.location.origin, '')
  );
}

/**
 * Remove fullscreen from URL
 */
export function removeFullscreenFromUrl() {
  const url = new window.URL(window.location);
  url.searchParams.delete('recipe');
  window.history.pushState(
    null,
    '',
    url.toString().replace(window.location.origin, '')
  );
}

/**
 * Parse fullscreen recipe ID from current URL
 * @returns {Object|null} Object with recipeId or null if not found
 */
export function parseFullscreenUrl() {
  const urlParams = new window.URLSearchParams(window.location.search);
  const recipeId = urlParams.get('recipe');
  return recipeId ? { recipeId } : null;
}

/**
 * Request screen wake lock to keep screen on
 */
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen wake lock activated');
      
      wakeLock.addEventListener('release', () => {
        console.log('Screen wake lock released');
      });
    } catch (err) {
      console.warn('Failed to request wake lock:', err);
    }
  } else {
    console.warn('Wake Lock API not supported');
  }
}

/**
 * Release screen wake lock
 */
async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Screen wake lock released manually');
    } catch (err) {
      console.warn('Failed to release wake lock:', err);
    }
  }
}

/**
 * Create fullscreen recipe modal HTML using template
 * @param {Object} recipe - Recipe data object
 * @returns {Promise<string>} HTML string for the modal
 */
async function createFullscreenModalHTML(recipe) {
  const recipeName = recipe.name || 'Untitled Recipe';
  const recipeTags = recipe.tags || [];
  const recipeIngredients = recipe.ingredients || [];
  const recipeSteps = recipe.instructions || [];
  const recipeNotes = typeof recipe.notes === 'string' ? [recipe.notes] : recipe.notes ?? [];
  const servings = recipe.servings || '';
  const cookingTime = recipe.cookingTime || '';

  // Format ingredients
  const ingredients = recipeIngredients.map(ingredient => {
    const text = typeof ingredient === 'string' ? ingredient : ingredient.text || '';
    return `<li class="mb-2">${escapeHtml(text)}</li>`;
  }).join('');

  // Format instructions (no manual numbering since we use <ol>)
  const instructions = recipeSteps.map((step) => {
    return `<li class="mb-3">${escapeHtml(step)}</li>`;
  }).join('');

  // Format notes
  const notes = recipeNotes.length > 0 
    ? `<div class="mt-4">
        <h4 class="border-bottom pb-2 mb-3 fullscreen-section-header">
          <i class="fas fa-sticky-note me-2"></i>${t('recipes.notes')}
        </h4>
        <ul class="mb-0">${recipeNotes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
       </div>`
    : '';

  // Format tags
  const tags = recipeTags.length > 0
    ? `<div class="mb-3">
        <small class="text-muted">
          <i class="fas fa-tags me-1"></i>
          ${recipeTags.map(tag => `<span class="badge bg-secondary me-1">${escapeHtml(tag)}</span>`).join('')}
        </small>
       </div>`
    : '';

  // Format servings and cooking time
  const servingsInfo = servings 
    ? `<div class="col-md-6 mb-2">
        <strong><i class="fas fa-users me-2"></i>${t('recipes.servings')}:</strong> ${escapeHtml(servings)}
       </div>` 
    : '';

  const cookingTimeInfo = cookingTime 
    ? `<div class="col-md-6 mb-2">
        <strong><i class="fas fa-clock me-2"></i>${t('recipes.cookingTime')}:</strong> ${escapeHtml(cookingTime)}
       </div>` 
    : '';

  // Template data
  const archiveAction = recipe.metadata?.archived === true ? 'recipes.restoreFromArchive' : 'recipes.moveToArchive';
  const actionButtons = editorMode ? `
    <div class="d-flex flex-wrap gap-2 align-items-center">
      <button class="btn btn-outline-primary d-flex align-items-center fullscreen-edit-btn" 
              id="fullscreenEditBtn"
              title="${t('recipes.editRecipe')}">
        <i class="fas fa-edit me-2"></i>
        <span>${t('common.edit')}</span>
      </button>
      <button type="button" class="btn btn-outline-secondary d-flex align-items-center" id="fullscreenArchiveBtn">
        <i class="fas fa-archive me-2" aria-hidden="true"></i>
        <span>${t(archiveAction)}</span>
      </button>
      <button class="btn btn-outline-danger d-flex align-items-center fullscreen-delete-btn" 
              id="fullscreenDeleteBtn"
              title="${t('recipes.deleteRecipe')}">
        <i class="fas fa-trash me-1"></i>
      </button>
    </div>` : '';

  const templateData = {
    recipeName: escapeHtml(recipeName),
    exitFullscreenLabel: t('fullscreen.exitFullscreen'),
    ingredientsLabel: t('recipes.ingredients'),
    instructionsLabel: t('recipes.instructions'),
    actionButtons,
    tags,
    servingsInfo,
    cookingTimeInfo,
    ingredients,
    instructions,
    notes
  };

  return await templateLoader.loadAndProcessTemplate('src/templates/fullscreen-modal.html', templateData);
}

/**
 * Show recipe in fullscreen mode
 * @param {Object} recipe - Recipe data object
 * @param {boolean} updateUrl - Whether to update the URL (default: true)
 */
export async function showFullscreenRecipe(recipe, updateUrl = true) {
  // Remove existing modal if present
  const existingModal = document.getElementById('fullscreenRecipeModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create and append new modal
  const modalHTML = await createFullscreenModalHTML(recipe);
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal element and initialize Bootstrap modal
  const modalElement = document.getElementById('fullscreenRecipeModal');
  const modal = new window.bootstrap.Modal(modalElement);
  currentModal = { modal, recipe };

  // Update URL if requested
  if (updateUrl) {
    const recipeId = recipe.metadata?.id || recipe.id || generateFilenameFromRecipeName(recipe.name).replace('.json', '');
    updateUrlForFullscreen(recipeId);
  }

  // Request wake lock for fullscreen mode (non-blocking)
  requestWakeLock().catch(err => {
    console.warn('Wake lock not available on this device:', err);
  });

  // Set up recipe actions (only if authenticated)
  if (editorMode) {
    const editBtn = modalElement.querySelector('#fullscreenEditBtn');
    const archiveBtn = modalElement.querySelector('#fullscreenArchiveBtn');
    const deleteBtn = modalElement.querySelector('#fullscreenDeleteBtn');

    if (editBtn) {
      editBtn.addEventListener('click', async () => {
        // Close fullscreen modal first
        modal.hide();
        // Import and use RecipeUI dynamically
        try {
          const { recipeUI } = await import('../components/RecipeUI.js');
          recipeUI.showEditForm(recipe);
        } catch (error) {
          console.error('Failed to load RecipeUI:', error);
        }
      });
    }

    archiveBtn.addEventListener('click', async () => {
      archiveBtn.disabled = true;
      try {
        const { recipeUI } = await import('../components/RecipeUI.js');
        const updated = await recipeUI.toggleArchive(recipe);
        if (updated) modal.hide();
      } finally {
        archiveBtn.disabled = false;
      }
    });

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        // Import and use RecipeUI dynamically
        try {
          const { recipeUI } = await import('../components/RecipeUI.js');
          const recipeId = recipe.metadata?.id || recipe.name;
          const recipeName = recipe.name;
          recipeUI.showDeleteConfirmation(recipeId, recipeName, recipe.metadata?.sha);
        } catch (error) {
          console.error('Failed to load RecipeUI:', error);
        }
      });
    }
  }

  // Clean up when modal is closed
  modalElement.addEventListener('hidden.bs.modal', async () => {
    await releaseWakeLock();
    modalElement.remove();
    currentModal = null;
    
    // Remove fullscreen from URL when modal is closed
    if (updateUrl) {
      removeFullscreenFromUrl();
    }
  });

  // Handle visibility change to re-request wake lock if needed
  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      await requestWakeLock();
    }
  });

  // Show the modal
  modal.show();
}

/**
 * Handle browser back/forward navigation
 * @param {Function} getRecipeById - Function to get recipe by ID
 */
export function handleFullscreenNavigation(getRecipeById) {
  window.addEventListener('popstate', async () => {
    const urlData = parseFullscreenUrl();
    
    if (urlData && urlData.recipeId) {
      // URL indicates fullscreen should be shown
      if (!currentModal) {
        try {
          const recipe = await getRecipeById(urlData.recipeId);
          if (recipe) {
            await showFullscreenRecipe(recipe, false); // Don't update URL again
          } else {
            console.warn('Recipe not found for deeplink:', urlData.recipeId);
            removeFullscreenFromUrl();
          }
        } catch (error) {
          console.error('Error loading recipe for deeplink:', error);
          removeFullscreenFromUrl();
        }
      }
    } else {
      // URL indicates fullscreen should be closed
      if (currentModal) {
        currentModal.modal.hide();
      }
    }
  });
}

/**
 * Initialize fullscreen from URL on page load
 * @param {Function} getRecipeById - Function to get recipe by ID
 */
export async function initializeFullscreenFromUrl(getRecipeById) {
  const urlData = parseFullscreenUrl();
  
  console.log('🔗 DEEPLINK: Checking URL for deeplink:', window.location.search);
  
  if (urlData && urlData.recipeId) {
    console.log('🔍 DEEPLINK: Looking for recipe with ID:', urlData.recipeId);
    try {
      const recipe = await getRecipeById(urlData.recipeId);
      console.log('📖 DEEPLINK: Found recipe:', recipe ? recipe.name : 'NOT FOUND');
      if (recipe) {
        // Small delay to ensure the page is fully loaded
        setTimeout(async () => {
          console.log('🖥️ DEEPLINK: Showing fullscreen recipe:', recipe.name);
          await showFullscreenRecipe(recipe, false); // Don't update URL since we're loading from URL
        }, 100);
      } else {
        console.warn('DEEPLINK: Recipe not found for deeplink:', urlData.recipeId);
        removeFullscreenFromUrl();
      }
    } catch (error) {
      console.error('DEEPLINK: Error loading recipe from deeplink:', error);
      removeFullscreenFromUrl();
    }
  } else {
    console.log('🔗 DEEPLINK: No deeplink found in URL');
  }
}