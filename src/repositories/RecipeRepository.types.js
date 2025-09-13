/**
 * JSDoc type definitions for RecipeRepository
 * (for documentation and development reference)
 */

/**
 * Recipe data structure
 * @typedef {Object} Recipe
 * @property {string} name - Recipe name
 * @property {string} [description] - Recipe description
 * @property {Array<{name: string, amount?: string, unit?: string}>} ingredients - Recipe ingredients
 * @property {string[]} instructions - Cooking instructions
 * @property {number} [prepTime] - Preparation time in minutes
 * @property {number} [cookTime] - Cooking time in minutes
 * @property {number} [servings] - Number of servings
 * @property {string} [category] - Recipe category
 * @property {'easy'|'medium'|'hard'} [difficulty] - Difficulty level
 * @property {string[]} [tags] - Recipe tags
 * @property {string} [image] - Image URL
 * @property {string} [notes] - Additional notes
 * @property {string} [createdAt] - Creation timestamp
 * @property {string} [updatedAt] - Last update timestamp
 */

/**
 * Repository operation options
 * @typedef {Object} OperationOptions
 * @property {boolean} [forceRefresh] - Skip cache and force fresh load
 * @property {boolean} [includeMetadata] - Include cache metadata in response
 * @property {'immediate'|'delayed'|'batch'|'manual'} [syncStrategy] - Synchronization strategy
 * @property {boolean} [optimistic] - Enable optimistic updates
 * @property {number} [timeout] - Operation timeout in milliseconds
 * @property {number} [retryCount] - Number of retries
 */

/**
 * Repository configuration
 * @typedef {Object} RepositoryConfig
 * @property {number} [cacheTimeout] - Cache timeout in milliseconds
 * @property {number} [maxRetries] - Maximum retry attempts
 * @property {number} [retryDelay] - Base retry delay in milliseconds
 * @property {'immediate'|'delayed'|'batch'|'manual'} [syncStrategy] - Default sync strategy
 * @property {boolean} [optimisticUpdates] - Enable optimistic updates by default
 * @property {boolean} [enableLogging] - Enable console logging
 * @property {number} [batchSize] - Batch operation size
 * @property {boolean} [offlineMode] - Enable offline-only mode
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {Recipe} data - Cached recipe data
 * @property {number} timestamp - Cache timestamp
 * @property {boolean} [dirty] - Whether entry needs sync
 * @property {string} [version] - Data version/hash
 */

/**
 * Pending operation structure
 * @typedef {Object} PendingOperation
 * @property {'create'|'update'|'delete'|'read'} type - Operation type
 * @property {string} recipeName - Target recipe name
 * @property {Recipe} [data] - Operation data
 * @property {Recipe} [originalData] - Original data for rollback
 * @property {number} timestamp - Operation timestamp
 * @property {number} attempts - Number of attempts
 * @property {Error} [lastError] - Last error encountered
 */

/**
 * Sync status information
 * @typedef {Object} SyncStatus
 * @property {'idle'|'loading'|'syncing'|'error'} state - Repository state
 * @property {number} pendingCount - Number of pending operations
 * @property {Array<{id: string, type: string, recipeName: string, timestamp: number, attempts: number, age: number}>} pendingOperations - Pending operations
 * @property {CacheMetadata} cacheStatus - Cache metadata
 */

/**
 * Cache metadata
 * @typedef {Object} CacheMetadata
 * @property {number} totalEntries - Total cache entries
 * @property {number} validEntries - Valid (non-expired) entries
 * @property {number} expiredEntries - Expired entries
 * @property {number} cacheTimeout - Cache timeout in milliseconds
 * @property {Array<{name: string, age: number, expired: boolean}>} entries - Entry details
 */

/**
 * GitHub API integration interface for dependency injection
 * @typedef {Object} GitHubAPIIntegration
 * @property {function(): Promise<string[]>} getFileList - Get list of recipe files
 * @property {function(string): Promise<Recipe>} getFile - Get single recipe file
 * @property {function(string, Recipe): Promise<void>} createFile - Create new recipe file
 * @property {function(string, Recipe): Promise<void>} updateFile - Update existing recipe file
 * @property {function(string): Promise<void>} deleteFile - Delete recipe file
 * @property {function(string): Promise<boolean>} checkFileExists - Check if file exists
 * @property {function(string): Promise<{sha: string, size: number, lastModified: string}>} getFileMetadata - Get file metadata
 */

/**
 * Usage examples
 * 
 * @example Basic usage
 * ```javascript
 * const repo = new RecipeRepository({
 *   cacheTimeout: 5 * 60 * 1000,
 *   syncStrategy: 'delayed',
 *   optimisticUpdates: true
 * });
 * 
 * // Subscribe to events
 * repo.on('recipesUpdated', (recipes) => {
 *   updateUI(recipes);
 * });
 * 
 * // CRUD operations
 * const recipes = await repo.getAll();
 * const recipe = await repo.getByName('gulas');
 * const newRecipe = await repo.create({ name: 'pizza', ingredients: [...] });
 * const updated = await repo.update('pizza', { ...newRecipe, servings: 4 });
 * await repo.delete('pizza');
 * ```
 * 
 * @example Advanced synchronization
 * ```javascript
 * // Different sync strategies
 * await repo.create(recipeData, { syncStrategy: 'immediate' }); // Sync now
 * await repo.update(name, data, { syncStrategy: 'delayed' });   // Sync later
 * await repo.delete(name, { syncStrategy: 'manual' });         // Manual sync
 * 
 * // Manual sync control
 * const status = repo.getSyncStatus();
 * if (status.pendingCount > 0) {
 *   await repo.syncAll();
 * }
 * ```
 * 
 * @example Cache management
 * ```javascript
 * // Cache operations
 * const metadata = repo.getCacheMetadata();
 * repo.clearCacheEntry('oldRecipe');
 * repo.clearCache(); // Clear all
 * 
 * // Force refresh
 * const freshData = await repo.getAll({ forceRefresh: true });
 * ```
 * 
 * @example Error handling
 * ```javascript
 * repo.on('error', (errorInfo) => {
 *   console.error('Repository error:', errorInfo);
 *   showErrorToUser(errorInfo.error);
 * });
 * 
 * repo.on('syncFailed', (failures) => {
 *   console.warn('Sync failures:', failures);
 *   // Handle failed operations
 * });
 * ```
 */

// This file is for documentation only, no exports needed
export {};
