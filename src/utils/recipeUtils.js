/**
 * Utility functions for recipe data manipulation
 */

/**
 * Get array of selected recipe names from checked checkboxes
 * @returns {string[]} Array of selected recipe names
 */
export function getSelectedRecipeNames() {
  const checkedBoxes = document.querySelectorAll('.selectRecipe:checked');
  const recipeNames = [];
  
  checkedBoxes.forEach(checkbox => {
    // Find the recipe title within the same card
    const cardTitle = checkbox.closest('.card').querySelector('.recipe-title');
    if (cardTitle) {
      const recipeName = extractRecipeName(cardTitle.textContent);
      recipeNames.push(recipeName);
    }
  });
  
  return recipeNames;
}

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
  return recipes.find(r => r.name === recipeName);
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
    if (recipe && recipe.ingredients) {
      ingredients.push(...recipe.ingredients);
    }
  });
  
  return ingredients;
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
  
  const requiredFields = ['name', 'ingredients', 'instructions', 'tags'];
  return requiredFields.every(field => Object.prototype.hasOwnProperty.call(recipe, field));
}

/**
 * Format recipe display text for portions and time
 * @param {Object} recipe - Recipe object
 * @returns {string} Formatted display text
 */
export function formatRecipeSubtitle(recipe) {
  const servings = recipe.servings || '';
  const time = recipe.cookingTime || '';
  
  if (servings && time) {
    return `${servings} servings, ${time}`;
  } else if (servings) {
    return `${servings} servings`;
  } else if (time) {
    return time;
  }
  
  return '';
}
