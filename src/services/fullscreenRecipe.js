/**
 * Fullscreen recipe viewer with screen wake lock functionality
 */

import { t } from '../i18n/i18n.js';

let wakeLock = null;

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
 * Create fullscreen recipe modal HTML
 * @param {Object} recipe - Recipe data object
 * @returns {string} HTML string for the modal
 */
function createFullscreenModalHTML(recipe) {
  const recipeName = recipe.name || 'Untitled Recipe';
  const recipeTags = recipe.tags || [];
  const recipeIngredients = recipe.ingredients || [];
  const recipeSteps = recipe.instructions || [];
  const recipeNotes = recipe.notes || [];
  const servings = recipe.servings || '';
  const cookingTime = recipe.cookingTime || '';

  // Format ingredients
  const ingredients = recipeIngredients.map(ingredient => {
    const text = typeof ingredient === 'string' ? ingredient : ingredient.text || '';
    return `<li class="mb-2">${text}</li>`;
  }).join('');

  // Format instructions
  const steps = recipeSteps.map((step, index) => {
    return `<li class="mb-3"><strong>${index + 1}.</strong> ${step}</li>`;
  }).join('');

  // Format notes
  const notes = recipeNotes.length > 0 
    ? `<div class="mt-4">
        <h5>${t('recipes.notes')}:</h5>
        <ul class="mb-0">${recipeNotes.map(note => `<li>${note}</li>`).join('')}</ul>
       </div>`
    : '';

  // Format tags
  const tags = recipeTags.length > 0
    ? `<div class="mb-3">
        <small class="text-muted">
          <i class="fas fa-tags me-1"></i>
          ${recipeTags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
        </small>
       </div>`
    : '';

  return `
    <div class="modal fade" id="fullscreenRecipeModal" tabindex="-1" aria-labelledby="fullscreenRecipeModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-fullscreen">
        <div class="modal-content bg-dark text-light">
          <div class="modal-header border-secondary d-flex justify-content-between">
            <h1 class="modal-title fs-4 me-3" id="fullscreenRecipeModalLabel">${recipeName}</h1>
            <div class="d-flex align-items-center gap-3 flex-shrink-0">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="keepScreenOnToggle">
                <label class="form-check-label text-light" for="keepScreenOnToggle">
                  ${t('fullscreen.keepScreenOn')}
                </label>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="${t('fullscreen.exitFullscreen')}"></button>
            </div>
          </div>
          <div class="modal-body">
            <div class="container-fluid">
              <div class="row">
                <div class="col-12">
                  ${tags}
                  
                  <!-- Recipe info -->
                  <div class="row mb-4">
                    ${servings ? `<div class="col-md-6 mb-2">
                      <strong><i class="fas fa-users me-2"></i>${t('recipes.servings')}:</strong> ${servings}
                    </div>` : ''}
                    ${cookingTime ? `<div class="col-md-6 mb-2">
                      <strong><i class="fas fa-clock me-2"></i>${t('recipes.cookingTime')}:</strong> ${cookingTime}
                    </div>` : ''}
                  </div>

                  <!-- Two column layout for larger screens -->
                  <div class="row">
                    <div class="col-lg-6 mb-4">
                      <h4 class="border-bottom border-secondary pb-2 mb-3">
                        <i class="fas fa-list-ul me-2"></i>${t('recipes.ingredients')}
                      </h4>
                      <ul class="list-unstyled fs-5">
                        ${ingredients}
                      </ul>
                    </div>
                    <div class="col-lg-6 mb-4">
                      <h4 class="border-bottom border-secondary pb-2 mb-3">
                        <i class="fas fa-tasks me-2"></i>${t('recipes.instructions')}
                      </h4>
                      <ol class="fs-5">
                        ${steps}
                      </ol>
                      ${notes}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Show recipe in fullscreen mode
 * @param {Object} recipe - Recipe data object
 */
export function showFullscreenRecipe(recipe) {
  // Remove existing modal if present
  const existingModal = document.getElementById('fullscreenRecipeModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create and append new modal
  const modalHTML = createFullscreenModalHTML(recipe);
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal element and initialize Bootstrap modal
  const modalElement = document.getElementById('fullscreenRecipeModal');
  const modal = new window.bootstrap.Modal(modalElement);

  // Set up wake lock toggle
  const wakeLockToggle = modalElement.querySelector('#keepScreenOnToggle');
  wakeLockToggle.addEventListener('change', async (e) => {
    if (e.target.checked) {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
    }
  });

  // Clean up when modal is closed
  modalElement.addEventListener('hidden.bs.modal', async () => {
    await releaseWakeLock();
    modalElement.remove();
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