/**
 * Recipe card rendering component
 */

import { formatRecipeSubtitle, validateRecipe } from '../utils/recipeUtils.js';

/**
 * Create a recipe card DOM element
 * @param {Object} recipe - Recipe data object
 * @returns {HTMLElement} Recipe card element
 */
export function createRecipeCard(recipe) {
  if (!validateRecipe(recipe)) {
    console.error('Invalid recipe data:', recipe);
    return null;
  }

  const div = document.createElement('div');
  div.classList.add('col');

  const subtitle = formatRecipeSubtitle(recipe);
  const subtitleText = subtitle ? ` (${subtitle})` : '';
  
  // Handle optional fields safely
  const tags = recipe.tagy ? recipe.tagy.join(', ') : '';
  const ingredients = recipe.ingredience ? recipe.ingredience.map(i => `<li>${i}</li>`).join('') : '';
  const steps = recipe.postup ? recipe.postup.map(k => `<li>${k}</li>`).join('') : '';
  const notes = recipe.poznamky ? `<h6>Poznámky:</h6><ul>${recipe.poznamky.map(n => `<li>${n}</li>`).join('')}</ul>` : '';

  div.innerHTML = `
    <div class="card h-100">
      <div class="card-body">
        <h5 class="card-title">
          <input type="checkbox" class="selectRecipe me-2">
          ${recipe.nazev}${subtitleText}
        </h5>
        <p class="card-subtitle mb-2 text-muted">Tagy: ${tags}</p>
        <h6>Ingredience:</h6>
        <ul>${ingredients}</ul>
        <h6>Postup:</h6>
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
