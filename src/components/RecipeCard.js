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
  const recipeIngredients = recipe.ingredients || [];
  const recipeSteps = recipe.instructions || [];
  const recipeNotes = recipe.notes || [];
  
  // Extract highlighting options
  const { matches = {}, shouldExpand = false } = options;
  const { name: nameMatches = [], tags: tagMatches = [], ingredients: ingredientMatches = [] } = matches;
  
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
  
  // Apply highlighting to ingredients for display
  const highlightedIngredients = Array.isArray(recipeIngredients) ? 
    recipeIngredients.map(ingredient => {
      // Handle both string and object formats for ingredients
      const ingredientText = typeof ingredient === 'string' ? ingredient : ingredient.text;
      
      // Find matches that apply to this ingredient
      const allIngredientsText = recipeIngredients.map(ing => 
        typeof ing === 'string' ? ing : ing.text
      ).join(' ');
      const relevantMatches = ingredientMatches.filter(match => {
        const matchText = allIngredientsText.substring(match.start, match.end);
        return ingredientText.toLowerCase().includes(matchText.toLowerCase());
      });
      return highlightText(ingredientText, relevantMatches);
    }) : [];
    
  const ingredients = highlightedIngredients.length > 0 
    ? highlightedIngredients.map((i) => `<li>${i}</li>`).join('')
    : '';
  const steps = Array.isArray(recipeSteps)
    ? recipeSteps.map((k) => `<li>${k}</li>`).join('')
    : '';
  const notes =
    Array.isArray(recipeNotes) && recipeNotes.length > 0
      ? `<div class="mt-3"><h6>${t('recipeForm.notes')}:</h6><ul>${recipeNotes.map((n) => `<li>${n}</li>`).join('')}</ul></div>`
      : '';

  const recipeId = recipe.id || recipeName.replace(/\s+/g, '-').toLowerCase();

  div.innerHTML = `
    <div class="card recipe-card">
      <div class="card-body p-0">
        <!-- Collapsed Header (always visible) -->
        <div class="recipe-header">
          <div class="d-flex align-items-center p-3">
            <div class="checkbox-container">
              <input type="checkbox" class="selectRecipe" id="checkbox-${recipeId}">
            </div>
            <div class="flex-grow-1 recipe-title-area" data-bs-toggle="collapse" data-bs-target="#recipe-${recipeId}" role="button" aria-expanded="${shouldExpand}">
              <h6 class="mb-1 recipe-title">${highlightedName}</h6>
              <div class="text-muted small recipe-subtitle">
                ${tags ? `${t('recipes.tags')}: ${tags}` : ''}
                ${tags && subtitleText ? ' • ' : ''}${subtitleText}
              </div>
            </div>
            <div class="expand-toggle" data-bs-toggle="collapse" data-bs-target="#recipe-${recipeId}" role="button" aria-expanded="${shouldExpand}">
              <i class="fas fa-chevron-down expand-icon"></i>
            </div>
          </div>
        </div>
        
        <!-- Expandable Content -->
        <div class="collapse${shouldExpand ? ' show' : ''}" id="recipe-${recipeId}">
          <div class="recipe-content px-3 pb-3">
            <!-- Action buttons (shown when expanded) -->
            <div class="d-flex justify-content-end gap-2 mb-3">
              <button class="btn btn-outline-primary btn-sm edit-recipe-btn" 
                      data-recipe='${JSON.stringify(recipe).replace(/'/g, '&apos;')}' 
                      title="${t('recipes.editRecipe')}">
                <i class="fas fa-edit me-1"></i>${t('common.edit')}
              </button>
              <button class="btn btn-outline-danger btn-sm delete-recipe-btn" 
                      data-recipe-id='${recipe.id || recipeName}' 
                      data-recipe-name='${recipeName}' 
                      title="${t('recipes.deleteRecipe')}">
                <i class="fas fa-trash me-1"></i>${t('common.delete')}
              </button>
            </div>
            
            <!-- Recipe details -->
            <div class="row">
              <div class="col-md-6 mb-3">
                <h6>${t('recipeForm.ingredients')}:</h6>
                <ul class="mb-0">${ingredients}</ul>
              </div>
              <div class="col-md-6 mb-3">
                <h6>${t('recipeForm.instructions')}:</h6>
                <ol class="mb-0">${steps}</ol>
              </div>
            </div>
            ${notes}
          </div>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for expand/collapse animation
  const collapseElement = div.querySelector('.collapse');
  const expandIcons = div.querySelectorAll('.expand-icon');
  
  collapseElement.addEventListener('show.bs.collapse', () => {
    expandIcons.forEach(icon => {
      icon.style.transform = 'rotate(180deg)';
    });
  });
  
  collapseElement.addEventListener('hide.bs.collapse', () => {
    expandIcons.forEach(icon => {
      icon.style.transform = 'rotate(0deg)';
    });
  });

  // Add event listeners for checkbox to prevent collapse but allow export functionality
  const checkboxContainer = div.querySelector('.checkbox-container');
  const checkbox = div.querySelector('.selectRecipe');
  
  // Handle container click - prevent collapse but allow checkbox functionality
  checkboxContainer.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent collapse
    // Let the checkbox handle its own toggle naturally
    if (event.target !== checkbox) {
      // If clicking on container (not checkbox itself), toggle checkbox
      checkbox.checked = !checkbox.checked;
      // Dispatch a proper change event that will bubble up for export functionality
      const changeEvent = document.createEvent('Event');
      changeEvent.initEvent('change', true, true);
      checkbox.dispatchEvent(changeEvent);
    }
  });
  
  // Handle checkbox click - prevent collapse but allow normal checkbox behavior
  checkbox.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent collapse
    // Let the change event bubble naturally for export functionality
  });
  
  // Prevent mouse events that might trigger collapse
  checkboxContainer.addEventListener('mousedown', (event) => {
    event.stopPropagation();
  });
  
  checkboxContainer.addEventListener('mouseup', (event) => {
    event.stopPropagation();
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

/**
 * Clear all recipe cards from container
 * @param {HTMLElement} container - Container element to clear
 */
export function clearRecipeCards(container) {
  if (container) {
    container.innerHTML = '';
  }
}
