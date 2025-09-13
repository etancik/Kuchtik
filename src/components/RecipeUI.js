/**
 * Refactored Unified Recipe UI component using RecipeRepository
 */

import { templateLoader } from '../utils/templateLoader.js';
import RecipeRepository from '../repositories/RecipeRepository.js';
import gitHubAPIAdapter from '../adapters/GitHubAPIAdapter.js';

class RecipeUI {
  constructor() {
    this.isEditing = false;
    this.editingRecipe = null;
    this.modal = null;
    this.repository = null;
  }

  /**
   * Initialize the recipe UI
   */
  async initialize() {
    console.log('🚀 Initializing RecipeUI with RecipeRepository...');
    try {
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

      // Load and inject the modal template
      const modalHtml = await templateLoader.loadTemplate('src/templates/recipe-modal.html');
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      // Get modal instance
      this.modal = new window.bootstrap.Modal(document.getElementById('recipe-modal'));
      
      // Setup form submission handler
      const form = document.getElementById('recipe-form');
      if (form) {
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
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

    // Listen for cache updates
    this.repository.on('cacheUpdated', (event) => {
      console.log('🔄 Cache updated:', event);
      this.handleCacheUpdate(event);
    });

    // Listen for recipes updates (when the full recipe list changes)
    this.repository.on('recipesUpdated', (recipes) => {
      console.log('📝 Recipes updated, refreshing display with', recipes.length, 'recipes');
      this.refreshRecipesDisplay();
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
        this.showSuccessMessage(`Recipe "${recipe.name}" is being created...`);
        break;
      case 'update':
        this.showSuccessMessage(`Recipe "${recipe.name}" is being updated...`);
        break;
      case 'delete':
        this.showSuccessMessage(`Recipe "${recipeId}" is being deleted...`);
        break;
    }

    // Trigger UI refresh
    this.refreshRecipesDisplay();
  }

  /**
   * Handle successful operations
   * @param {Object} event - Event data
   */
  handleOperationSuccess(event) {
    const { operation, recipeId, recipe } = event;
    
    switch (operation) {
      case 'create':
        this.showSuccessMessage(`Recipe "${recipe.name}" created successfully!`);
        break;
      case 'update':
        this.showSuccessMessage(`Recipe "${recipe.name}" updated successfully!`);
        break;
      case 'delete':
        this.showSuccessMessage(`Recipe "${recipeId}" deleted successfully!`);
        break;
    }
  }

  /**
   * Handle operation failures
   * @param {Object} event - Event data
   */
  handleOperationFailure(event) {
    const { operation, recipeId, error } = event;
    
    let message;
    switch (operation) {
      case 'create':
        message = `Failed to create recipe: ${error.message}`;
        break;
      case 'update':
        message = `Failed to update recipe: ${error.message}`;
        break;
      case 'delete':
        message = `Failed to delete recipe "${recipeId}": ${error.message}`;
        break;
      default:
        message = `Operation failed: ${error.message}`;
    }
    
    this.showErrorMessage(message);
  }

  /**
   * Handle rollbacks
   * @param {Object} event - Event data
   */
  handleRollback(event) {
    const { operation, recipeId, error } = event;
    this.showWarningMessage(`${operation} operation for "${recipeId}" was rolled back due to: ${error.message}`);
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
    document.addEventListener('click', (e) => {
      if (e.target.closest('.edit-recipe-btn')) {
        const button = e.target.closest('.edit-recipe-btn');
        const recipeData = JSON.parse(button.getAttribute('data-recipe'));
        this.showEditForm(recipeData);
      } else if (e.target.closest('.delete-recipe-btn')) {
        const button = e.target.closest('.delete-recipe-btn');
        const recipeId = button.getAttribute('data-recipe-id');
        const recipeName = button.getAttribute('data-recipe-name');
        this.showDeleteConfirmation(recipeId, recipeName);
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
      '<i class="fas fa-utensils me-2"></i>Create New Recipe';
    document.getElementById('recipe-submit-btn').innerHTML = 
      '<i class="fas fa-save me-2"></i>Create Recipe';
    
    // Clear form
    this.clearForm();
    
    // Show modal
    this.modal.show();
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
      '<i class="fas fa-edit me-2"></i>Edit Recipe';
    document.getElementById('recipe-submit-btn').innerHTML = 
      '<i class="fas fa-save me-2"></i>Update Recipe';
    
    // Populate form with recipe data
    this.populateForm(recipe);
    
    // Show modal
    this.modal.show();
  }

  /**
   * Show delete confirmation dialog
   * @param {string} recipeId - ID of the recipe to delete
   * @param {string} recipeName - Name of the recipe to delete
   */
  async showDeleteConfirmation(recipeId, recipeName) {
    console.log('🗑️ Showing delete confirmation for:', recipeName);
    
    const confirmed = confirm(
      `Are you sure you want to delete the recipe "${recipeName}"?\\n\\n` +
      `This action cannot be undone and will permanently remove the recipe from your collection.`
    );
    
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
      this.showErrorMessage(`Failed to delete recipe: ${error.message}`);
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
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
      
      const formData = this.collectFormData();
      
      if (this.isEditing) {
        console.log('🔄 Updating existing recipe...');
        console.log('📝 Original recipe ID:', this.editingRecipe.id);
        console.log('📄 Updated data:', formData);
        
        // Update the recipe using repository (optimistic updates handled automatically)
        await this.repository.update(this.editingRecipe.name, formData);
        
        // Close modal
        this.modal.hide();
        
      } else {
        console.log('🔄 Creating new recipe...');
        console.log('📄 Recipe data:', formData);
        
        // Create the recipe using repository (optimistic updates handled automatically)
        await this.repository.create(formData);
        
        // Close modal
        this.modal.hide();
      }
      
    } catch (error) {
      console.error('❌ Failed to process recipe:', error);
      this.showErrorMessage(`Failed to ${this.isEditing ? 'update' : 'create'} recipe: ${error.message}`);
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
      .map(input => input.value.trim())
      .filter(value => value !== '');

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

    // Add metadata for new recipes
    let recipeData = {
      name,
      ingredients,
      instructions,
      cookingTime,
      servings,
      notes,
      tags
    };

    if (!this.isEditing && this.repository.githubAPI.isAuthenticated()) {
      const userInfo = this.repository.githubAPI.getCurrentUser();
      recipeData.author = userInfo?.login || 'Anonymous';
      recipeData.created = new Date().toISOString();
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
  showSuccessMessage(message = 'Operation completed successfully!') {
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
    document.getElementById('recipe-tags').value = '';
    
    // Clear dynamic lists
    this.resetContainer('ingredients-container', 'ingredient-input', 'Enter ingredient', 'input');
    this.resetContainer('instructions-container', 'instruction-input', 'Enter instruction step', 'textarea');
    this.resetContainer('notes-container', 'note-input', 'Enter note', 'input');
  }

  populateForm(recipe) {
    // Populate basic fields
    document.getElementById('recipe-name').value = recipe.name || '';
    document.getElementById('recipe-servings').value = recipe.servings || '4';
    document.getElementById('recipe-time').value = recipe.cookingTime || '';
    document.getElementById('recipe-tags').value = (recipe.tags || []).join(', ');
    
    // Populate ingredients
    this.populateContainer('ingredients-container', recipe.ingredients || [], 'ingredient-input', 'Enter ingredient', 'input');
    
    // Populate instructions
    this.populateContainer('instructions-container', recipe.instructions || [], 'instruction-input', 'Enter instruction step', 'textarea');
    
    // Populate notes
    this.populateContainer('notes-container', recipe.notes || [], 'note-input', 'Enter note', 'input');
  }

  resetContainer(containerId, inputClass, placeholder, inputType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    
    if (containerId === 'instructions-container') {
      div.innerHTML = `
        <span class="input-group-text">1.</span>
        <${inputType} class="form-control ${inputClass}" ${inputType === 'textarea' ? 'rows="2"' : ''} placeholder="${placeholder}" required></${inputType}>
        <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
          <i class="fas fa-minus"></i>
        </button>
      `;
    } else {
      div.innerHTML = `
        <${inputType} class="form-control ${inputClass}" placeholder="${placeholder}" ${containerId === 'ingredients-container' ? 'required' : ''}></${inputType}>
        <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
          <i class="fas fa-minus"></i>
        </button>
      `;
    }
    
    container.appendChild(div);
  }

  populateContainer(containerId, data, inputClass, placeholder, inputType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (data.length === 0) {
      this.resetContainer(containerId, inputClass, placeholder, inputType);
      return;
    }
    
    data.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'input-group mb-2';
      
      if (containerId === 'instructions-container') {
        div.innerHTML = `
          <span class="input-group-text">${index + 1}.</span>
          <${inputType} class="form-control ${inputClass}" ${inputType === 'textarea' ? 'rows="2"' : ''} required>${item}</${inputType}>
          <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
            <i class="fas fa-minus"></i>
          </button>
        `;
      } else {
        div.innerHTML = `
          <${inputType} class="form-control ${inputClass}" value="${item}" ${containerId === 'ingredients-container' ? 'required' : ''}></${inputType}>
          <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
            <i class="fas fa-minus"></i>
          </button>
        `;
      }
      
      container.appendChild(div);
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
      <input type="text" class="form-control ingredient-input" placeholder="Enter ingredient" required>
      <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.removeIngredient(this)">
        <i class="fas fa-minus"></i>
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
    instructionDiv.className = 'input-group mb-2';
    instructionDiv.innerHTML = `
      <span class="input-group-text">${stepNumber}.</span>
      <textarea class="form-control instruction-input" rows="2" placeholder="Enter instruction step" required></textarea>
      <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.removeInstruction(this)">
        <i class="fas fa-minus"></i>
      </button>
    `;
    container.appendChild(instructionDiv);
    instructionDiv.querySelector('textarea').focus();
  }

  removeInstruction(button) {
    const container = document.getElementById('instructions-container');
    if (container.children.length > 1) {
      button.parentElement.remove();
      // Renumber remaining instructions
      Array.from(container.children).forEach((child, index) => {
        const numberSpan = child.querySelector('.input-group-text');
        if (numberSpan) {
          numberSpan.textContent = `${index + 1}.`;
        }
      });
    }
  }

  addNote() {
    const container = document.getElementById('notes-container');
    const noteDiv = document.createElement('div');
    noteDiv.className = 'input-group mb-2';
    noteDiv.innerHTML = `
      <input type="text" class="form-control note-input" placeholder="Enter note">
      <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.removeNote(this)">
        <i class="fas fa-minus"></i>
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
}

// Create and export singleton instance
export const recipeUI = new RecipeUI();
export default recipeUI;
