/**
 * Recipe UI component for managing recipe forms and interactions
 * Handles recipe creation, editing, and deletion workflows
 */

import { templateLoader } from '../utils/templateLoader.js';
import RecipeRepository from '../repositories/RecipeRepository.js';
import { t } from '../i18n/i18n.js';
import gitHubAPIAdapter from '../adapters/GitHubAPIAdapter.js';

class RecipeUI {
  constructor(repository = null) {
    this.isEditing = false;
    this.editingRecipe = null;
    this.modal = null;
    this.repository = repository; // Use provided repository if available
    this.draggedElement = null; // Track currently dragged element
  }

  /**
   * Initialize the recipe UI
   */
  async initialize() {
    console.log('🚀 Initializing RecipeUI with RecipeRepository...');
    try {
      // Only initialize repository if it doesn't already exist
      if (!this.repository) {
        // Initialize repository with GitHub adapter
        this.repository = new RecipeRepository({
          syncStrategy: 'immediate',
          cacheExpiry: 5 * 60 * 1000, // 5 minutes
          enableOptimisticUpdates: true,
          maxRetries: 3,
          retryDelay: 1000
        });

        // Set the GitHub API adapter
        this.repository.setGitHubAPI(gitHubAPIAdapter);

        // Set up event listeners for repository events
        this.setupRepositoryEventHandlers();
      }

      // Load and inject the modal template
      console.log('📄 Loading modal template...');
      const modalHtml = await templateLoader.loadTemplate('src/templates/recipe-modal.html');
      console.log('📄 Template loaded, length:', modalHtml?.length);
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      console.log('📄 Template injected into DOM');
      
      // Update translations for the modal
      this.updateModalTranslations();
      
      // Get modal instance - wait for Bootstrap to be available
      let retries = 0;
      const maxRetries = 10;
      
      console.log('🔍 Checking Bootstrap availability...');
      console.log('window.bootstrap:', window.bootstrap);
      console.log('window.bootstrap?.Modal:', window.bootstrap?.Modal);
      
      while ((!window.bootstrap || !window.bootstrap.Modal) && retries < maxRetries) {
        console.log(`⏳ Waiting for Bootstrap to load... (attempt ${retries + 1}/${maxRetries})`);
        console.log('Current state - bootstrap:', !!window.bootstrap, 'Modal:', !!window.bootstrap?.Modal);
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (!window.bootstrap || !window.bootstrap.Modal) {
        console.error('❌ Bootstrap availability check failed:', {
          bootstrap: !!window.bootstrap,
          modal: !!window.bootstrap?.Modal,
          bootstrapKeys: window.bootstrap ? Object.keys(window.bootstrap) : 'none'
        });
        throw new Error('Bootstrap Modal component is not available after waiting');
      }
      
      console.log('✅ Bootstrap Modal component is available');
      
      // Check if modal element exists
      const modalElement = document.getElementById('recipe-modal');
      console.log('🔍 Looking for modal element...');
      console.log('Modal element found:', !!modalElement);
      console.log('Modal element ID:', modalElement?.id);
      console.log('Modal element classes:', modalElement?.className);
      
      if (!modalElement) {
        console.error('❌ Modal element not found. Available elements with modal in ID:');
        const allModals = document.querySelectorAll('[id*="modal"]');
        allModals.forEach(el => console.log(' -', el.id, el.tagName));
        
        console.error('❌ Available IDs starting with "recipe":');
        const recipeElements = document.querySelectorAll('[id^="recipe"]');
        recipeElements.forEach(el => console.log(' -', el.id, el.tagName));
        
        throw new Error('Modal element #recipe-modal not found in DOM');
      }
      
      console.log('✅ Modal element found in DOM');
      
      // Try to create modal with explicit configuration to avoid undefined backdrop issue
      try {
        this.modal = new window.bootstrap.Modal(modalElement, {
          backdrop: true,
          keyboard: true,
          focus: true
        });
        console.log('✅ Modal instance created successfully with explicit config');
      } catch (error) {
        console.error('❌ Failed to create modal with explicit config:', error);
        // Fallback: try without options
        this.modal = new window.bootstrap.Modal(modalElement);
        console.log('✅ Modal instance created with default config');
      }
      
      // Setup form submission handler
      const form = document.getElementById('recipe-form');
      if (form) {
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
      }

      // Setup tag input handler
      const tagInput = document.getElementById('recipe-tags-input');
      if (tagInput) {
        tagInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.addTag();
          }
        });
      }

      // Setup edit button handlers
      this.setupEditHandlers();
      
