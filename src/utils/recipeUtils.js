/**
 * Utility functions for recipe data manipulation
 */

/**
 * Normalize text by removing diacritics and converting to lowercase
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text without diacritics
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

/**
 * Calculate fuzzy match score for a string against a query
 * @param {string} text - Text to search in
 * @param {string} query - Search query
 * @returns {number} Score between 0-1, higher is better match
 */
function calculateFuzzyScore(text, query) {
  if (!text || !query) return 0;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Normalize for diacritics matching
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  
  // Exact match gets highest score (check both original and normalized)
  if (textLower === queryLower || normalizedText === normalizedQuery) return 1;
  
  // Check if normalized query is contained in normalized text (diacritics-insensitive)
  if (normalizedText.includes(normalizedQuery)) {
    const position = normalizedText.indexOf(normalizedQuery);
    const lengthRatio = normalizedQuery.length / normalizedText.length;
    const positionScore = 1 - (position / normalizedText.length);
    return 0.9 + (lengthRatio * 0.08) + (positionScore * 0.02);
  }
  
  // Check if query is contained in original text (case-insensitive)
  if (textLower.includes(queryLower)) {
    const position = textLower.indexOf(queryLower);
    const lengthRatio = queryLower.length / textLower.length;
    const positionScore = 1 - (position / textLower.length);
    return 0.8 + (lengthRatio * 0.15) + (positionScore * 0.05);
  }
  
  // Only do fuzzy matching if query is longer than 2 characters to avoid matching single letters
  if (normalizedQuery.length <= 2) return 0;
  
  // Fuzzy matching - check for character sequence matches on normalized text
  let score = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let totalMatches = 0;
  const minMatchRatio = 0.6; // Require at least 60% of characters to match
  
  for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedText[i] === normalizedQuery[queryIndex]) {
      totalMatches++;
      consecutiveMatches++;
      queryIndex++;
      score += consecutiveMatches * 0.01;
    } else {
      consecutiveMatches = 0;
    }
  }
  
  // Calculate final score based on match ratio and consecutive bonus
  const matchRatio = totalMatches / normalizedQuery.length;
  if (matchRatio < minMatchRatio) return 0; // Reject weak matches
  
  return (matchRatio * 0.4) + (score * 0.05); // Lower score for fuzzy matches
}

/**
 * Find match positions and details for highlighting
 * @param {string} text - Text to search in
 * @param {string} query - Search query
 * @returns {Object} Match details with positions and score
 */
