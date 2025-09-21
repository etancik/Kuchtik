/**
 * Recipe card component for displaying recipe information
 * Handles recipe card generation and interactions
 */

import { t } from '../i18n/i18n.js';
import { highlightText } from '../utils/recipeUtils.js';

/**
 * Simple recipe validation for English format
 * @param {Object} recipe - Recipe object to validate
 * @returns {boolean} True if recipe is valid
 */
function validateEnglishRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    return false;
  }

  const requiredFields = ['name', 'ingredients', 'instructions', 'tags'];
  return requiredFields.every((field) =>
    Object.prototype.hasOwnProperty.call(recipe, field)
  );
}

/**
 * Create a recipe card DOM element with collapsible functionality
 * @param {Object} recipe - Recipe data object
 * @param {Object} options - Options including highlighting data and expansion state
 * @param {Object} options.matches - Match data for highlighting {name: [], tags: [], ingredients: []}
 * @param {boolean} options.shouldExpand - Whether to expand the card initially
 * @returns {HTMLElement} Recipe card element
 */
export function createRecipeCard(recipe, options = {}) {
  // Validate English format
  if (!validateEnglishRecipe(recipe)) {
    console.error('Invalid recipe data - expected English format:', recipe);
    return null;
  }

  const div = document.createElement('div');
  div.classList.add('col');

  // Use English field names directly
  const recipeName = recipe.name || 'Untitled Recipe';
  const recipeTags = recipe.tags || [];
  
  // Generate recipe ID early for use in ingredient IDs
  const recipeId = recipe.metadata?.id || recipeName.replace(/\s+/g, '-').toLowerCase();
  
  // Extract highlighting options - remove shouldExpand since we don't use collapsing anymore
  const { matches = {} } = options;
  const { name: nameMatches = [], tags: tagMatches = [] } = matches;
  
  // Apply highlighting to recipe name
  const highlightedName = highlightText(recipeName, nameMatches);
  
  // Apply highlighting to tags - use the joined tags string for proper highlighting
  const tagsString = Array.isArray(recipeTags) ? recipeTags.join(', ') : recipeTags;
  const highlightedTags = highlightText(tagsString, tagMatches);

  // Format time and servings info
  const cookingTime = recipe.cookingTime || '';
  const servings = recipe.servings || '';

  let subtitleParts = [];
  if (servings) {
    subtitleParts.push(
      `${servings} ${typeof servings === 'number' ? t('recipes.servings').toLowerCase() : servings}`
    );
  }
  if (cookingTime) subtitleParts.push(cookingTime);
  const subtitleText =
    subtitleParts.length > 0 ? subtitleParts.join(' • ') : '';

  // Handle fields safely with highlighting
  const tags = highlightedTags || recipeTags.join(', ');

  div.innerHTML = `
    <div class="card recipe-card position-relative">
      <div class="card-body p-3">
        <!-- Simple Recipe Header (no collapse) -->
        <div class="recipe-header">
          <div class="d-flex align-items-center">
            <div class="checkbox-container">
              <input type="checkbox" class="selectRecipe" id="checkbox-${recipeId}">
            </div>
            <div class="flex-grow-1 recipe-title-area">
              <h6 class="mb-1 recipe-title">${highlightedName}</h6>
              <div class="text-muted small recipe-subtitle">
                ${tags ? `${t('recipes.tags')}: ${tags}` : ''}
                ${tags && subtitleText ? ' • ' : ''}${subtitleText}
              </div>
            </div>
            <div class="fullscreen-toggle fullscreen-recipe-btn" 
                 data-recipe='${JSON.stringify(recipe).replace(/'/g, '&apos;')}' 
                 title="${t('recipes.fullscreenRecipe')}"
                 role="button">
              <i class="fas fa-expand"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for checkbox to prevent any unwanted interactions
  // Add event listeners for checkbox functionality
  const checkboxContainer = div.querySelector('.checkbox-container');
  const checkbox = div.querySelector('.selectRecipe');
  
  // Handle container click - allow checkbox functionality
  checkboxContainer.addEventListener('click', (event) => {
    if (event.target !== checkbox) {
      // If clicking on container (not checkbox itself), toggle checkbox
      checkbox.checked = !checkbox.checked;
      // Dispatch a proper change event that will bubble up for export functionality
      const changeEvent = document.createEvent('Event');
      changeEvent.initEvent('change', true, true);
      checkbox.dispatchEvent(changeEvent);
    }
  });
  
  // Handle checkbox click - allow normal checkbox behavior
  checkbox.addEventListener('click', () => {
    // Let the change event bubble naturally for export functionality
  });  // Set up event listener for fullscreen button (always available)
  const fullscreenBtn = div.querySelector('.fullscreen-recipe-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent card collapse toggle
      const recipeData = JSON.parse(fullscreenBtn.getAttribute('data-recipe'));
      
      // Import and use fullscreen functionality
      import('../services/fullscreenRecipe.js').then(async ({ showFullscreenRecipe }) => {
        await showFullscreenRecipe(recipeData);
      }).catch(error => {
        console.error('Failed to load fullscreen recipe:', error);
      });
    });
  }

  return div;
}

/**
 * Render recipe card to container
 * @param {Object} recipe - Recipe data object
 * @param {HTMLElement} container - Container element to append to
 * @param {Object} options - Options including highlighting data and expansion state
 * @returns {HTMLElement|null} Created recipe card element
 */
export function renderRecipeCard(recipe, container, options = {}) {
  const card = createRecipeCard(recipe, options);

  if (card && container) {
    container.appendChild(card);
  }

  return card;
}

/**
 * Clear all recipe cards from container
 * @param {HTMLElement} container - Container element to clear
 */
export function clearRecipeCards(container) {
  if (container) {
    container.innerHTML = '';
  }
}
