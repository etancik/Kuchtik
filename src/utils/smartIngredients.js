/**
 * Smart Ingredients Processing Utilities
 * Handles intelligent parsing, scaling, and merging of recipe ingredients
 */

/**
 * Parse ingredient text into structured format
 * @param {string} ingredientText - Raw ingredient text like "500 g hovězí maso"
 * @returns {Object} Parsed ingredient object
 */
export function parseIngredient(ingredientText) {
  const text = ingredientText.trim();
  
  // Common Czech units and descriptive amounts
  const CZECH_UNITS = [
    'g', 'kg', 'ml', 'l', 'dl', 'ks',
    'lžíce', 'lžička', 'lžic', 'lžiček',
    'stroužky', 'stroužek', 'stroužků',
    'špetka', 'špetek', 'hrnek', 'hrnků',
    'šálek', 'šálků', 'sklenice', 'sklenic'
  ];
  
  // Pattern to match: [amount] [unit] [ingredient]
  const patterns = [
    // Numeric amount with known unit: "500 g hovězí maso", "2 stroužky česneku"
    new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(${CZECH_UNITS.join('|')})\\s+(.+)$`, 'i'),
    // Descriptive amount: "špetka soli"
    /^(špetka|hrnek|šálek|lžíce|lžička|sklenice)\s+(.+)$/i,
    // Just number: "2 cibule" (assume pieces)
    /^(\d+(?:\.\d+)?)\s+(.+)$/
  ];
  
  // Try each pattern
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length === 4) {
        // Pattern with explicit unit
        return {
          text: text,
          amount: parseFloat(match[1]),
          unit: match[2].toLowerCase(),
          ingredient: match[3]
        };
      } else if (match.length === 3) {
        if (isNaN(match[1])) {
          // Descriptive amount: "špetka soli"
          return {
            text: text,
            amount: 1,
            unit: match[1].toLowerCase(),
            ingredient: match[2]
          };
        } else {
          // Just number: "2 cibule" (assume pieces)
          return {
            text: text,
            amount: parseFloat(match[1]),
            unit: 'ks', // pieces in Czech
            ingredient: match[2]
          };
        }
      }
    }
  }
  
  // No pattern matched - ingredient without amount
  return {
    text: text,
    amount: null,
    unit: null,
    ingredient: text
  };
}

/**
 * Determine if ingredient should be exported by default
 * @param {string} ingredientText - Ingredient text to analyze
 * @returns {boolean} True if should be exported by default
 */
/**
 * Scale ingredient amounts by a simple multiplier
 * @param {Object} ingredient - Ingredient object with parsed data
 * @param {number} multiplier - Scaling factor (e.g., 0.5 for half, 2 for double)
 * @returns {Object} Scaled ingredient object with updated text
 */
export function scaleIngredient(ingredient, multiplier = 1) {
  // Don't scale ingredients without amounts
  if (!ingredient.parsed || ingredient.parsed.amount === null) {
    return { ...ingredient };
  }
  
  const originalAmount = ingredient.parsed.amount;
  const scaledAmount = originalAmount * multiplier;
  
  // Update the text with the new amount
  let scaledText = ingredient.text;
  const amountStr = originalAmount.toString();
  const scaledAmountStr = scaledAmount % 1 === 0 ? scaledAmount.toString() : scaledAmount.toFixed(1);
  
  // Replace the first occurrence of the amount in the text
  scaledText = scaledText.replace(amountStr, scaledAmountStr);
  
  return {
    ...ingredient,
    text: scaledText,
    parsed: {
      ...ingredient.parsed,
      amount: scaledAmount
    }
  };
}

/**
 * Normalize a list of ingredients to a consistent format
 * ONLY supports objects with text and exportDefault properties
 * @param {Array<Object>} ingredients - Array of ingredient objects with {text: string, exportDefault: boolean}
 * @returns {Array<Object>} Normalized array of ingredient objects
 */
export function normalizeIngredientsList(ingredients) {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  return ingredients.map(ingredient => {
    if (ingredient && typeof ingredient === 'object' && 'text' in ingredient) {
      const parsed = parseIngredient(ingredient.text);
      return {
        text: ingredient.text,
        exportDefault: 'exportDefault' in ingredient ? ingredient.exportDefault : true,
        // Flatten parsed properties into the main object
        amount: parsed.amount,
        unit: parsed.unit,
        ingredient: parsed.ingredient
      };
    } else {
      // Log warning for unsupported format
      console.warn('Unsupported ingredient format. Expected object with "text" property:', ingredient);
      // Fallback: convert to string and create object
      const text = String(ingredient);
      const parsed = parseIngredient(text);
      return {
        text: text,
        exportDefault: true,
        // Flatten parsed properties into the main object
        amount: parsed.amount,
        unit: parsed.unit,
        ingredient: parsed.ingredient
      };
    }
  });
}