      console.log('✅ RecipeUI initialized successfully with RecipeRepository');
    } catch (error) {
      console.error('❌ Failed to initialize RecipeUI:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for repository events
   */
  setupRepositoryEventHandlers() {
    // Listen for optimistic updates
    this.repository.on('optimisticUpdate', (event) => {
      console.log('⚡ Optimistic update:', event);
      this.handleOptimisticUpdate(event);
    });

    // Listen for successful operations
    this.repository.on('operationSuccess', (event) => {
      console.log('✅ Operation success:', event);
      this.handleOperationSuccess(event);
    });

    // Listen for operation failures
    this.repository.on('operationFailure', (event) => {
      console.log('❌ Operation failure:', event);
      this.handleOperationFailure(event);
    });

    // Listen for rollbacks
    this.repository.on('rollback', (event) => {
      console.log('↩️ Rollback occurred:', event);
      this.handleRollback(event);
    });

    // Add debounce timeout to prevent concurrent refresh calls
    this.refreshTimeout = null;

    // Listen for cache updates
    this.repository.on('cacheUpdated', (event) => {
      console.log('🔄 Cache updated:', event);
      this.debouncedRefresh();
    });

    // Listen for recipes updates (when the full recipe list changes)
    this.repository.on('recipesUpdated', (recipes) => {
      console.log('📝 Recipes updated, refreshing display with', recipes.length, 'recipes');
      this.debouncedRefresh();
    });

    // Listen for sync status changes
    this.repository.on('syncStatusChange', (event) => {
      console.log('🔄 Sync status change:', event);
      this.handleSyncStatusChange(event);
    });
  }

  /**
   * Handle optimistic updates
   * @param {Object} event - Event data
   */
  handleOptimisticUpdate(event) {
    const { operation, recipeId, recipe } = event;
    
    switch (operation) {
      case 'create':
        this.showSuccessMessage(t('operations.creating', { recipeName: recipe.name }));
        break;
      case 'update':
        this.showSuccessMessage(t('operations.updating', { recipeName: recipe.name }));
        break;
      case 'delete':
        this.showSuccessMessage(t('operations.deleting', { recipeId }));
        break;
    }

    // Trigger UI refresh
    this.refreshRecipesDisplay();
  }

  /**
   * Handle operation success
   * @param {Object} event - Event data
   */
  handleOperationSuccess(event) {
    const { operation } = event;
    
    let message;
    switch (operation) {
      case 'create':
        message = t('operations.createSuccess');
        break;
      case 'update':
        message = t('operations.updateSuccess');
        break;
      case 'delete':
        message = t('operations.deleteSuccess');
        break;
      default:
        message = t('operations.operationSuccess');
    }
    
    this.showSuccessMessage(message);
  }

  /**
   * Handle operation failures
   * @param {Object} event - Event data
   */
  handleOperationFailure(event) {
    const { operation, error } = event;
    
    let message;
    switch (operation) {
      case 'create':
        message = t('operations.createFailed', { error: error.message });
        break;
      case 'update':
        message = t('operations.updateFailed', { error: error.message });
        break;
      case 'delete':
        message = t('operations.deleteFailed', { error: error.message });
        break;
      default:
        message = t('operations.operationFailed', { error: error.message });
    }
    
    this.showErrorMessage(message);
  }

  /**
   * Handle rollbacks
   * @param {Object} event - Event data
   */
  handleRollback(event) {
    const { operation, recipeId, error } = event;
    this.showWarningMessage(t('operations.rollbackMessage', { operation, recipeId, error: error.message }));
    this.refreshRecipesDisplay();
  }

  /**
   * Handle cache updates
   */
  handleCacheUpdate() {
    // Refresh the display when cache is updated
    this.refreshRecipesDisplay();
  }

  /**
   * Debounced refresh to prevent concurrent refresh calls
   */
  debouncedRefresh() {
    // Clear existing timeout
    if (this.refreshTimeout) {
      globalThis.clearTimeout(this.refreshTimeout);
    }
    
    // Set new timeout
    this.refreshTimeout = globalThis.setTimeout(() => {
      this.refreshRecipesDisplay();
      this.refreshTimeout = null;
    }, 10); // Small delay to batch multiple rapid events
  }

  /**
   * Handle sync status changes
   * @param {Object} event - Event data
   */
  handleSyncStatusChange(event) {
    const { status } = event;
    // Could show sync status in UI (e.g., spinning indicator)
    console.log('Sync status:', status);
  }

  /**
   * Setup edit and delete button event handlers
   */
  setupEditHandlers() {
    // Handle edit button clicks
    document.addEventListener('click', (event) => {
      if (event.target.matches('.edit-recipe-btn') || event.target.closest('.edit-recipe-btn')) {
        const button = event.target.matches('.edit-recipe-btn') ? event.target : event.target.closest('.edit-recipe-btn');
        const recipeData = JSON.parse(button.getAttribute('data-recipe'));
        
        this.showEditForm(recipeData);
        event.stopPropagation(); // Prevent card collapse toggle
      }
    });
  }

  /**
   * Show create form
   */
  showCreateForm() {
    console.log('📝 Showing create form...');
    this.isEditing = false;
    this.editingRecipe = null;
    
    // Update modal title and button
    document.getElementById('recipe-modal-title').innerHTML = 
      `<i class="fas fa-utensils me-2"></i><span data-i18n="recipeForm.createNewRecipe">${t('recipeForm.createNewRecipe')}</span>`;
    document.getElementById('recipe-submit-btn').innerHTML = 
      `<i class="fas fa-save me-2"></i><span data-i18n="recipeForm.createRecipeBtn">${t('recipeForm.createRecipeBtn')}</span>`;
    
    // Clear form
    this.clearForm();
    
    // Show modal
    this.modal.show();
    
    // Initialize drag and drop for steps
    this.initializeStepDragAndDrop();
    
    // Update modal translations
    this.updateModalTranslations();
    
    // Load tag suggestions
    this.loadTagSuggestions();
  }

  /**
   * Show edit form with recipe data
   * @param {Object} recipe - Recipe data to edit
   */
  showEditForm(recipe) {
    console.log('✏️ Showing edit form for:', recipe.name);
    this.isEditing = true;
    this.editingRecipe = recipe;
    
    // Update modal title and button
    document.getElementById('recipe-modal-title').innerHTML = 
      `<i class="fas fa-edit me-2"></i><span data-i18n="recipeForm.editRecipeTitle">${t('recipeForm.editRecipeTitle')}</span>`;
    document.getElementById('recipe-submit-btn').innerHTML = 
      `<i class="fas fa-save me-2"></i><span data-i18n="recipeForm.updateRecipeBtn">${t('recipeForm.updateRecipeBtn')}</span>`;
    
    // Populate form with recipe data
    this.populateForm(recipe);
    
    // Show modal
    this.modal.show();
    
    // Initialize drag and drop for steps
    this.initializeStepDragAndDrop();
    
    // Update modal translations
    this.updateModalTranslations();
    
    // Load tag suggestions
    this.loadTagSuggestions();
  }

  /**
   * Show delete confirmation dialog
   * @param {string} recipeId - ID of the recipe to delete
   * @param {string} recipeName - Name of the recipe to delete
   */
  async showDeleteConfirmation(recipeId, recipeName) {
    console.log('🗑️ Showing delete confirmation for:', recipeName);
    
    const confirmed = confirm(t('confirmations.deleteRecipeMessage', { recipeName }));
    
    if (confirmed) {
      await this.handleDeleteRecipe(recipeId);
    }
  }

  /**
   * Handle recipe deletion
   * @param {string} recipeId - ID of the recipe to delete
   */
  async handleDeleteRecipe(recipeId) {
    try {
      console.log('🗑️ Deleting recipe:', recipeId);
      
      // Delete the recipe using repository (optimistic updates handled automatically)
      await this.repository.delete(recipeId);
      
    } catch (error) {
      console.error('❌ Failed to delete recipe:', error);
      this.showErrorMessage(t('operations.deleteFailed', { error: error.message }));
    }
  }

  /**
   * Handle form submission
   * @param {Event} e - Form submit event
   */
  async handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('recipe-submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>${t('recipeForm.processing')}`;
      
      const formData = this.collectFormData();
      
      if (this.isEditing) {
        console.log('🔄 Updating existing recipe...');
        console.log('📝 Original recipe ID:', this.editingRecipe.metadata?.id || this.editingRecipe.id);
        console.log('📄 Updated data:', formData);
        
        // Update the recipe using the original recipe ID, not the current name
        const recipeId = this.editingRecipe.metadata?.id || this.editingRecipe.id;
        await this.repository.update(recipeId, formData);
        
        // Close modal
        this.modal.hide();
        
      } else {
        console.log(t('operations.creating'));
        console.log('📄 Recipe data:', formData);
        
        // Create the recipe using repository (optimistic updates handled automatically)
        await this.repository.create(formData);
        
        // Close modal
        this.modal.hide();
      }
      
    } catch (error) {
      console.error('❌ Failed to process recipe:', error);
      this.showErrorMessage(t(this.isEditing ? 'operations.updateFailed' : 'operations.createFailed', { error: error.message }));
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }

  /**
   * Collect form data
   * @returns {Object} Recipe data
   */
  collectFormData() {
    const ingredientElements = document.querySelectorAll('.ingredient-input');
    const ingredients = Array.from(ingredientElements)
      .map((input, index) => {
        const text = input.value.trim();
        if (text === '') return null;
        
        return {
          text: text,
          exportDefault: this.getIngredientExportDefault(index, text)
        };
      })
      .filter(ingredient => ingredient !== null);

    const instructionElements = document.querySelectorAll('.instruction-input');
    const instructions = Array.from(instructionElements)
      .map(input => input.value.trim())
      .filter(value => value !== '');

    const noteElements = document.querySelectorAll('.note-input');
    const notes = Array.from(noteElements)
      .map(input => input.value.trim())
      .filter(value => value !== '');

    const name = document.getElementById('recipe-name').value.trim();
    const cookingTime = document.getElementById('recipe-time').value.trim();
    const servings = parseInt(document.getElementById('recipe-servings').value) || 4;
    const tagsInput = document.getElementById('recipe-tags').value;
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

    // Build recipe data - preserve metadata when editing
    let recipeData = {
      name,
      ingredients,
      instructions,
      cookingTime,
      servings,
      notes,
      tags
    };

    // Preserve existing metadata when editing
    if (this.isEditing && this.editingRecipe) {
      // Ensure metadata object exists
      if (!recipeData.metadata) {
        recipeData.metadata = {};
      }
      
      // Preserve essential fields from metadata or fallback to root level (backward compatibility)
      if (this.editingRecipe.metadata?.id || this.editingRecipe.id) {
        recipeData.metadata.id = this.editingRecipe.metadata?.id || this.editingRecipe.id;
      }
      if (this.editingRecipe.metadata?.sha || this.editingRecipe.sha) {
        recipeData.metadata.sha = this.editingRecipe.metadata?.sha || this.editingRecipe.sha;
      }
      
      // Always update lastModified for edits
      recipeData.metadata.lastModified = new Date().toISOString();
      
      // Preserve existing metadata fields
      if (this.editingRecipe.metadata) {
        recipeData.metadata = {
          ...this.editingRecipe.metadata,
          ...recipeData.metadata, // Keep any updates we made above
          lastModified: new Date().toISOString()
        };
      }
    } else if (!this.isEditing && this.repository.githubAPI.isAuthenticated()) {
      // Add metadata for new recipes only
      const userInfo = this.repository.githubAPI.getCurrentUser();
      recipeData.metadata = {
        createdDate: new Date().toISOString(),
        author: userInfo?.login || 'Anonymous',
        lastModified: new Date().toISOString()
      };
    }

    return recipeData;
  }

  /**
   * Load and display all recipes using repository
   * @returns {Promise<Array>} Array of recipes
   */
  async loadAllRecipes() {
    try {
      console.log('🔄 Loading all recipes from repository...');
      const recipes = await this.repository.getAll();
      console.log(`✅ Loaded ${recipes.length} recipes from repository`);
      return recipes;
    } catch (error) {
      console.error('❌ Failed to load recipes:', error);
      throw error;
    }
  }

  /**
   * Refresh the recipes display
   */
  async refreshRecipesDisplay() {
    try {
      const recipes = await this.loadAllRecipes();
      
      // Assuming there's a global function to render recipes
      if (window.renderRecipes) {
        window.renderRecipes(recipes);
      }
    } catch (error) {
      console.error('❌ Failed to refresh recipes display:', error);
    }
  }

  /**
   * Get repository cache status
   * @returns {Object} Cache status information
   */
  getCacheStatus() {
    return this.repository.getCacheMetadata();
  }

  /**
   * Clear repository cache
   */
  clearCache() {
    this.repository.clearCache();
    console.log('🗑️ Repository cache cleared');
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccessMessage(message = t('operations.operationSuccess')) {
    // Implementation depends on your UI framework
    // This could be a toast, alert, or custom notification
    console.log('✅', message);
    
    // Simple alert for now - replace with better UI component
    if (window.showToast) {
      window.showToast(message, 'success');
    } else {
      // Fallback to browser alert
      setTimeout(() => alert(message), 100);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showErrorMessage(message) {
    console.error('❌', message);
    
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Show warning message
   * @param {string} message - Warning message
   */
  showWarningMessage(message) {
    console.warn('⚠️', message);
    
    if (window.showToast) {
      window.showToast(message, 'warning');
    } else {
      alert(message);
    }
  }

  // Form manipulation methods (keeping existing functionality)
  clearForm() {
    // Clear basic fields
    document.getElementById('recipe-name').value = '';
    document.getElementById('recipe-servings').value = '4';
    document.getElementById('recipe-time').value = '';
    
    // Clear tags
    this.setTags('');
    document.getElementById('recipe-tags-input').value = '';
    
        // Clear dynamic lists
    this.resetContainer('ingredients-container', 'ingredient-input', t('recipeForm.ingredientPlaceholder'), 'input');
    this.resetContainer('instructions-container', 'instruction-input', t('recipeForm.instructionPlaceholder'), 'textarea');
    this.resetContainer('notes-container', 'note-input', t('recipeForm.notePlaceholder'), 'input');
    
    // Setup auto-resize for the default instruction textarea
    setTimeout(() => this.setupAllAutoResize(), 0);
  }

  populateForm(recipe) {
    // Populate basic fields
    document.getElementById('recipe-name').value = recipe.name || '';
    document.getElementById('recipe-servings').value = recipe.servings || '4';
    document.getElementById('recipe-time').value = recipe.cookingTime || '';
    
    // Populate tags using the new tag UI
    this.setTags((recipe.tags || []).join(', '));
    
    // Populate ingredients
    this.populateContainer('ingredients-container', recipe.ingredients || [], 'ingredient-input', t('recipeForm.ingredientPlaceholder'), 'input');
    
    // Populate instructions
    this.populateContainer('instructions-container', recipe.instructions || [], 'instruction-input', t('recipeForm.instructionPlaceholder'), 'textarea');
    
    // Populate notes
    this.populateContainer('notes-container', recipe.notes || [], 'note-input', t('recipeForm.notePlaceholder'), 'input');
    
    // Setup auto-resize for all instruction textareas
    setTimeout(() => {
      this.setupAllAutoResize();
      // Initialize drag and drop for loaded steps
      this.initializeStepDragAndDrop();
    }, 0);
  }

  resetContainer(containerId, inputClass, placeholder, inputType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (containerId === 'instructions-container') {
      // Use new step structure for instructions
      const div = document.createElement('div');
      div.className = 'step-item';
      div.draggable = true;
      div.innerHTML = `
        <div class="input-group mb-2">
          <span class="input-group-text">1.</span>
          <div class="step-drag-handle" title="Hold and drag to reorder">
            <i class="fas fa-grip-lines text-muted"></i>
          </div>
          <textarea class="form-control instruction-input" 
                    placeholder="${t('recipeForm.instructionPlaceholder')}" 
                    data-i18n-placeholder="recipeForm.instructionPlaceholder"
                    rows="2" required></textarea>
          <button class="btn remove-btn-small" type="button" onclick="recipeUI.removeInstruction(this)" title="Remove step">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      container.appendChild(div);
      this.setupStepDragAndDrop(div);
    } else {
      const div = document.createElement('div');
      div.className = 'input-group mb-2';
      div.innerHTML = `
        <${inputType} class="form-control ${inputClass}" placeholder="${placeholder}" ${containerId === 'ingredients-container' ? 'required' : ''}></${inputType}>
        <button class="btn btn-sm remove-btn" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)" title="Remove ${containerId === 'ingredients-container' ? 'ingredient' : 'note'}">
          <i class="fas fa-times"></i>
        </button>
      `;
      container.appendChild(div);
    }
  }

  populateContainer(containerId, data, inputClass, placeholder, inputType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (data.length === 0) {
      this.resetContainer(containerId, inputClass, placeholder, inputType);
      return;
    }
    
    data.forEach((item, index) => {
      if (containerId === 'instructions-container') {
        // Use new step structure for instructions
        const div = document.createElement('div');
        div.className = 'step-item';
        div.draggable = true;
        div.innerHTML = `
          <div class="input-group mb-2">
            <span class="input-group-text">${index + 1}.</span>
            <div class="step-drag-handle" title="Hold and drag to reorder">
              <i class="fas fa-grip-lines text-muted"></i>
            </div>
            <textarea class="form-control instruction-input" 
                      placeholder="${t('recipeForm.instructionPlaceholder')}" 
                      data-i18n-placeholder="recipeForm.instructionPlaceholder"
                      rows="2" required>${item}</textarea>
            <button class="btn remove-btn-small" type="button" onclick="recipeUI.removeInstruction(this)" title="Remove step">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
        container.appendChild(div);
        this.setupStepDragAndDrop(div);
      } else {
        // Handle other containers (ingredients, notes) with old structure
        const div = document.createElement('div');
        div.className = 'input-group mb-2';
        
        // Handle ingredient objects vs strings
        const displayValue = (containerId === 'ingredients-container' && typeof item === 'object' && item.text) 
          ? item.text 
          : item;
        
        div.innerHTML = `
          <${inputType} class="form-control ${inputClass}" value="${displayValue}" ${containerId === 'ingredients-container' ? 'required' : ''}></${inputType}>
          <button class="btn btn-sm remove-btn" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)" title="Remove ${this.getMethodSuffix(containerId).toLowerCase()}">
            <i class="fas fa-times"></i>
          </button>
        `;
        
        container.appendChild(div);
      }
    });
  }

  getMethodSuffix(containerId) {
    const map = {
      'ingredients-container': 'Ingredient',
      'instructions-container': 'Instruction',
      'notes-container': 'Note'
    };
    return map[containerId] || '';
  }

  // Dynamic input management methods (keeping existing functionality)
  addIngredient() {
    const container = document.getElementById('ingredients-container');
    const ingredientDiv = document.createElement('div');
    ingredientDiv.className = 'input-group mb-2';
    ingredientDiv.innerHTML = `
      <input type="text" class="form-control ingredient-input" placeholder="${t('recipeForm.ingredientPlaceholder')}" required>
      <button class="btn btn-sm remove-btn" type="button" onclick="recipeUI.removeIngredient(this)" title="Remove ingredient">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(ingredientDiv);
    ingredientDiv.querySelector('input').focus();
  }

  removeIngredient(button) {
    const container = document.getElementById('ingredients-container');
    if (container.children.length > 1) {
      button.parentElement.remove();
    }
  }

  addInstruction() {
    const container = document.getElementById('instructions-container');
    const stepNumber = container.children.length + 1;
    const instructionDiv = document.createElement('div');
    instructionDiv.className = 'step-item';
    instructionDiv.draggable = true;
    instructionDiv.innerHTML = `
      <div class="input-group mb-2">
        <span class="input-group-text">${stepNumber}.</span>
        <div class="step-drag-handle" title="Hold and drag to reorder">
          <i class="fas fa-grip-lines text-muted"></i>
        </div>
        <textarea class="form-control instruction-input" 
                  placeholder="${t('recipeForm.instructionPlaceholder')}" 
                  data-i18n-placeholder="recipeForm.instructionPlaceholder"
                  rows="2" required></textarea>
        <button class="btn remove-btn-small" type="button" onclick="recipeUI.removeInstruction(this)" title="Remove step">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    container.appendChild(instructionDiv);
    const textarea = instructionDiv.querySelector('textarea');
    this.setupAutoResize(textarea);
    textarea.focus();
    this.setupStepDragAndDrop(instructionDiv);
    this.updateStepNumbers();
  }

  removeInstruction(button) {
    const container = document.getElementById('instructions-container');
    if (container.children.length > 1) {
      button.closest('.step-item').remove();
      this.updateStepNumbers();
    }
  }

  addNote() {
    const container = document.getElementById('notes-container');
    const noteDiv = document.createElement('div');
    noteDiv.className = 'input-group mb-2';
    noteDiv.innerHTML = `
      <input type="text" class="form-control note-input" placeholder="${t('recipeForm.notePlaceholder')}">
      <button class="btn btn-sm remove-btn" type="button" onclick="recipeUI.removeNote(this)" title="Remove note">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(noteDiv);
    noteDiv.querySelector('input').focus();
  }

  removeNote(button) {
    const container = document.getElementById('notes-container');
    if (container.children.length > 0) {
      button.parentElement.remove();
    }
  }

  /**
   * Determine the default export value for an ingredient
   * @returns {boolean} - Default export value (currently true for all ingredients)
   */
  getDefaultExportValue() {
    // For now, default all ingredients to be exported
    // This could be enhanced in the future with smart detection
    return true;
  }

  /**
   * Get the exportDefault value for an ingredient, preserving original values when editing
   * @param {number} index - The index of the ingredient in the form
   * @param {string} text - The ingredient text
   * @returns {boolean} The exportDefault value
   */
  getIngredientExportDefault(index, text) {
    // When editing, try to preserve original exportDefault values
    if (this.isEditing && this.editingRecipe && this.editingRecipe.ingredients) {
      // Try to match by index first
      if (index < this.editingRecipe.ingredients.length) {
        const originalIngredient = this.editingRecipe.ingredients[index];
        // If the text matches or is close, preserve the exportDefault
        if (originalIngredient.text === text || originalIngredient.text.toLowerCase().includes(text.toLowerCase()) || text.toLowerCase().includes(originalIngredient.text.toLowerCase())) {
          return originalIngredient.exportDefault;
        }
      }
      
      // Try to find a matching ingredient by text
      const matchingIngredient = this.editingRecipe.ingredients.find(ing => 
        ing.text === text || 
        ing.text.toLowerCase().includes(text.toLowerCase()) || 
        text.toLowerCase().includes(ing.text.toLowerCase())
      );
      
      if (matchingIngredient) {
        return matchingIngredient.exportDefault;
      }
    }
    
    // For new ingredients or when not editing, use default logic
    return this.getDefaultExportValue();
  }

  /**
   * Setup auto-resize functionality for textarea elements
   * @param {HTMLTextAreaElement} textarea - The textarea element to setup
   */
  setupAutoResize(textarea) {
    // Auto-resize function
    const autoResize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(38, textarea.scrollHeight) + 'px';
    };

    // Setup event listeners
    textarea.addEventListener('input', autoResize);
    textarea.addEventListener('paste', () => setTimeout(autoResize, 0));
    
    // Initial resize
    setTimeout(autoResize, 0);
  }

  /**
   * Setup auto-resize for all existing instruction textareas
   */
  setupAllAutoResize() {
    document.querySelectorAll('.instruction-input').forEach(textarea => {
      this.setupAutoResize(textarea);
    });
  }

  /**
   * Update modal translations after modal is loaded
   */
  updateModalTranslations() {
    // Update all elements with data-i18n attributes in the modal
    const modal = document.getElementById('recipe-modal');
    if (modal) {
      modal.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key);
      });

      // Update placeholders
      modal.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
      });
    }
  }

  /**
   * Add a tag to the tags container
   */
  addTag() {
    const input = document.getElementById('recipe-tags-input');
    const container = document.getElementById('tags-container');
    const hiddenInput = document.getElementById('recipe-tags');
    
    if (!input || !container || !hiddenInput) return;
    
    const tagText = input.value.trim();
    if (!tagText) return;
    
    // Check if tag already exists
    const existingTags = this.getTags();
    if (existingTags.includes(tagText.toLowerCase())) {
      input.value = '';
      return;
    }
    
    // Create tag element
    const tagElement = document.createElement('span');
    tagElement.className = 'tag-item';
    tagElement.innerHTML = `
      <span>${tagText}</span>
      <button type="button" class="tag-remove" onclick="recipeUI.removeTag(this)" title="Remove tag">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    container.appendChild(tagElement);
    
    // Show container if it has tags
    this.updateTagsVisibility();
    
    // Update hidden input
    this.updateTagsInput();
    
    // Clear input
    input.value = '';
  }

  /**
   * Remove a tag from the tags container
   */
  removeTag(button) {
    const tagElement = button.closest('.tag-item');
    if (tagElement) {
      tagElement.remove();
      this.updateTagsInput();
      // Update visibility after removing tag
      this.updateTagsVisibility();
    }
  }

  /**
   * Get current tags as array
   */
  getTags() {
    const container = document.getElementById('tags-container');
    if (!container) return [];
    
    const tags = [];
    container.querySelectorAll('.tag-item span:first-child').forEach(span => {
      tags.push(span.textContent.toLowerCase());
    });
    return tags;
  }

  /**
   * Update hidden tags input with current tags
   */
  updateTagsInput() {
    const container = document.getElementById('tags-container');
    const hiddenInput = document.getElementById('recipe-tags');
    if (!container || !hiddenInput) return;
    
    const tags = [];
    container.querySelectorAll('.tag-item span:first-child').forEach(span => {
      tags.push(span.textContent);
    });
    
    hiddenInput.value = tags.join(', ');
  }

  /**
   * Update tags container visibility based on whether it has tags
   */
  updateTagsVisibility() {
    const container = document.getElementById('tags-container');
    if (!container) return;
    
    const hasTags = container.querySelectorAll('.tag-item').length > 0;
    if (hasTags) {
      container.classList.add('has-tags');
    } else {
      container.classList.remove('has-tags');
    }
  }

  /**
   * Load tag suggestions from existing recipes
   */
  async loadTagSuggestions() {
    try {
      const recipes = await this.repository.getAll();
      const allTags = new Set();
      
      // Collect all tags from all recipes
      recipes.forEach(recipe => {
        if (recipe.tags && Array.isArray(recipe.tags)) {
          recipe.tags.forEach(tag => {
            if (tag && typeof tag === 'string') {
              allTags.add(tag.trim().toLowerCase());
            }
          });
        }
      });
      
      // Update datalist with unique tags
      const datalist = document.getElementById('tags-datalist');
      if (datalist) {
        datalist.innerHTML = '';
        [...allTags].sort().forEach(tag => {
          const option = document.createElement('option');
          option.value = tag;
          datalist.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load tag suggestions:', error);
    }
  }

  /**
   * Set tags from string (comma-separated)
   */
  setTags(tagsString) {
    const container = document.getElementById('tags-container');
    if (!container) return;
    
    // Clear existing tags
    container.innerHTML = '';
    
    if (!tagsString) {
      this.updateTagsVisibility();
      return;
    }
    
    // Add each tag
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    tags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag-item';
      tagElement.innerHTML = `
        <span>${tag}</span>
        <button type="button" class="tag-remove" onclick="recipeUI.removeTag(this)" title="Remove tag">
          <i class="fas fa-times"></i>
        </button>
      `;
      container.appendChild(tagElement);
    });
    
    this.updateTagsInput();
    this.updateTagsVisibility();
  }

  /**
   * Set up drag and drop functionality for a step item
   */
  setupStepDragAndDrop(stepItem) {
    stepItem.addEventListener('dragstart', (e) => {
      console.log('Drag start:', stepItem);
      this.draggedElement = stepItem;
      stepItem.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    stepItem.addEventListener('dragend', () => {
      console.log('Drag end');
      stepItem.classList.remove('dragging');
      this.draggedElement = null;
      // Clean up all drop indicators
      const allSteps = document.querySelectorAll('.step-item');
      allSteps.forEach(step => {
        step.classList.remove('drag-over', 'drop-above', 'drop-below');
      });
    });
    
    stepItem.addEventListener('dragover', (e) => {
      if (!this.draggedElement || this.draggedElement === stepItem) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    
    stepItem.addEventListener('dragenter', (e) => {
      if (!this.draggedElement || this.draggedElement === stepItem) return;
      e.preventDefault();
      stepItem.classList.add('drag-over');
    });
    
    stepItem.addEventListener('dragleave', (e) => {
      if (!stepItem.contains(e.relatedTarget)) {
        stepItem.classList.remove('drag-over');
      }
    });
    
    stepItem.addEventListener('drop', (e) => {
      if (!this.draggedElement || this.draggedElement === stepItem) return;
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Drop on:', stepItem, 'dragged:', this.draggedElement);
      
      stepItem.classList.remove('drag-over');
      
      const container = document.getElementById('instructions-container');
      const rect = stepItem.getBoundingClientRect();
      const mouseY = e.clientY;
      const centerY = rect.top + rect.height / 2;
      
      console.log('Mouse Y:', mouseY, 'Center Y:', centerY);
      
      // Insert based on mouse position
      if (mouseY < centerY) {
        console.log('Inserting before');
        container.insertBefore(this.draggedElement, stepItem);
      } else {
        console.log('Inserting after');
        const nextSibling = stepItem.nextSibling;
        if (nextSibling) {
          container.insertBefore(this.draggedElement, nextSibling);
        } else {
          container.appendChild(this.draggedElement);
        }
      }
      
      // Update step numbers
      this.updateStepNumbers();
      console.log('Reorder complete');
    });
  }

  /**
   * Initialize drag and drop for existing steps
   */
  initializeStepDragAndDrop() {
    const container = document.getElementById('instructions-container');
    if (container) {
      const steps = container.querySelectorAll('.step-item');
      steps.forEach(step => this.setupStepDragAndDrop(step));
    }
  }

  /**
   * Update step numbers in the instructions container
   */
  updateStepNumbers() {
    const container = document.getElementById('instructions-container');
    if (!container) return;
    
    const steps = container.querySelectorAll('.step-item');
    steps.forEach((step, index) => {
      const numberSpan = step.querySelector('.input-group-text');
      if (numberSpan) {
        numberSpan.textContent = `${index + 1}.`;
      }
    });
  }
}

// Create and export singleton instance (will be initialized with repository from main.js)
export const recipeUI = new RecipeUI();
export default recipeUI;

// Export the class for testing
export { RecipeUI };