function findMatches(text, query) {
  if (!text || !query) return { score: 0, matches: [] };
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const matches = [];
  
  // Exact match (original)
  if (textLower === queryLower) {
    return { score: 1, matches: [{ start: 0, end: text.length, type: 'exact' }] };
  }
  
  // Exact match (normalized - for diacritics)
  if (normalizedText === normalizedQuery) {
    return { score: 1, matches: [{ start: 0, end: text.length, type: 'exact' }] };
  }
  
  // Substring match (normalized - for diacritics insensitive matching)
  const normalizedIndex = normalizedText.indexOf(normalizedQuery);
  if (normalizedIndex !== -1) {
    // For normalized matches, find the original text position by counting characters
    // This is much simpler - just find the actual word position in original text
    const originalSubstringIndex = textLower.indexOf(queryLower);
    if (originalSubstringIndex !== -1) {
      // Use the original case-insensitive position for highlighting
      const position = originalSubstringIndex;
      const lengthRatio = normalizedQuery.length / normalizedText.length;
      const positionScore = 1 - (position / textLower.length);
      const score = 0.9 + (lengthRatio * 0.08) + (positionScore * 0.02);
      
      matches.push({
        start: originalSubstringIndex,
        end: originalSubstringIndex + query.length,
        type: 'substring'
      });
      
      return { score, matches };
    }
  }
  
  // Substring match (original case-insensitive)
  const substringIndex = textLower.indexOf(queryLower);
  if (substringIndex !== -1) {
    const position = substringIndex;
    const lengthRatio = queryLower.length / textLower.length;
    const positionScore = 1 - (position / textLower.length);
    const score = 0.8 + (lengthRatio * 0.15) + (positionScore * 0.05);
    
    matches.push({
      start: substringIndex,
      end: substringIndex + queryLower.length,
      type: 'substring'
    });
    
    return { score, matches };
  }
  
  // Only do fuzzy matching if query is longer than 2 characters
  if (normalizedQuery.length <= 2) {
    return { score: 0, matches: [] };
  }
  
  // For fuzzy matching, require a much higher threshold to avoid random character highlighting
  // Skip fuzzy matching entirely for ingredients/short text to avoid scattered character matches
  if (normalizedText.length < normalizedQuery.length * 2) {
    return { score: 0, matches: [] };
  }
  
  // Fuzzy matching - find meaningful character sequences (use normalized text)
  let score = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let totalMatches = 0;
  let currentMatch = null;
  const minMatchRatio = 0.8; // Much stricter - need 80% of characters to match
  const minConsecutiveLength = 2; // Need at least 2 consecutive characters
  
  for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedText[i] === normalizedQuery[queryIndex]) {
      if (!currentMatch) {
        currentMatch = { start: i, end: i + 1, type: 'fuzzy', consecutiveCount: 1 };
      } else {
        currentMatch.end = i + 1;
        currentMatch.consecutiveCount++;
      }
      
      totalMatches++;
      consecutiveMatches++;
      queryIndex++;
      score += consecutiveMatches * 0.01;
    } else {
      if (currentMatch) {
        // Only add matches that have at least 2 consecutive characters and are not whitespace
        const matchText = normalizedText.substring(currentMatch.start, currentMatch.end).trim();
        if (matchText.length >= minConsecutiveLength && currentMatch.consecutiveCount >= minConsecutiveLength) {
          matches.push(currentMatch);
        }
        currentMatch = null;
      }
      consecutiveMatches = 0;
    }
  }
  
  // Add final match if exists, has minimum length, and is not whitespace
  if (currentMatch) {
    const matchText = normalizedText.substring(currentMatch.start, currentMatch.end).trim();
    if (matchText.length >= minConsecutiveLength && currentMatch.consecutiveCount >= minConsecutiveLength) {
      matches.push(currentMatch);
    }
  }
  
  const matchRatio = totalMatches / normalizedQuery.length;
  if (matchRatio < minMatchRatio || matches.length === 0) {
    return { score: 0, matches: [] };
  }
  
  const finalScore = (matchRatio * 0.3) + (score * 0.05);
  
  return { score: finalScore, matches };
}

/**
 * Search recipes with detailed match information for highlighting
 * @param {Object[]} recipes - Array of recipe objects
 * @param {string} query - Search query
 * @param {number} minScore - Minimum score threshold (0-1)
 * @returns {Object[]} Sorted array of matching recipes with match details
 */
export function searchRecipesWithHighlighting(recipes, query, minScore = 0.1) {
  if (!query || query.trim() === '') {
    return recipes.map(recipe => ({ 
      recipe, 
      score: 1, 
      matches: { name: [], tags: [], ingredients: [] },
      shouldExpand: false 
    }));
  }
  
  const results = [];
  
  recipes.forEach(recipe => {
    let totalScore = 0;
    let hasMatch = false;
    const matches = { name: [], tags: [], ingredients: [] };
    let shouldExpand = false;
    
    // Priority 1: Recipe name (weight: 0.6)
    const nameMatch = findMatches(recipe.name || '', query);
    if (nameMatch.score > 0) {
      totalScore += nameMatch.score * 0.6;
      hasMatch = true;
      matches.name = nameMatch.matches;
    }
    
    // Priority 2: Tags (weight: 0.3)
    if (recipe.tags) {
      const tagsText = Array.isArray(recipe.tags) ? recipe.tags.join(', ') : recipe.tags;
      const tagsMatch = findMatches(tagsText, query);
      if (tagsMatch.score > 0) {
        totalScore += tagsMatch.score * 0.3;
        hasMatch = true;
        matches.tags = tagsMatch.matches;
      }
    }
    
    // Priority 3: Ingredients (weight: 0.1)
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      const ingredientsText = recipe.ingredients.join(' ');
      const ingredientsMatch = findMatches(ingredientsText, query);
      if (ingredientsMatch.score > 0) {
        totalScore += ingredientsMatch.score * 0.1;
        hasMatch = true;
        matches.ingredients = ingredientsMatch.matches;
        shouldExpand = true; // Expand when ingredients match (hidden content)
      }
    }
    
    // Include recipe if it meets minimum score threshold
    if (hasMatch && totalScore >= minScore) {
      results.push({ recipe, score: totalScore, matches, shouldExpand });
    }
  });
  
  // Sort by score (highest first), then by name
  return results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.recipe.name || '').localeCompare(b.recipe.name || '');
  });
}

