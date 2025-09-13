/**
 * Service for loading recipe data from GitHub API
 */

const GITHUB_API_BASE = 'https://api.github.com/repos/etancik/Kuchtik';

/**
 * Get list of recipe files from GitHub API
 * @returns {Promise<string[]>} Array of recipe filenames
 */
export async function getRecipeFileList() {
  const apiUrl = `${GITHUB_API_BASE}/contents/recipes`;
  const response = await fetch(apiUrl);
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  const files = await response.json();
  
  // Filter only JSON files
  return files
    .filter(file => file.type === 'file')
    .filter(file => file.name.endsWith('.json'))
    .map(file => file.name);
}

/**
 * Load a single recipe from URL
 * @param {string} url - Recipe file URL
 * @returns {Promise<Object>} Recipe data
 */
export async function loadRecipe(url) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to load recipe: ${url} (${response.status})`);
  }
  
  return response.json();
}

/**
 * Load all recipes using GitHub API discovery
 * @returns {Promise<Object[]>} Array of recipe objects
 */
export async function loadAllRecipes() {
  const recipes = [];
  
  const recipeFiles = await getRecipeFileList();
  console.log(`Found ${recipeFiles.length} recipes:`, recipeFiles);
  
  // Load all recipes
  for (const recipeFile of recipeFiles) {
    try {
      const url = `recipes/${recipeFile}`;
      const data = await loadRecipe(url);
      recipes.push(data);
    } catch (error) {
      console.error(`Error loading recipe ${recipeFile}:`, error);
    }
  }
  
  return recipes;
}
