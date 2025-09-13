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
 * Load a single recipe from GitHub
 * @param {string} filename - Recipe filename (e.g., 'gulas.json')
 * @returns {Promise<Object>} Recipe data
 */
export async function loadRecipe(filename) {
  // Use full GitHub raw URL for consistent loading
  const url = `https://raw.githubusercontent.com/etancik/Kuchtik/main/recipes/${filename}`;
  console.log(`🌐 Loading recipe from: ${url}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error(`❌ Failed to fetch ${url}: ${response.status}`);
    throw new Error(`Failed to load recipe: ${filename} (${response.status})`);
  }
  
  const data = await response.json();
  console.log(`✅ Recipe loaded successfully: ${filename}`);
  return data;
}

/**
 * Load all recipes using GitHub API discovery
 * @returns {Promise<Object[]>} Array of recipe objects
 */
export async function loadAllRecipes() {
  console.log('🔄 Starting to load all recipes...');
  const recipes = [];
  
  try {
    const recipeFiles = await getRecipeFileList();
    console.log(`📋 Found ${recipeFiles.length} recipe files:`, recipeFiles);
    
    // Load all recipes
    for (const recipeFile of recipeFiles) {
      try {
        console.log(`📖 Loading recipe: ${recipeFile}`);
        const data = await loadRecipe(recipeFile);
        console.log(`✅ Successfully loaded: ${recipeFile}`);
        recipes.push(data);
      } catch (error) {
        console.error(`❌ Error loading recipe ${recipeFile}:`, error);
        // Continue loading other recipes even if one fails
      }
    }
  } catch (error) {
    console.error('❌ Failed to get recipe file list:', error);
    throw error;
  }
  
  return recipes;
}