/**
 * Search recipes with priority-based fuzzy matching
 * @param {Object[]} recipes - Array of recipe objects
 * @param {string} query - Search query
 * @param {number} minScore - Minimum score threshold (0-1)
 * @returns {Object[]} Sorted array of matching recipes with scores
 */
export function searchRecipes(recipes, query, minScore = 0.1) {
  if (!query || query.trim() === '') {
    return recipes.map(recipe => ({ recipe, score: 1 }));
  }
  
  const results = [];
  
  recipes.forEach(recipe => {
    let totalScore = 0;
    let hasMatch = false;
    
    // Priority 1: Recipe name (weight: 0.6)
    const nameScore = calculateFuzzyScore(recipe.name || '', query);
    if (nameScore > 0) {
      totalScore += nameScore * 0.6;
      hasMatch = true;
    }
    
    // Priority 2: Tags (weight: 0.3)
    if (recipe.tags) {
      const tagsText = Array.isArray(recipe.tags) ? recipe.tags.join(' ') : recipe.tags;
      const tagsScore = calculateFuzzyScore(tagsText, query);
      if (tagsScore > 0) {
        totalScore += tagsScore * 0.3;
        hasMatch = true;
      }
    }
    
    // Priority 3: Ingredients (weight: 0.1)
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      const ingredientsText = recipe.ingredients.join(' ');
      const ingredientsScore = calculateFuzzyScore(ingredientsText, query);
      if (ingredientsScore > 0) {
        totalScore += ingredientsScore * 0.1;
        hasMatch = true;
      }
    }
    
    // Include recipe if it meets minimum score threshold
    if (hasMatch && totalScore >= minScore) {
      results.push({ recipe, score: totalScore });
    }
  });
  
  // Sort by score (highest first), then by name
  return results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.recipe.name || '').localeCompare(b.recipe.name || '');
  });
}

/**
 * Apply highlighting to text based on match positions
 * @param {string} text - Original text
 * @param {Object[]} matches - Array of match objects with start/end positions
 * @returns {string} HTML string with <mark> tags for highlighting
 */
export function highlightText(text, matches) {
  if (!text || !matches || matches.length === 0) {
    return text || '';
  }
  
  // Sort matches by start position
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
  
  let result = '';
  let lastIndex = 0;
  
  sortedMatches.forEach(match => {
    // Get the text content for this match
    const matchText = text.substring(match.start, match.end);
    
    // Only create highlight tags if there's actual non-empty content
    if (matchText && matchText.trim().length > 0) {
      // Add text before match
      result += text.substring(lastIndex, match.start);
      // Add highlighted match
      result += `<mark class="search-highlight">${matchText}</mark>`;
      lastIndex = match.end;
    }
  });
  
  // Add remaining text after last match
  result += text.substring(lastIndex);
  
  return result;
}

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
 * Collect ingredients from selected recipes grouped by recipe
 * @param {Object[]} recipes - Array of recipe objects
 * @param {string[]} selectedRecipeNames - Array of selected recipe names
 * @returns {Array} Array of recipe objects with ingredients and metadata
 */
export function collectIngredientsGroupedByRecipe(recipes, selectedRecipeNames) {
  const groupedIngredients = [];
  
  selectedRecipeNames.forEach(recipeName => {
    const recipe = findRecipeByName(recipes, recipeName);
    if (recipe && recipe.ingredients) {
      groupedIngredients.push({
        recipeName: recipe.name,
        recipeId: recipeName, // Use filename as ID
        ingredients: recipe.ingredients,
        defaultScale: 1
      });
    }
  });
  
  return groupedIngredients;
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
