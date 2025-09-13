/**
 * Utility functions for recipe data processing and manipulation
 */

/**
 * Extract recipe name from card title text
 * @param {string} cardTitle - Full card title text
 * @returns {string} Clean recipe name
 */
export function extractRecipeName(cardTitle) {
  return cardTitle.split(' (')[0].replace(/^\s*/, '');
}

/**
 * Find recipe by name in array of recipes
 * @param {Object[]} recipes - Array of recipe objects
 * @param {string} recipeName - Name to search for
 * @returns {Object|undefined} Found recipe or undefined
 */
export function findRecipeByName(recipes, recipeName) {
  return recipes.find(r => r.nazev === recipeName);
}

/**
 * Collect ingredients from selected recipes
 * @param {Object[]} recipes - Array of recipe objects
 * @param {string[]} selectedRecipeNames - Array of selected recipe names
 * @returns {string[]} Array of ingredients
 */
export function collectIngredientsFromRecipes(recipes, selectedRecipeNames) {
  const ingredients = [];
  
  selectedRecipeNames.forEach(recipeName => {
    const recipe = findRecipeByName(recipes, recipeName);
    if (recipe && recipe.ingredience) {
      ingredients.push(...recipe.ingredience);
    }
  });
  
  return ingredients;
}

/**
 * Get selected recipe names from DOM checkboxes
 * @returns {string[]} Array of selected recipe names
 */
export function getSelectedRecipeNames() {
  const checkedBoxes = document.querySelectorAll('.selectRecipe:checked');
  const recipeNames = [];
  
  checkedBoxes.forEach(checkbox => {
    const cardTitle = checkbox.closest('h5').textContent;
    const recipeName = extractRecipeName(cardTitle);
    recipeNames.push(recipeName);
  });
  
  return recipeNames;
}

/**
 * Validate recipe object structure
 * @param {Object} recipe - Recipe object to validate
 * @returns {boolean} True if recipe is valid
 */
export function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    return false;
  }
  
  const requiredFields = ['nazev', 'ingredience', 'postup', 'tagy'];
  return requiredFields.every(field => Object.prototype.hasOwnProperty.call(recipe, field));
}

/**
 * Format recipe display text for portions and time
 * @param {Object} recipe - Recipe object
 * @returns {string} Formatted display text
 */
export function formatRecipeSubtitle(recipe) {
  const portions = recipe.porce || '';
  const time = recipe.cas_pripravy || '';
  
  if (portions && time) {
    return `${portions} porce, ${time}`;
  } else if (portions) {
    return `${portions} porce`;
  } else if (time) {
    return time;
  }
  
  return '';
}
