/**
 * Ingredients Export Service
 * Handles the ingredients export modal and selection logic
 */

import { templateLoader } from '../utils/templateLoader.js';
import { t } from '../i18n/i18n.js';
import { openShortcut } from '../utils/shortcutsUtils.js';

class IngredientsExportService {
  constructor() {
    this.modal = null;
    this.ingredients = [];
    this.selectedIngredients = new Set();
    this.isInitialized = false;
  }

  /**
   * Initialize the ingredients export modal
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Load the modal template
      const modalHTML = await templateLoader.loadTemplate('src/templates/ingredients-modal.html');
      
      // Insert modal into DOM
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Initialize Bootstrap modal
      this.modal = new window.bootstrap.Modal(document.getElementById('ingredientsModal'));
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ IngredientsExportService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize IngredientsExportService:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for the modal
   */
  setupEventListeners() {
    const modal = document.getElementById('ingredientsModal');
    const selectAllBtn = document.getElementById('selectAllIngredients');
    const deselectAllBtn = document.getElementById('deselectAllIngredients');
    const exportBtn = document.getElementById('exportSelectedIngredients');
    
    // Select all ingredients
    selectAllBtn.addEventListener('click', () => {
      this.selectAllIngredients();
    });
    
    // Deselect all ingredients
    deselectAllBtn.addEventListener('click', () => {
      this.deselectAllIngredients();
    });
    
    // Export selected ingredients
    exportBtn.addEventListener('click', () => {
      this.exportSelectedIngredients();
    });
    
    // Update translations when modal is shown
    modal.addEventListener('shown.bs.modal', () => {
      this.updateModalTranslations();
    });
  }

  /**
   * Show the ingredients export modal with given ingredients
   * @param {string[]} ingredients - Array of ingredient strings
   */
  async showModal(ingredients) {
    if (!this.isInitialized) {
      await this.init();
    }

    this.ingredients = [...ingredients];
    this.selectedIngredients = new Set(ingredients); // Select all by default
    
    this.renderIngredientsList();
    this.updateSelectionCounter();
    this.modal.show();
  }

  /**
   * Render the ingredients list with checkboxes
   */
  renderIngredientsList() {
    const container = document.getElementById('ingredientsList');
    
    if (this.ingredients.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted">
          <i class="fas fa-exclamation-circle me-2"></i>
          <span data-i18n="ingredientsExport.noIngredients">No ingredients found</span>
        </div>
      `;
      return;
    }

    const ingredientsHTML = this.ingredients.map((ingredient, index) => {
      const isSelected = this.selectedIngredients.has(ingredient);
      const ingredientId = `ingredient-${index}`;
      
      return `
        <div class="form-check mb-2">
          <input class="form-check-input ingredient-checkbox" 
                 type="checkbox" 
                 value="${this.escapeHtml(ingredient)}" 
                 id="${ingredientId}"
                 ${isSelected ? 'checked' : ''}>
          <label class="form-check-label" for="${ingredientId}">
            ${this.escapeHtml(ingredient)}
          </label>
        </div>
      `;
    }).join('');

    container.innerHTML = ingredientsHTML;
    
    // Add event listeners to checkboxes
    container.querySelectorAll('.ingredient-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.handleIngredientCheckboxChange(e.target);
      });
    });
  }

  /**
   * Handle individual ingredient checkbox change
   * @param {HTMLInputElement} checkbox - The checkbox element
   */
  handleIngredientCheckboxChange(checkbox) {
    const ingredient = checkbox.value;
    
    if (checkbox.checked) {
      this.selectedIngredients.add(ingredient);
    } else {
      this.selectedIngredients.delete(ingredient);
    }
    
    this.updateSelectionCounter();
  }

  /**
   * Select all ingredients
   */
  selectAllIngredients() {
    this.selectedIngredients = new Set(this.ingredients);
    
    // Update checkboxes
    document.querySelectorAll('.ingredient-checkbox').forEach(checkbox => {
      checkbox.checked = true;
    });
    
    this.updateSelectionCounter();
  }

  /**
   * Deselect all ingredients
   */
  deselectAllIngredients() {
    this.selectedIngredients.clear();
    
    // Update checkboxes
    document.querySelectorAll('.ingredient-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    this.updateSelectionCounter();
  }

  /**
   * Update the selection counter display
   */
  updateSelectionCounter() {
    const selectedCountElement = document.getElementById('selectedIngredientsCount');
    const totalCountElement = document.getElementById('totalIngredientsCount');
    const exportBtn = document.getElementById('exportSelectedIngredients');
    
    if (selectedCountElement && totalCountElement) {
      selectedCountElement.textContent = this.selectedIngredients.size;
      totalCountElement.textContent = this.ingredients.length;
    }
    
    // Enable/disable export button based on selection
    if (exportBtn) {
      exportBtn.disabled = this.selectedIngredients.size === 0;
    }
  }

  /**
   * Export selected ingredients to shopping list
   */
  async exportSelectedIngredients() {
    const selected = Array.from(this.selectedIngredients);
    
    if (selected.length === 0) {
      alert(t('ingredientsExport.noIngredientsSelected'));
      return;
    }

    try {
      // Hide the modal
      this.modal.hide();
      
      // Show success message
      const count = selected.length;
      const plural = count === 1 ? '' : 's';
      const message = t('ingredientsExport.exportSuccess', { count, plural });
      this.showSuccessMessage(message);
      
      // Open shortcut with selected ingredients
      openShortcut(selected);
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(t('ingredientsExport.exportError'));
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message to show
   */
  showSuccessMessage(message) {
    // Create and show a toast notification
    const toastHTML = `
      <div class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            <i class="fas fa-check-circle me-2"></i>${message}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      toastContainer.style.zIndex = '1100';
      document.body.appendChild(toastContainer);
    }
    
    // Add toast to container
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    // Initialize and show the toast
    const toastElement = toastContainer.lastElementChild;
    const toast = new window.bootstrap.Toast(toastElement, {
      autohide: true,
      delay: 3000
    });
    toast.show();
    
    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }

  /**
   * Update modal translations
   */
  updateModalTranslations() {
    // This will be handled by the global translation system
    // when i18n updates are triggered
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
export const ingredientsExportService = new IngredientsExportService();
export default ingredientsExportService;
