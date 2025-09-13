/**
 * Unified Recipe UI component for creating and editing recipes
 */

import { templateLoader } from '../utils/templateLoader.js';
import { recipeCreation } from '../services/recipeCreation.js';
import { loadAllRecipes } from '../services/recipeAPI.js';
import { githubAuth } from '../services/githubAuth.js';

class RecipeUI {
  constructor() {
    this.isEditing = false;
    this.editingRecipe = null;
    this.modal = null;
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
   * Setup edit button event handlers
   */
  setupEditHandlers() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.edit-recipe-btn')) {
        const button = e.target.closest('.edit-recipe-btn');
        const recipeData = JSON.parse(button.getAttribute('data-recipe'));
        this.showEditForm(recipeData);
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
          <${inputType} class="form-control ${inputClass}" ${inputType === 'textarea' ? 'rows="2"' : ''} placeholder="${placeholder}" required>${item}</${inputType}>
          <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
            <i class="fas fa-minus"></i>
          </button>
        `;
      } else {
        div.innerHTML = `
          <${inputType} class="form-control ${inputClass}" placeholder="${placeholder}" ${containerId === 'ingredients-container' ? 'required' : ''}>${item}</${inputType}>
          <button class="btn btn-outline-secondary" type="button" onclick="recipeUI.remove${this.getMethodSuffix(containerId)}(this)">
            <i class="fas fa-minus"></i>
          </button>
        `;
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
        await this.refreshRecipes();
        
        // Show success message
        this.showSuccessMessage();
      } else {
        const result = await recipeCreation.createRecipe(formData);
        console.log('✅ Recipe created successfully:', result);
        
        // Close modal and refresh recipes
        this.modal.hide();
        await this.refreshRecipes();
        
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
   * Refresh recipes display
   */
  async refreshRecipes() {
    try {
      console.log('🔄 Refreshing recipes display...');
      const recipes = await loadAllRecipes();
      
      // Assuming there's a global function to render recipes
      if (window.renderRecipes) {
        window.renderRecipes(recipes);
      }
    } catch (error) {
      console.error('❌ Failed to refresh recipes:', error);
    }
  }

  /**
   * Show success message
   */
  showSuccessMessage() {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 1060; min-width: 300px;';
    alert.innerHTML = `
      <i class="fas fa-check-circle me-2"></i>
      Recipe ${this.isEditing ? 'updated' : 'created'} successfully!
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
