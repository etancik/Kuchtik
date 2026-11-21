/**
 * Recipe card component for displaying recipe information
 * Handles recipe card generation and interactions
 */

import { t } from '../i18n/i18n.js';
import { escapeHtml, highlightText } from '../utils/recipeUtils.js';

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
function createRecipeCard(recipe, options = {}) {
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
  const tags = highlightedTags;

  div.innerHTML = `
    <div class="card recipe-card position-relative">
      <div class="card-body p-0">
        <!-- Simple Recipe Header (no collapse) -->
        <div class="recipe-header">
          <div class="d-flex align-items-center">
            <label class="checkbox-container">
              <input type="checkbox" class="selectRecipe" id="checkbox-${escapeHtml(recipeId)}"
                     aria-labelledby="recipe-title-${escapeHtml(recipeId)}">
            </label>
            <div class="flex-grow-1 recipe-title-area">
              <h6 class="mb-1 recipe-title" id="recipe-title-${escapeHtml(recipeId)}">
                <button type="button" class="recipe-title-button">${highlightedName}</button>
              </h6>
              <div class="text-muted small recipe-subtitle">
                ${tags ? `${t('recipes.tags')}: ${tags}` : ''}
                ${tags && subtitleText ? ' • ' : ''}${escapeHtml(subtitleText)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  div.querySelector('.recipe-title-button').addEventListener('click', async () => {
    try {
      const { showFullscreenRecipe } = await import('../services/fullscreenRecipe.js');
      await showFullscreenRecipe(recipe);
    } catch (error) {
      console.error('Failed to load fullscreen recipe:', error);
    }
  });

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
