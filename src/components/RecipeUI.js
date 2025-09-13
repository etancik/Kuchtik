/**
 * Unified Recipe UI component for creating and editing recipes
 */

import { templateLoader } from '../utils/templateLoader.js';
import { recipeCreation } from '../services/recipeCreation.js';
import { loadAllRecipes, clearRecipeCache, getCacheStatus } from '../services/recipeAPI.js';
import { githubAuth } from '../services/githubAuth.js';

class RecipeUI {
  constructor() {
    this.isEditing = false;
    this.editingRecipe = null;
    this.modal = null;
    this.refreshWorkers = new Map(); // Track active refresh workers
  }

  /**
   * Initialize the recipe UI
   */
  async initialize() {
    console.log('🚀 Initializing RecipeUI...');
    try {
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
      
      console.log('✅ RecipeUI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RecipeUI:', error);
      throw error;
    }
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
        const recipeName = button.getAttribute('data-recipe-name');
        this.showDeleteConfirmation(recipeName);
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
   * @param {string} recipeName - Name of the recipe to delete
   */
  async showDeleteConfirmation(recipeName) {
    console.log('🗑️ Showing delete confirmation for:', recipeName);
    
    const confirmed = confirm(
      `Are you sure you want to delete the recipe "${recipeName}"?\n\n` +
      `This action cannot be undone and will permanently remove the recipe from your collection.`
    );
    
    if (confirmed) {
      await this.handleDeleteRecipe(recipeName);
    }
  }

  /**
   * Handle recipe deletion
   * @param {string} recipeName - Name of the recipe to delete
   */
  async handleDeleteRecipe(recipeName) {
    try {
      console.log('🗑️ Deleting recipe:', recipeName);
      
      // Check authentication
      if (!githubAuth.isAuthenticated()) {
        alert('Authentication required. Please authenticate first.');
        return;
      }
      
      // Delete the recipe
      const result = await recipeCreation.deleteRecipe(recipeName);
      console.log('✅ Recipe deleted successfully:', result);
      
      // Refresh the recipe list with delayed worker
      await this.refreshRecipes('delete', recipeName);
      
      // Show success message
      this.showSuccessMessage(`Recipe "${recipeName}" deleted successfully!`);
      
    } catch (error) {
      console.error('❌ Failed to delete recipe:', error);
      alert(`Failed to delete recipe: ${error.message}`);
    }
  }

  /**
   * Clear the form
   */
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

  /**
   * Populate form with recipe data
   * @param {Object} recipe - Recipe data
   */
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

  /**
   * Reset a container to have one empty input
   * @param {string} containerId - Container element ID
   * @param {string} inputClass - Input class name
   * @param {string} placeholder - Input placeholder
   * @param {string} inputType - 'input' or 'textarea'
   */
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

  /**
   * Populate a container with data
   * @param {string} containerId - Container element ID
   * @param {Array} data - Data array
   * @param {string} inputClass - Input class name
   * @param {string} placeholder - Input placeholder
   * @param {string} inputType - 'input' or 'textarea'
   */
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
          <${inputType} class="form-control ${inputClass}" ${inputType === 'textarea' ? 'rows="2"' : ''} placeholder="${placeholder}" required>${this.escapeHtml(item)}</${inputType}>
          <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
            <i class="fas fa-minus"></i>
          </button>
        `;
      } else {
        // Handle input vs textarea differently for value setting
        if (inputType === 'input') {
          div.innerHTML = `
            <${inputType} class="form-control ${inputClass}" placeholder="${placeholder}" value="${this.escapeHtml(item)}" ${containerId === 'ingredients-container' ? 'required' : ''}></${inputType}>
            <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
              <i class="fas fa-minus"></i>
            </button>
          `;
        } else {
          div.innerHTML = `
            <${inputType} class="form-control ${inputClass}" placeholder="${placeholder}" ${containerId === 'ingredients-container' ? 'required' : ''}>${this.escapeHtml(item)}</${inputType}>
            <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
              <i class="fas fa-minus"></i>
            </button>
          `;
        }
      }
      
      container.appendChild(div);
    });
  }

  /**
   * Get method suffix for container type
   * @param {string} containerId - Container ID
   * @returns {string} Method suffix
   */
  getMethodSuffix(containerId) {
    if (containerId.includes('ingredient')) return 'Ingredient';
    if (containerId.includes('instruction')) return 'Instruction';
    if (containerId.includes('note')) return 'Note';
    return '';
  }

  /**
   * Escape HTML characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        console.log('📝 Original recipe:', this.editingRecipe.name);
        console.log('� Updated data:', formData);
        
        const result = await recipeCreation.updateRecipe(formData, this.editingRecipe.name);
        console.log('✅ Recipe updated successfully:', result);
        
        // Close modal and refresh recipes
        this.modal.hide();
        await this.refreshRecipes('update', formData.name);
        
        // Show success message
        this.showSuccessMessage();
      } else {
        const result = await recipeCreation.createRecipe(formData);
        console.log('✅ Recipe created successfully:', result);
        
        // Close modal and refresh recipes
        this.modal.hide();
        await this.refreshRecipes('create', formData.name);
        
        // Show success message
        this.showSuccessMessage();
      }
      
    } catch (error) {
      console.error('❌ Failed to process recipe:', error);
      alert(`Failed to ${this.isEditing ? 'update' : 'create'} recipe:\n${error.message}`);
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

    if (!this.isEditing) {
      const userInfo = githubAuth.getUserInfo();
      recipeData.author = userInfo?.login || 'Anonymous';
      recipeData.created = new Date().toISOString();
    }

    return recipeData;
  }

  /**
   * Add ingredient input
   */
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

  /**
   * Remove ingredient input
   * @param {HTMLElement} button - Remove button element
   */
  removeIngredient(button) {
    const container = document.getElementById('ingredients-container');
    if (container.children.length > 1) {
      button.parentElement.remove();
    }
  }

  /**
   * Add instruction input
   */
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

  /**
   * Remove instruction input
   * @param {HTMLElement} button - Remove button element
   */
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

  /**
   * Add note input
   */
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

  /**
   * Remove note input
   * @param {HTMLElement} button - Remove button element
   */
  removeNote(button) {
    const container = document.getElementById('notes-container');
    if (container.children.length > 0) {
      button.parentElement.remove();
    }
  }

  /**
   * Refresh recipes display with immediate and delayed retries
   * @param {string} [operationType] - Type of operation ('create', 'update', 'delete')
   * @param {string} [recipeName] - Name of the affected recipe
   */
  async refreshRecipes(operationType = null, recipeName = null) {
    try {
      console.log('🔄 Refreshing recipes display...');
      
      // Clear cache for better reliability after operations
      if (operationType && recipeName) {
        clearRecipeCache(); // Clear all cache after operations
        console.log('🗑️ Cleared recipe cache due to operation:', operationType);
      }
      
      // Immediate refresh attempt with force refresh for operations
      const forceRefresh = Boolean(operationType);
      const recipes = await loadAllRecipes(forceRefresh);
      
      // Assuming there's a global function to render recipes
      if (window.renderRecipes) {
        window.renderRecipes(recipes);
      }

      // If this is after a create/update/delete operation, start a delayed worker
      if (operationType && recipeName) {
        this.startDelayedRefreshWorker(operationType, recipeName);
      }
      
    } catch (error) {
      console.error('❌ Failed to refresh recipes:', error);
    }
  }

  /**
   * Start a delayed refresh worker to handle GitHub API delays
   * @param {string} operationType - 'create', 'update', or 'delete'
   * @param {string} recipeName - Name of the affected recipe
   */
  startDelayedRefreshWorker(operationType, recipeName) {
    const workerId = `${operationType}-${recipeName}-${Date.now()}`;
    console.log(`🔄 Starting delayed refresh worker for ${operationType} of "${recipeName}"...`);
    
    // Cancel any existing worker for the same recipe
    const existingWorkerId = Array.from(this.refreshWorkers.keys())
      .find(id => id.includes(recipeName));
    if (existingWorkerId) {
      globalThis.clearTimeout(this.refreshWorkers.get(existingWorkerId));
      this.refreshWorkers.delete(existingWorkerId);
      console.log(`🔄 Cancelled existing worker for "${recipeName}"`);
    }

    // Create new worker with exponential backoff
    this.scheduleDelayedRefresh(workerId, operationType, recipeName, 0);
  }

  /**
   * Schedule delayed refresh with exponential backoff
   * @param {string} workerId - Unique worker identifier
   * @param {string} operationType - 'create', 'update', or 'delete'
   * @param {string} recipeName - Name of the affected recipe
   * @param {number} attempt - Current attempt number (0-based)
   */
  scheduleDelayedRefresh(workerId, operationType, recipeName, attempt) {
    const delays = [3000, 8000, 20000, 45000, 60000]; // 3s, 8s, 20s, 45s, 60s
    
    if (attempt >= delays.length) {
      console.log(`⏰ Max refresh attempts reached for "${recipeName}"`);
      this.refreshWorkers.delete(workerId);
      return;
    }

    const delay = delays[attempt];
    const delaySeconds = Math.round(delay / 1000);
    console.log(`⏰ Scheduling refresh attempt ${attempt + 1} for "${recipeName}" in ${delaySeconds}s (${delay}ms)`);
    
    const timeoutId = globalThis.setTimeout(async () => {
      try {
        console.log(`🔄 Executing delayed refresh attempt ${attempt + 1} for "${recipeName}"`);
        
        // Check if the operation was successful by verifying recipe state
        const success = await this.verifyRecipeOperation(operationType, recipeName);
        
        if (success) {
          console.log(`✅ Recipe "${recipeName}" ${operationType} confirmed, refreshing display`);
          
          // Refresh the display with forced refresh
          const recipes = await loadAllRecipes(true);
          if (window.renderRecipes) {
            window.renderRecipes(recipes);
          }
          
          // Show status update
          this.showDelayedRefreshStatus(operationType, recipeName, true);
          
          // Clean up worker
          this.refreshWorkers.delete(workerId);
        } else {
          console.log(`⏰ Recipe "${recipeName}" ${operationType} not yet confirmed, scheduling retry`);
          
          // Schedule next attempt
          this.scheduleDelayedRefresh(workerId, operationType, recipeName, attempt + 1);
        }
        
      } catch (error) {
        console.error(`❌ Error in delayed refresh worker for "${recipeName}":`, error);
        
        // Schedule retry on error (unless max attempts reached)
        if (attempt + 1 < delays.length) {
          this.scheduleDelayedRefresh(workerId, operationType, recipeName, attempt + 1);
        } else {
          console.log(`❌ Max retry attempts reached for "${recipeName}"`);
          this.showDelayedRefreshStatus(operationType, recipeName, false);
          this.refreshWorkers.delete(workerId);
        }
      }
    }, delay);
    
    this.refreshWorkers.set(workerId, timeoutId);
  }

  /**
   * Verify if a recipe operation was successful
   * @param {string} operationType - 'create', 'update', or 'delete'
   * @param {string} recipeName - Name of the affected recipe
   * @returns {boolean} True if operation is confirmed
   */
  async verifyRecipeOperation(operationType, recipeName) {
    try {
      const recipes = await loadAllRecipes();
      const recipeExists = recipes.some(recipe => recipe.name === recipeName);
      
      switch (operationType) {
        case 'create':
        case 'update':
          return recipeExists; // Recipe should exist after create/update
        case 'delete':
          return !recipeExists; // Recipe should not exist after delete
        default:
          return false;
      }
    } catch (error) {
      console.error(`❌ Error verifying ${operationType} operation for "${recipeName}":`, error);
      return false;
    }
  }

  /**
   * Show status update for delayed refresh operations
   * @param {string} operationType - 'create', 'update', or 'delete'
   * @param {string} recipeName - Name of the affected recipe
   * @param {boolean} success - Whether the operation was confirmed
   */
  showDelayedRefreshStatus(operationType, recipeName, success) {
    const alert = document.createElement('div');
    alert.className = `alert ${success ? 'alert-info' : 'alert-warning'} alert-dismissible fade show position-fixed`;
    alert.style.cssText = 'top: 80px; right: 20px; z-index: 1060; min-width: 300px;';
    
    const icon = success ? 'fa-sync-alt' : 'fa-exclamation-triangle';
    const message = success 
      ? `Recipe list updated - "${recipeName}" ${operationType} confirmed`
      : `Recipe "${recipeName}" ${operationType} may still be processing`;
    
    alert.innerHTML = `
      <i class="fas ${icon} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 4 seconds
    globalThis.setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 4000);
  }

  /**
   * Cancel all active refresh workers
   */
  cancelAllRefreshWorkers() {
    console.log(`🛑 Cancelling ${this.refreshWorkers.size} active refresh workers`);
    for (const [workerId, timeoutId] of this.refreshWorkers.entries()) {
      globalThis.clearTimeout(timeoutId);
      console.log(`🛑 Cancelled worker: ${workerId}`);
    }
    this.refreshWorkers.clear();
  }

  /**
   * Get status of active refresh workers
   * @returns {Array} Array of active worker information
   */
  getActiveRefreshWorkers() {
    return Array.from(this.refreshWorkers.keys()).map(workerId => {
      const [operationType, recipeName, timestamp] = workerId.split('-');
      return {
        id: workerId,
        operationType,
        recipeName,
        startedAt: new Date(parseInt(timestamp)),
        duration: Date.now() - parseInt(timestamp)
      };
    });
  }

  /**
   * Manually trigger a recipe list refresh (useful for debugging or user-initiated refresh)
   */
  async forceRefresh() {
    console.log('🔄 Manual refresh triggered');
    try {
      clearRecipeCache(); // Clear cache for manual refresh
      const recipes = await loadAllRecipes(true);
      if (window.renderRecipes) {
        window.renderRecipes(recipes);
      }
      
      this.showSuccessMessage('Recipe list refreshed successfully');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      alert(`Failed to refresh recipe list: ${error.message}`);
    }
  }

  /**
   * Show current cache status (useful for debugging)
   * @returns {Object} Cache status information
   */
  showCacheStatus() {
    const status = getCacheStatus();
    console.log('📊 Recipe Cache Status:', {
      'Total entries': status.totalEntries,
      'Valid entries': status.validEntries,
      'Expired entries': status.expiredEntries,
      'Cache duration': `${status.cacheDurationMinutes} minutes`,
      'Entries': status.entries
    });
    return status;
  }

  /**
   * Show success message
   * @param {string} [customMessage] - Optional custom message to display
   */
  showSuccessMessage(customMessage) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 1060; min-width: 300px;';
    
    const message = customMessage || `Recipe ${this.isEditing ? 'updated' : 'created'} successfully!`;
    
    alert.innerHTML = `
      <i class="fas fa-check-circle me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Create global instance
export const recipeUI = new RecipeUI();
