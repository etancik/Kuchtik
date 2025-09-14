import { generateFilenameFromRecipeName } from '../utils/recipeUtils.js';

/**
 * RecipeRepository - A comprehensive data layer for recipe management
 * 
 * Handles:
 * - Offline-first caching with intelligent synchronization
 * - Optimistic updates for immediate UI feedback
 * - Automatic retry logic with exponential backoff
 * - GitHub API integration with fallback strategies
 * - Event-driven notifications for UI updates
 * - Conflict resolution and data consistency
 */

/**
 * Repository state enums
 */
export const RepositoryState = {
  IDLE: 'idle',
  LOADING: 'loading', 
  SYNCING: 'syncing',
  ERROR: 'error'
};

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update', 
  DELETE: 'delete',
  READ: 'read'
};

export const SyncStrategy = {
  IMMEDIATE: 'immediate',    // Sync immediately after operation
  DELAYED: 'delayed',        // Sync after delay (for better UX)
  BATCH: 'batch',           // Batch multiple operations
  MANUAL: 'manual'          // Only sync when explicitly requested
};

/**
 * Repository events for UI integration
 */
export const RepositoryEvents = {
  STATE_CHANGED: 'stateChanged',
  RECIPES_UPDATED: 'recipesUpdated', 
  RECIPE_CREATED: 'recipeCreated',
  RECIPE_UPDATED: 'recipeUpdated',
  RECIPE_DELETED: 'recipeDeleted',
  SYNC_STARTED: 'syncStarted',
  SYNC_COMPLETED: 'syncCompleted',
  SYNC_FAILED: 'syncFailed',
  CACHE_UPDATED: 'cacheUpdated',
  ERROR: 'error'
};

/**
 * Main RecipeRepository class
 */
class RecipeRepository {
  constructor(options = {}) {
    // Configuration
    this.config = {
      cacheTimeout: options.cacheTimeout || 5 * 60 * 1000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000, // 1 second base delay
      syncStrategy: options.syncStrategy || SyncStrategy.DELAYED,
      optimisticUpdates: options.optimisticUpdates !== false, // Default true
      enableLogging: options.enableLogging !== false, // Default true
      ...options
    };

    // Internal state
    this.state = RepositoryState.IDLE;
    this.cache = new Map();
    this.pendingOperations = new Map();
    this.eventListeners = new Map();
    this.retryQueues = new Map();
    this.activeTimeouts = new Set(); // Track active timeouts for cleanup
    
    // Initialize GitHub API integration
    this.githubAPI = null; // Will be injected
    
    this.log('🏗️ RecipeRepository initialized', this.config);
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Subscribe to repository events
   * @param {string} event - Event name from RepositoryEvents
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from repository events
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  /**
   * Emit repository event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    this.log(`📡 Emitting event: ${event}`, data);
    
    if (this.eventListeners.has(event)) {
      for (const callback of this.eventListeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          this.log(`❌ Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // CORE CRUD OPERATIONS
  // ============================================================================

  /**
   * Get all recipes with intelligent caching
   * @param {Object} options - Options for the operation
   * @param {boolean} options.forceRefresh - Skip cache and force fresh load
   * @param {boolean} options.includeMetadata - Include cache metadata in response
   * @returns {Promise<Array>} Array of recipe objects
   */
  async getAll(options = {}) {
    const { forceRefresh = false, includeMetadata = false } = options;
    
    this.setState(RepositoryState.LOADING);
    
    try {
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        const cached = this.getCachedRecipes();
        if (cached.length > 0) {
          this.log('💾 Returning cached recipes', { count: cached.length });
          this.setState(RepositoryState.IDLE);
          
          const result = includeMetadata ? {
            recipes: cached,
            metadata: this.getCacheMetadata()
          } : cached;
          
          return result;
        }
      }

      // Load fresh data
      const recipes = await this.loadFromSource();
      this.updateCache(recipes);
      this.setState(RepositoryState.IDLE);
      
      this.emit(RepositoryEvents.RECIPES_UPDATED, recipes);
      
      const result = includeMetadata ? {
        recipes,
        metadata: this.getCacheMetadata()
      } : recipes;
      
      return result;
      
    } catch (error) {
      this.handleError('getAll', error);
      throw error;
    }
  }

