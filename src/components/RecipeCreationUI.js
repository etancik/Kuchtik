/**
 * Recipe Creation UI Components
 * Handles the form interface for creating new recipes
 */

import { githubAuth } from '../services/githubAuth.js';
import { recipeCreation } from '../services/recipeCreation.js';

class RecipeCreationUI {
  constructor() {
    this.isVisible = false;
    this.formContainer = null;
  }

  /**
   * Show the recipe creation form
   */
  show() {
    if (this.isVisible) return;

    // Check authentication
    if (!githubAuth.isAuthenticated()) {
      this.showAuthPrompt();
      return;
    }

    this.createForm();
    this.isVisible = true;
  }

  /**
   * Hide the recipe creation form
   */
  hide() {
    if (!this.isVisible || !this.formContainer) return;

    this.formContainer.remove();
    this.formContainer = null;
    this.isVisible = false;
  }

  /**
   * Show authentication prompt
   * @private
   */
  async showAuthPrompt() {
    const authModal = this.createAuthPrompt();
    document.body.appendChild(authModal);

    // Handle authentication
    const authenticateBtn = authModal.querySelector('#authenticate-btn');
    const cancelBtn = authModal.querySelector('#cancel-auth-btn');

    authenticateBtn.addEventListener('click', async () => {
      try {
        authenticateBtn.disabled = true;
        authenticateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';
        
        await githubAuth.authenticate();
        
        document.body.removeChild(authModal);
        this.show(); // Show form after successful auth
      } catch (error) {
        alert(`Authentication failed: ${error.message}`);
        authenticateBtn.disabled = false;
        authenticateBtn.innerHTML = 'Authenticate with GitHub';
      }
    });

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(authModal);
    });
  }

  /**
   * Create authentication prompt modal
   * @private
   * @returns {HTMLElement} Modal element
   */
  createAuthPrompt() {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Authentication Required</h5>
          </div>
          <div class="modal-body">
            <p>To create new recipes, you need to authenticate with GitHub.</p>
            <p>This allows the app to save your recipes to the repository.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancel-auth-btn">Cancel</button>
            <button type="button" class="btn btn-primary" id="authenticate-btn">
              Authenticate with GitHub
            </button>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Create the recipe creation form
   * @private
   */
  createForm() {
    // Create container
    this.formContainer = document.createElement('div');
    this.formContainer.className = 'recipe-creation-form';
    this.formContainer.innerHTML = this.getFormHTML();

    // Insert after the header but before recipe cards
    const recipeCardsContainer = document.getElementById('recipe-cards');
    recipeCardsContainer.parentNode.insertBefore(this.formContainer, recipeCardsContainer);

    // Add event listeners
    this.attachEventListeners();

    // Scroll to form
    this.formContainer.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Get the HTML for the recipe creation form
   * @private
   * @returns {string} Form HTML
   */
  getFormHTML() {
    const userInfo = githubAuth.getUserInfo();
    const userName = userInfo?.name || userInfo?.login || 'User';

    return `
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">
            <i class="fas fa-plus-circle me-2"></i>Create New Recipe
          </h5>
          <span class="badge bg-success">Authenticated as ${userName}</span>
        </div>
        <div class="card-body">
          <form id="recipe-creation-form">
            <!-- Basic Information -->
            <div class="row mb-3">
              <div class="col-md-8">
                <label for="recipe-name" class="form-label">Recipe Name *</label>
                <input type="text" class="form-control" id="recipe-name" required>
              </div>
              <div class="col-md-4">
                <label for="recipe-servings" class="form-label">Servings</label>
                <input type="number" class="form-control" id="recipe-servings" min="1" value="4">
              </div>
            </div>

            <!-- Cooking Time -->
            <div class="mb-3">
              <label for="recipe-time" class="form-label">Cooking Time</label>
              <input type="text" class="form-control" id="recipe-time" placeholder="e.g., 30 minutes">
            </div>

            <!-- Ingredients -->
            <div class="mb-3">
              <label class="form-label">Ingredients *</label>
              <div id="ingredients-container">
                <div class="input-group mb-2">
                  <input type="text" class="form-control ingredient-input" placeholder="Enter ingredient" required>
                  <button class="btn btn-outline-secondary" type="button" onclick="recipeCreationUI.removeIngredient(this)">
                    <i class="fas fa-minus"></i>
                  </button>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="recipeCreationUI.addIngredient()">
                <i class="fas fa-plus me-1"></i>Add Ingredient
              </button>
            </div>

            <!-- Instructions -->
            <div class="mb-3">
              <label class="form-label">Instructions *</label>
              <div id="instructions-container">
                <div class="input-group mb-2">
                  <span class="input-group-text">1.</span>
                  <textarea class="form-control instruction-input" rows="2" placeholder="Enter instruction step" required></textarea>
                  <button class="btn btn-outline-secondary" type="button" onclick="recipeCreationUI.removeInstruction(this)">
                    <i class="fas fa-minus"></i>
                  </button>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="recipeCreationUI.addInstruction()">
                <i class="fas fa-plus me-1"></i>Add Step
              </button>
            </div>

            <!-- Notes -->
            <div class="mb-3">
              <label for="recipe-notes" class="form-label">Notes (Optional)</label>
              <div id="notes-container">
                <div class="input-group mb-2">
                  <input type="text" class="form-control note-input" placeholder="Enter note">
                  <button class="btn btn-outline-secondary" type="button" onclick="recipeCreationUI.removeNote(this)">
                    <i class="fas fa-minus"></i>
                  </button>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="recipeCreationUI.addNote()">
                <i class="fas fa-plus me-1"></i>Add Note
              </button>
            </div>

            <!-- Tags -->
            <div class="mb-3">
              <label for="recipe-tags" class="form-label">Tags</label>
              <input type="text" class="form-control" id="recipe-tags" 
                     placeholder="Enter tags separated by commas (e.g., vegetarian, quick, dinner)">
              <div class="form-text">Separate multiple tags with commas</div>
            </div>

            <!-- Actions -->
            <div class="d-flex justify-content-between">
              <button type="button" class="btn btn-secondary" onclick="recipeCreationUI.hide()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save me-2"></i>Create Recipe
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to form elements
   * @private
   */
  attachEventListeners() {
    const form = document.getElementById('recipe-creation-form');
    form.addEventListener('submit', this.handleFormSubmit.bind(this));
  }

  /**
   * Handle form submission
   * @private
   * @param {Event} event - Form submit event
   */
  async handleFormSubmit(event) {
    event.preventDefault();
    console.log('📝 Recipe form submitted');

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    try {
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
      console.log('🔄 Form UI updated to loading state');

      // Collect form data
      console.log('📊 Collecting form data...');
      const recipeData = this.collectFormData();
      console.log('✅ Form data collected:', recipeData);

      // Validate data
      console.log('✅ Validating form data...');
      const validation = recipeCreation.validateRecipeData(recipeData);
      if (!validation.isValid) {
        console.error('❌ Form validation failed:', validation.errors);
        throw new Error(validation.errors.join('\n'));
      }
      console.log('✅ Form validation passed');

      // Create recipe
      console.log('🚀 Starting recipe creation...');
      const result = await recipeCreation.createRecipe(recipeData);
      console.log('✅ Recipe creation completed:', result);

      // Show success message
      console.log('🎉 Showing success message');
      this.showSuccessMessage(result);

      // Hide form
      console.log('🙈 Hiding form');
      this.hide();

      // Reload recipes to show the new one
      console.log('🔄 Reloading page to show new recipe');
      window.location.reload();

    } catch (error) {
      console.error('💥 Recipe creation failed in UI:', error);
      console.error('💥 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      alert(`Failed to create recipe:\n${error.message}`);
    } finally {
      // Reset button
      console.log('🔄 Resetting form button');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }

  /**
   * Collect data from the form
   * @private
   * @returns {Object} Recipe data
   */
  collectFormData() {
    console.log('📊 Collecting form data from DOM elements...');

    const ingredientElements = document.querySelectorAll('.ingredient-input');
    console.log('🥕 Found ingredient elements:', ingredientElements.length);
    const ingredients = Array.from(ingredientElements)
      .map(input => input.value.trim())
      .filter(value => value !== '');
    console.log('🥕 Processed ingredients:', ingredients);

    const instructionElements = document.querySelectorAll('.instruction-input');
    console.log('📋 Found instruction elements:', instructionElements.length);
    const instructions = Array.from(instructionElements)
      .map(input => input.value.trim())
      .filter(value => value !== '');
    console.log('📋 Processed instructions:', instructions);

    const nameElement = document.getElementById('recipe-name');
    const name = nameElement ? nameElement.value.trim() : '';
    console.log('📝 Recipe name:', name);

    const timeElement = document.getElementById('recipe-time');
    const cookingTime = timeElement ? timeElement.value.trim() : '';
    console.log('⏰ Cooking time:', cookingTime);

    const servingsElement = document.getElementById('recipe-servings');
    const servings = servingsElement ? parseInt(servingsElement.value) || 1 : 1;
    console.log('👥 Servings:', servings);

    const noteElements = document.querySelectorAll('.note-input');
    console.log('📝 Found note elements:', noteElements.length);
    const notes = Array.from(noteElements)
      .map(input => input.value.trim())
      .filter(value => value !== '');
    console.log('📝 Processed notes:', notes);

    const tagsElement = document.getElementById('recipe-tags');
    const tagsInput = tagsElement ? tagsElement.value : '';
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];
    console.log('🏷️ Tags input:', tagsInput);
    console.log('🏷️ Processed tags:', tags);

    const userInfo = githubAuth.getUserInfo();
    const author = userInfo?.login || 'Anonymous';
    console.log('👤 Author:', author);

    const created = new Date().toISOString();
    console.log('📅 Created timestamp:', created);

    const recipeData = {
      name,
      ingredients,
      instructions,
      cookingTime,
      servings,
      notes,
      tags,
      author,
      created,
    };

    console.log('✅ Complete recipe data collected:', recipeData);
    return recipeData;
  }

  /**
   * Add new ingredient input
   */
  addIngredient() {
    const container = document.getElementById('ingredients-container');
    const ingredientDiv = document.createElement('div');
    ingredientDiv.className = 'input-group mb-2';
    ingredientDiv.innerHTML = `
      <input type="text" class="form-control ingredient-input" placeholder="Enter ingredient" required>
      <button class="btn btn-outline-secondary" type="button" onclick="recipeCreationUI.removeIngredient(this)">
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
   * Add new instruction input
   */
  addInstruction() {
    const container = document.getElementById('instructions-container');
    const stepNumber = container.children.length + 1;
    const instructionDiv = document.createElement('div');
    instructionDiv.className = 'input-group mb-2';
    instructionDiv.innerHTML = `
      <span class="input-group-text">${stepNumber}.</span>
      <textarea class="form-control instruction-input" rows="2" placeholder="Enter instruction step" required></textarea>
      <button class="btn btn-outline-secondary" type="button" onclick="recipeCreationUI.removeInstruction(this)">
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
   * Add new note input
   */
  addNote() {
    const container = document.getElementById('notes-container');
    const noteDiv = document.createElement('div');
    noteDiv.className = 'input-group mb-2';
    noteDiv.innerHTML = `
      <input type="text" class="form-control note-input" placeholder="Enter note">
      <button class="btn btn-outline-secondary" type="button" onclick="recipeCreationUI.removeNote(this)">
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
   * Show success message
   * @private
   * @param {Object} result - Creation result
   */
  showSuccessMessage(result) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show';
    alert.innerHTML = `
      <i class="fas fa-check-circle me-2"></i>
      <strong>Recipe created successfully!</strong> 
      Your recipe "${result.filename}" has been saved to the repository.
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert at top of page
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Export singleton instance
export const recipeCreationUI = new RecipeCreationUI();

// Make it globally available for onclick handlers
window.recipeCreationUI = recipeCreationUI;

export default recipeCreationUI;
