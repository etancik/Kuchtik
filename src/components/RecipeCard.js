/**
 * Recipe card rendering component
 */

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
  return requiredFields.every(field => Object.prototype.hasOwnProperty.call(recipe, field));
}

/**
 * Create a recipe card DOM element
 * @param {Object} recipe - Recipe data object
 * @returns {HTMLElement} Recipe card element
 */
export function createRecipeCard(recipe) {
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
  
  // Format time and servings info
  const cookingTime = recipe.cookingTime || '';
  const servings = recipe.servings || '';
  
  let subtitleParts = [];
  if (servings) subtitleParts.push(`${servings} ${typeof servings === 'number' ? 'servings' : servings}`);
  if (cookingTime) subtitleParts.push(cookingTime);
  const subtitleText = subtitleParts.length > 0 ? ` (${subtitleParts.join(', ')})` : '';
  
  // Handle fields safely
  const tags = Array.isArray(recipeTags) ? recipeTags.join(', ') : '';
  const ingredients = Array.isArray(recipeIngredients) ? recipeIngredients.map(i => `<li>${i}</li>`).join('') : '';
  const steps = Array.isArray(recipeSteps) ? recipeSteps.map(k => `<li>${k}</li>`).join('') : '';
  const notes = Array.isArray(recipeNotes) && recipeNotes.length > 0 ? `<h6>Notes:</h6><ul>${recipeNotes.map(n => `<li>${n}</li>`).join('')}</ul>` : '';

  div.innerHTML = `
    <div class="card h-100">
      <div class="card-body">
        <h5 class="card-title">
          <input type="checkbox" class="selectRecipe me-2">
          ${recipeName}${subtitleText}
        </h5>
        <p class="card-subtitle mb-2 text-muted">Tags: ${tags}</p>
        <h6>Ingredients:</h6>
        <ul>${ingredients}</ul>
        <h6>Instructions:</h6>
        <ol>${steps}</ol>
        ${notes}
      </div>
    </div>
  `;
  
  return div;
}

/**
 * Render recipe card to container
 * @param {Object} recipe - Recipe data object
 * @param {HTMLElement} container - Container element to append to
 * @returns {HTMLElement|null} Created recipe card element
 */
export function renderRecipeCard(recipe, container) {
  const card = createRecipeCard(recipe);
  
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