  /**
   * Get a single recipe by name
   * @param {string} recipeName - Name of the recipe
   * @param {Object} options - Options for the operation
   * @returns {Promise<Object|null>} Recipe object or null if not found
   */
  async getByName(recipeName, options = {}) {
    const { forceRefresh = false } = options;
    
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = this.getCachedRecipe(recipeName);
        if (cached) {
          this.log(`💾 Returning cached recipe: ${recipeName}`);
          return cached;
        }
      }

      // Load from source - convert recipe name to filename
      const filename = this.getFilenameFromRecipeName(recipeName);
      const recipe = await this.loadRecipeFromSource(filename);
      if (recipe) {
        // Use normalized cache key for consistent storage
        const cacheKey = this.normalizeCacheKey(filename);
        this.setCachedRecipe(cacheKey, recipe);
      }
      
      return recipe;
      
    } catch (error) {
      this.handleError('getByName', error, { recipeName });
      throw error;
    }
  }

  /**
   * Create a new recipe with optimistic updates
   * @param {Object} recipeData - Recipe data to create
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Created recipe object
   */
  async create(recipeData, options = {}) {
    const { syncStrategy = this.config.syncStrategy, optimistic = this.config.optimisticUpdates } = options;
    const recipeName = recipeData.name;
    
    this.log(`➕ Creating recipe: ${recipeName}`, { optimistic, syncStrategy });
    
    try {
      // Optimistic update - use consistent cache key normalization
      if (optimistic) {
        const filename = generateFilenameFromRecipeName(recipeData.name);
        const cacheKey = this.normalizeCacheKey(filename);
        this.setCachedRecipe(cacheKey, recipeData);
        this.emit(RepositoryEvents.RECIPE_CREATED, recipeData);
        this.emit(RepositoryEvents.RECIPES_UPDATED, this.getCachedRecipes());
      }

      // Schedule sync based on strategy
      const operationId = this.generateOperationId(OperationType.CREATE, recipeName);
      this.pendingOperations.set(operationId, {
        type: OperationType.CREATE,
        recipeName,
        data: recipeData,
        timestamp: Date.now(),
        attempts: 0
      });

      if (syncStrategy === SyncStrategy.IMMEDIATE) {
        await this.syncOperation(operationId);
      } else if (syncStrategy === SyncStrategy.DELAYED) {
        this.scheduleDelayedSync(operationId);
      }

      return recipeData;
      
    } catch (error) {
      // Revert optimistic update on immediate sync failure
      if (optimistic && syncStrategy === SyncStrategy.IMMEDIATE) {
        this.removeCachedRecipe(recipeName);
        this.emit(RepositoryEvents.RECIPES_UPDATED, this.getCachedRecipes());
      }
      this.handleError('create', error, { recipeName });
      throw error;
    }
  }

  /**
   * Update an existing recipe with optimistic updates
   * @param {string} recipeName - Name of the recipe to update
   * @param {Object} recipeData - Updated recipe data
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Updated recipe object
   */
  async update(recipeName, recipeData, options = {}) {
    const { syncStrategy = this.config.syncStrategy, optimistic = this.config.optimisticUpdates } = options;
    
    this.log(`✏️ Updating recipe: ${recipeName}`, { optimistic, syncStrategy });
    
    try {
      // Store original data for potential rollback
      const originalData = this.getCachedRecipe(recipeName);
      
      // Optimistic update - use filename-based cache key for consistency
      if (optimistic) {
        // Generate the correct cache key from recipe name
        const filename = generateFilenameFromRecipeName(recipeData.name);
        const newCacheKey = this.normalizeCacheKey(filename);
        
        // Batch cache operations to prevent intermediate state issues
        const oldCacheKey = this.normalizeCacheKey(recipeName);
        
        // Remove the old cache entry
        if (this.cache.has(oldCacheKey)) {
          this.cache.delete(oldCacheKey);
          this.log(`🗑️ Removed cached recipe: ${oldCacheKey}`);
        }
        
        // Add updated recipe at the front of cache (Maps maintain insertion order)
        const tempCache = new Map([[newCacheKey, { data: { ...recipeData }, timestamp: Date.now() }]]);
        for (const [key, value] of this.cache) {
          tempCache.set(key, value);
        }
        this.cache = tempCache;
        this.log(`💾 Cached recipe at top: ${newCacheKey}`);
        this.emit(RepositoryEvents.CACHE_UPDATED, { added: newCacheKey });
        
        this.emit(RepositoryEvents.RECIPE_UPDATED, recipeData);
        this.emit(RepositoryEvents.RECIPES_UPDATED, this.getCachedRecipes());
      }

      // Schedule sync
      const operationId = this.generateOperationId(OperationType.UPDATE, recipeName);
      this.pendingOperations.set(operationId, {
        type: OperationType.UPDATE,
        recipeName,
        data: recipeData,
        originalData,
        timestamp: Date.now(),
        attempts: 0
      });

      if (syncStrategy === SyncStrategy.IMMEDIATE) {
        try {
          await this.syncOperation(operationId);
        } catch (syncError) {
          // Revert optimistic update on immediate sync failure
          if (optimistic) {
            const rollbackCacheKey = this.normalizeCacheKey(recipeName);
            if (originalData) {
              this.setCachedRecipe(rollbackCacheKey, originalData);
            } else {
              this.removeCachedRecipe(recipeName);
            }
            this.emit(RepositoryEvents.RECIPES_UPDATED, this.getCachedRecipes());
          }
          throw syncError;
        }
      } else if (syncStrategy === SyncStrategy.DELAYED) {
        this.scheduleDelayedSync(operationId);
      }

      return recipeData;
      
    } catch (error) {
      this.handleError('update', error, { recipeName });
      throw error;
    }
  }

  /**
   * Delete a recipe with optimistic updates
   * @param {string} recipeName - Name of the recipe to delete
   * @param {Object} options - Operation options
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async delete(recipeName, options = {}) {
    const { syncStrategy = this.config.syncStrategy, optimistic = this.config.optimisticUpdates } = options;
    
    this.log(`🗑️ Deleting recipe: ${recipeName}`, { optimistic, syncStrategy });
    
    try {
      // Store original data for potential rollback
      const originalData = this.getCachedRecipe(recipeName);
      
      // Optimistic update
      if (optimistic) {
        this.removeCachedRecipe(recipeName);
        this.emit(RepositoryEvents.RECIPE_DELETED, { recipeName, data: originalData });
        this.emit(RepositoryEvents.RECIPES_UPDATED, this.getCachedRecipes());
      }

      // Schedule sync
      const operationId = this.generateOperationId(OperationType.DELETE, recipeName);
      this.pendingOperations.set(operationId, {
        type: OperationType.DELETE,
        recipeName,
        originalData,
        timestamp: Date.now(),
        attempts: 0
      });

      if (syncStrategy === SyncStrategy.IMMEDIATE) {
        try {
          await this.syncOperation(operationId);
        } catch (syncError) {
          // Revert optimistic update on immediate sync failure
          if (optimistic && originalData) {
            const rollbackCacheKey = this.normalizeCacheKey(recipeName);
            this.setCachedRecipe(rollbackCacheKey, originalData);
            this.emit(RepositoryEvents.RECIPES_UPDATED, this.getCachedRecipes());
          }
          throw syncError;
        }
      } else if (syncStrategy === SyncStrategy.DELAYED) {
        this.scheduleDelayedSync(operationId);
      }

      return true;
      
    } catch (error) {
      this.handleError('delete', error, { recipeName });
      throw error;
    }
  }

  // ============================================================================
  // SYNCHRONIZATION SYSTEM
  // ============================================================================

  /**
   * Manually trigger synchronization of all pending operations
   * @returns {Promise<void>}
   */
  async syncAll() {
    this.setState(RepositoryState.SYNCING);
    this.emit(RepositoryEvents.SYNC_STARTED, { operationCount: this.pendingOperations.size });
    
    try {
      const operations = Array.from(this.pendingOperations.entries());
      const results = await Promise.allSettled(
        operations.map(([id]) => this.syncOperation(id))
      );

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        this.log(`⚠️ Sync completed with ${failed.length} failures`, failed);
        this.emit(RepositoryEvents.SYNC_FAILED, { failures: failed });
        this.setState(RepositoryState.ERROR);
        // Throw error to indicate sync failure
        throw new Error(`${failed.length} operations failed to sync`);
      } else {
        this.log('✅ All operations synced successfully');
        this.emit(RepositoryEvents.SYNC_COMPLETED, { operationCount: operations.length });
        this.setState(RepositoryState.IDLE);
      }
      
    } catch (error) {
      this.handleError('syncAll', error);
      throw error;
    }
  }

  /**
   * Get synchronization status
   * @returns {Object} Sync status information
   */
  getSyncStatus() {
    const pending = Array.from(this.pendingOperations.entries()).map(([id, op]) => ({
      id,
      type: op.type,
      recipeName: op.recipeName,
      timestamp: op.timestamp,
      attempts: op.attempts,
      age: Date.now() - op.timestamp
    }));

    return {
      state: this.state,
      pendingCount: this.pendingOperations.size,
      pendingOperations: pending,
      cacheStatus: this.getCacheMetadata()
    };
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Clear all cached data
   */
  clearCache() {
    const count = this.cache.size;
    this.cache.clear();
    this.log(`🧹 Cache cleared (${count} entries removed)`);
    this.emit(RepositoryEvents.CACHE_UPDATED, { cleared: true });
  }

  /**
   * Clear specific recipe from cache
   * @param {string} recipeName - Name of recipe to remove from cache
   */
  clearCacheEntry(recipeName) {
    // Convert recipe name to normalized cache key
    const filename = generateFilenameFromRecipeName(recipeName);
    const cacheKey = this.normalizeCacheKey(filename);
    
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
      this.log(`🗑️ Removed ${cacheKey} from cache`);
      this.emit(RepositoryEvents.CACHE_UPDATED, { removed: recipeName });
    }
  }

  /**
   * Get cache statistics and metadata
   * @returns {Object} Cache metadata
   */
  getCacheMetadata() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([name, entry]) => ({
      name: name.replace(/\.json$/, ''), // Strip .json extension for display
      age: now - entry.timestamp,
      expired: now - entry.timestamp > this.config.cacheTimeout
    }));

    return {
      totalEntries: this.cache.size,
      validEntries: entries.filter(e => !e.expired).length,
      expiredEntries: entries.filter(e => e.expired).length,
      cacheTimeout: this.config.cacheTimeout,
      entries: entries.sort((a, b) => a.age - b.age)
    };
  }

  // ============================================================================
  // UTILITY AND HELPER METHODS
  // ============================================================================

  /**
   * Set GitHub API integration
   * @param {Object} githubAPI - GitHub API service instance
   */
  setGitHubAPI(githubAPI) {
    this.githubAPI = githubAPI;
    this.log('🔗 GitHub API integration configured');
  }

  /**
   * Get current repository state
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if repository is busy (loading or syncing)
   * @returns {boolean} True if busy
   */
  isBusy() {
    return this.state === RepositoryState.LOADING || this.state === RepositoryState.SYNCING;
  }

  /**
   * Clean up all resources (for testing and disposal)
   */
  cleanup() {
    // Clear all active timeouts
    for (const timeoutId of this.activeTimeouts) {
      globalThis.clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    
    // Clear pending operations
    this.pendingOperations.clear();
    
    // Clear cache
    this.cache.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    this.log('🧹 Repository cleaned up');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Set repository state and emit event
   * @private
   */
  setState(newState) {
    if (this.state !== newState) {
      const previousState = this.state;
      this.state = newState;
      this.log(`🔄 State changed: ${previousState} → ${newState}`);
      this.emit(RepositoryEvents.STATE_CHANGED, { previousState, currentState: newState });
    }
  }

  /**
   * Generate unique operation ID
   * @private
   */
  generateOperationId(type, recipeName) {
    return `${type}-${recipeName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle errors consistently
   * @private
   */
  handleError(operation, error, context = {}) {
    this.setState(RepositoryState.ERROR);
    const errorInfo = { operation, error: error.message, context, timestamp: Date.now() };
    this.log(`❌ Error in ${operation}:`, errorInfo);
    this.emit(RepositoryEvents.ERROR, errorInfo);
  }

  /**
   * Log messages (if logging enabled)
   * @private
   */
  log(message, data = null) {
    if (this.config.enableLogging) {
      if (data) {
        console.log(`[RecipeRepository] ${message}`, data);
      } else {
        console.log(`[RecipeRepository] ${message}`);
      }
    }
  }

  // ============================================================================
  // PRIVATE IMPLEMENTATION METHODS
  // ============================================================================

  /**
   * Load all recipes from source (GitHub API)
   * @private
   * @returns {Promise<Array>} Array of recipe objects
   */
  async loadFromSource() {
    if (!this.githubAPI) {
      throw new Error('GitHub API not configured');
    }

    const filenames = await this.githubAPI.getFileList();
    const recipes = [];

    for (const filename of filenames) {
      try {
        const recipe = await this.githubAPI.getFile(filename);
        if (recipe) {
          recipes.push(recipe);
        }
      } catch (error) {
        this.log(`⚠️ Failed to load recipe ${filename}:`, error.message);
        // Continue loading other recipes
      }
    }

    return recipes;
  }

  /**
   * Load single recipe from source (GitHub API)
   * @private
   * @param {string} recipeName - Recipe filename
   * @returns {Promise<Object|null>} Recipe object or null
   */
  async loadRecipeFromSource(recipeName) {
    if (!this.githubAPI) {
      throw new Error('GitHub API not configured');
    }

    try {
      const exists = await this.githubAPI.checkFileExists(recipeName);
      if (!exists) {
        return null;
      }
      return await this.githubAPI.getFile(recipeName);
    } catch (error) {
      this.log(`⚠️ Failed to load recipe ${recipeName}:`, error.message);
      return null;
    }
  }

  /**
   * Sync a specific operation with GitHub
   * @private
   * @param {string} operationId - Operation ID
   * @returns {Promise<void>}
   */
  async syncOperation(operationId) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    if (!this.githubAPI) {
      throw new Error('GitHub API not configured');
    }

    try {
      operation.attempts++;
      const filename = this.getFilenameFromRecipeName(operation.recipeName);

      switch (operation.type) {
        case OperationType.CREATE:
          await this.githubAPI.createFile(filename, operation.data);
          break;
        case OperationType.UPDATE:
          await this.githubAPI.updateFile(filename, operation.data);
          break;
        case OperationType.DELETE:
          await this.githubAPI.deleteFile(filename);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      // Operation succeeded, remove from pending
      this.pendingOperations.delete(operationId);
      this.log(`✅ Synced ${operation.type} operation for ${operation.recipeName}`);

    } catch (error) {
      this.log(`❌ Failed to sync ${operation.type} operation for ${operation.recipeName} (attempt ${operation.attempts}):`, error.message);
      operation.lastError = error;

      // Retry logic with exponential backoff
      if (operation.attempts < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, operation.attempts - 1);
        this.log(`🔄 Scheduling retry for ${operation.recipeName} in ${delay}ms`);
        const retryTimeoutId = globalThis.setTimeout(() => {
          this.activeTimeouts.delete(retryTimeoutId);
          this.syncOperation(operationId);
        }, delay);
        this.activeTimeouts.add(retryTimeoutId);
      } else {
        // Max retries reached, give up
        this.log(`💀 Max retries reached for ${operation.type} operation on ${operation.recipeName}`);
        this.pendingOperations.delete(operationId);
      }
      throw error;
    }
  }

  /**
   * Schedule delayed sync for an operation
   * @private
   * @param {string} operationId - Operation ID
   */
  scheduleDelayedSync(operationId) {
    const delay = this.config.retryDelay; // Use base delay for initial delayed sync
    
    this.log(`⏰ Scheduling delayed sync for operation ${operationId} in ${delay}ms`);
    
    const timeoutId = globalThis.setTimeout(async () => {
      // Remove from active timeouts when it starts executing
      this.activeTimeouts.delete(timeoutId);
      
      try {
        await this.syncOperation(operationId);
      } catch (syncError) {
        // Error already logged in syncOperation
        // The retry logic there will handle further attempts
        this.log(`⚠️ Delayed sync failed: ${syncError.message}`);
      }
    }, delay);

    // Track timeout for cleanup
    this.activeTimeouts.add(timeoutId);
  }

  /**
   * Get all cached recipes
   * @private
   * @returns {Array} Array of cached recipe objects
   */
  getCachedRecipes() {
    const now = Date.now();
    const validRecipes = [];

    for (const [recipeName, cacheEntry] of this.cache.entries()) {
      // Check if cache entry is still valid
      if (now - cacheEntry.timestamp <= this.config.cacheTimeout) {
        validRecipes.push(cacheEntry.data);
      } else {
        // Remove expired entry
        this.cache.delete(recipeName);
        this.log(`🗑️ Removed expired cache entry: ${recipeName}`);
      }
    }

    return validRecipes;
  }

  /**
   * Get single cached recipe
   * @private
   * @param {string} recipeName - Recipe name or filename
   * @returns {Object|null} Cached recipe or null
   */
  getCachedRecipe(recipeName) {
    const cacheKey = this.normalizeCacheKey(recipeName);
    const cacheEntry = this.cache.get(cacheKey);
    
    if (cacheEntry) {
      // Check if still valid
      const now = Date.now();
      if (now - cacheEntry.timestamp <= this.config.cacheTimeout) {
        return cacheEntry.data;
      } else {
        // Remove expired entry
        this.cache.delete(cacheKey);
        this.log(`🗑️ Removed expired cache entry: ${cacheKey}`);
      }
    }
    
    return null;
  }

  /**
   * Set cached recipe
   * @private
   * @param {string} cacheKey - Cache key (should be filename without .json)
   * @param {Object} data - Recipe data
   */
  setCachedRecipe(cacheKey, data) {
    const cacheEntry = {
      data: { ...data }, // Store a copy to prevent mutations
      timestamp: Date.now()
    };
    
    this.cache.set(cacheKey, cacheEntry);
    this.log(`💾 Cached recipe: ${cacheKey}`);
    this.emit(RepositoryEvents.CACHE_UPDATED, { added: cacheKey });
  }



  /**
   * Normalize recipe name to cache key
   * @private
   * @param {string} recipeName - Recipe name or filename
   * @returns {string} Normalized cache key
   */
  normalizeCacheKey(recipeName) {
    // If it's already a filename, just remove .json extension
    if (recipeName.endsWith('.json')) {
      return recipeName.replace('.json', '');
    }
    
    // If it's a recipe name, generate the filename first, then normalize
    const filename = generateFilenameFromRecipeName(recipeName);
    return filename.replace('.json', '');
  }

  /**
   * Remove cached recipe
   * @private
   * @param {string} recipeName - Recipe name or filename
   */
  removeCachedRecipe(recipeName) {
    const cacheKey = this.normalizeCacheKey(recipeName);
    
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
      this.log(`🗑️ Removed cached recipe: ${cacheKey}`);
      this.emit(RepositoryEvents.CACHE_UPDATED, { removed: recipeName });
    }
  }

  /**
   * Update cache with multiple recipes
   * @private
   * @param {Array} recipes - Array of recipe objects
   */
  updateCache(recipes) {
    let addedCount = 0;
    
    for (const recipe of recipes) {
      if (recipe && recipe.name) {
        // Use consistent cache key normalization
        const filename = generateFilenameFromRecipeName(recipe.name);
        const cacheKey = this.normalizeCacheKey(filename);
        this.setCachedRecipe(cacheKey, recipe);
        addedCount++;
      }
    }
    
    this.log(`💾 Updated cache with ${addedCount} recipes`);
  }

  /**
   * Convert recipe name to filename
   * @param {string} recipeName - Recipe name
   * @returns {string} Filename
   */
  getFilenameFromRecipeName(recipeName) {
    // If already has .json extension, use as-is
    if (recipeName.endsWith('.json')) {
      return recipeName;
    }
    
    // Use the proper filename generation that handles Czech diacritics correctly
    return generateFilenameFromRecipeName(recipeName);
  }
}

export default RecipeRepository;
