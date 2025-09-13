/**
 * iOS Shortcuts integration utilities
 */

const DEFAULT_SHORTCUT_NAME = 'Import receptů';

/**
 * Generate iOS Shortcuts URL with ingredients
 * @param {string[]} ingredients - Array of ingredient strings
 * @param {string} shortcutName - Name of the iOS shortcut (optional)
 * @returns {string} iOS Shortcuts URL
 */
export function generateShortcutUrl(ingredients, shortcutName = DEFAULT_SHORTCUT_NAME) {
  if (!ingredients || ingredients.length === 0) {
    throw new Error('No ingredients provided');
  }
  
  const text = encodeURIComponent(ingredients.join('\n'));
  const encodedShortcutName = encodeURIComponent(shortcutName);
  
  return `shortcuts://run-shortcut?name=${encodedShortcutName}&input=text&text=${text}`;
}

/**
 * Open iOS Shortcuts with ingredients
 * @param {string[]} ingredients - Array of ingredient strings
 * @param {string} shortcutName - Name of the iOS shortcut (optional)
 */
export function openShortcut(ingredients, shortcutName = DEFAULT_SHORTCUT_NAME) {
  const url = generateShortcutUrl(ingredients, shortcutName);
  window.location.href = url;
}

/**
 * Validate that iOS Shortcuts can be opened (basic check)
 * @returns {boolean} True if iOS Shortcuts URL scheme is supported
 */
export function isShortcutsSupported() {
  // Basic check - this will only work in iOS Safari/WebView
  return typeof window !== 'undefined' && 
         window.location && 
         navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad');
}
