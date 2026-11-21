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

// Simple in-memory cache for recipes
const recipeCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  const initialSize = recipeCache.size;
  let removedCount = 0;
  
  for (const [key, value] of recipeCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      recipeCache.delete(key);
      removedCount++;
      console.log(`🗑️ Removed expired cache entry: ${key} (expired ${Math.round((now - value.timestamp - CACHE_DURATION)/1000)}s ago)`);
    }
  }
  
  if (removedCount > 0) {
    console.log(`🧹 Cache cleanup: removed ${removedCount}/${initialSize} entries (${recipeCache.size} remaining)`);
  }
}

/**
 * Load a single recipe from GitHub with retry logic and fallback
 * @param {string} filename - Recipe filename (e.g., 'gulas.json')
 * @param {boolean} forceRefresh - Skip cache and force fresh load
 * @returns {Promise<Object>} Recipe data
 */
export async function loadRecipe(filename, forceRefresh = false) {
  // Check cache first (unless forced refresh)
  if (!forceRefresh && recipeCache.has(filename)) {
    const cached = recipeCache.get(filename);
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      console.log(`💾 Using cached recipe: ${filename} (age: ${Math.round(age/1000)}s, cache size: ${recipeCache.size})`);
      return cached.data;
    } else {
      console.log(`⏰ Cache expired for: ${filename} (age: ${Math.round(age/1000)}s, removing)`);
      recipeCache.delete(filename);
    }
  } else if (forceRefresh && recipeCache.has(filename)) {
    console.log(`🔄 Force refresh requested, bypassing cache for: ${filename}`);
  }
  
  // Clean up old cache entries
  cleanupCache();
  
  // Try multiple approaches with fallbacks
  const strategies = [
    () => loadRecipeWithCacheBusting(filename),
    () => loadRecipeViaAPI(filename),
    () => loadRecipeStandard(filename)
  ];
  
  for (const [index, strategy] of strategies.entries()) {
    try {
      console.log(`🌐 Loading recipe attempt ${index + 1} for: ${filename}`);
      const data = await strategy();
      console.log(`✅ Recipe loaded successfully (strategy ${index + 1}): ${filename}`);
      
      // Cache the result
      recipeCache.set(filename, {
        data: data,
        timestamp: Date.now()
      });
      console.log(`💾 Cached recipe: ${filename} (cache size: ${recipeCache.size})`);
      
      return data;
    } catch (error) {
      console.warn(`⚠️ Strategy ${index + 1} failed for ${filename}:`, error.message);
      if (index === strategies.length - 1) {
        throw error; // Re-throw the last error if all strategies fail
      }
    }
  }
}

/**
 * Load recipe with cache busting parameter
 * @param {string} filename - Recipe filename
 * @returns {Promise<Object>} Recipe data
 */
async function loadRecipeWithCacheBusting(filename) {
  const timestamp = Date.now();
  const url = `https://raw.githubusercontent.com/etancik/Kuchtik/main/recipes/${filename}?t=${timestamp}`;
  console.log(`🔄 Loading with cache busting: ${url}`);
  
  const response = await fetchWithTimeout(url, 8000); // 8 second timeout
  
  if (!response.ok) {
    throw new Error(`Cache-busted fetch failed: ${filename} (${response.status})`);
  }
  
  return await response.json();
}

/**
 * Load recipe via GitHub API (more reliable but requires auth for high rate limits)
 * @param {string} filename - Recipe filename
 * @returns {Promise<Object>} Recipe data
 */
async function loadRecipeViaAPI(filename) {
  const url = `https://api.github.com/repos/etancik/Kuchtik/contents/recipes/${filename}`;
  console.log(`🔗 Loading via GitHub API: ${url}`);
  
  const response = await fetchWithTimeout(url, 10000); // 10 second timeout
  
  if (!response.ok) {
    throw new Error(`API fetch failed: ${filename} (${response.status})`);
  }
  
  const data = await response.json();
  const content = globalThis.atob(data.content); // Decode base64 content
  return JSON.parse(content);
}

/**
 * Load recipe using standard raw GitHub URL (fallback)
 * @param {string} filename - Recipe filename
 * @returns {Promise<Object>} Recipe data
 */
async function loadRecipeStandard(filename) {
  const url = `https://raw.githubusercontent.com/etancik/Kuchtik/main/recipes/${filename}`;
  console.log(`🌐 Loading standard: ${url}`);
  
  const response = await fetchWithTimeout(url, 15000); // 15 second timeout
  
  if (!response.ok) {
    throw new Error(`Standard fetch failed: ${filename} (${response.status})`);
  }
  
  return await response.json();
}

/**
 * Fetch with timeout to prevent hanging requests
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
function fetchWithTimeout(url, timeout = 10000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) => 
      globalThis.setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Load all recipes using GitHub API discovery
 * @param {boolean} forceRefresh - Skip cache and force fresh load
 * @returns {Promise<Object[]>} Array of recipe objects
 */
export async function loadAllRecipes(forceRefresh = false) {
  console.log('🔄 Starting to load all recipes...');
  
  try {
    const recipeFiles = await getRecipeFileList();
    console.log(`📋 Found ${recipeFiles.length} recipe files:`, recipeFiles);
    
    // Load all recipes with improved parallel processing
    const loadPromises = recipeFiles.map(async (recipeFile) => {
      try {
        console.log(`📖 Loading recipe: ${recipeFile}`);
        const data = await loadRecipe(recipeFile, forceRefresh);
        console.log(`✅ Successfully loaded: ${recipeFile}`);
        return data;
      } catch (error) {
        console.error(`❌ Error loading recipe ${recipeFile}:`, error);
        return null; // Return null for failed recipes
      }
    });
    
    // Wait for all recipes to load (parallel loading for better performance)
    const results = await Promise.all(loadPromises);
    
    // Filter out null results (failed recipes)
    const successfulRecipes = results.filter(recipe => recipe !== null);
    console.log(`✅ Successfully loaded ${successfulRecipes.length}/${recipeFiles.length} recipes`);
    
    return successfulRecipes;
    
  } catch (error) {
    console.error('❌ Failed to get recipe file list:', error);
    throw error;
  }
}

