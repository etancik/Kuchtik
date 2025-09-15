/**
 * Ingredients Export Service
 * Handles the ingredients export modal and selection logic
 */

import { templateLoader } from '../utils/templateLoader.js';
import { t } from '../i18n/i18n.js';
import { openShortcut } from '../utils/shortcutsUtils.js';
import { normalizeIngredientsList, scaleIngredient, parseIngredient } from '../utils/smartIngredients.js';

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
    const copyBtn = document.getElementById('copyToClipboard');
    
    // Select all ingredients
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.selectAllIngredients();
      });
    }
    
    // Deselect all ingredients
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        this.deselectAllIngredients();
      });
    }
    
    // Export selected ingredients to Shortcuts
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportSelectedIngredients();
      });
    }

    // Copy selected ingredients to clipboard (may not exist in tests)
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copySelectedIngredientsToClipboard();
      });
    }
    
    // Update translations when modal is shown
    if (modal) {
      modal.addEventListener('shown.bs.modal', () => {
        this.updateModalTranslations();
      });
    }
  }

  /**
   * Show the ingredients export modal with given ingredients
   * @param {string[]} ingredients - Array of ingredient strings
   */
  /**
   * Show the ingredients export modal
   * @param {Array<string|Object>} rawIngredients - Raw ingredients in mixed format
   */
  async showModal(rawIngredients) {
    if (!this.isInitialized) {
      await this.init();
    }

    // Normalize ingredients (no merging)
    const normalizedIngredients = normalizeIngredientsList(rawIngredients);

    // Store processed ingredients
    this.ingredients = normalizedIngredients;
    
    // Select ingredients based on their export defaults
    this.selectedIngredients = new Set();
    this.ingredients.forEach(ingredient => {
      if (ingredient.exportDefault) {
        this.selectedIngredients.add(ingredient);
      }
    });
    
    this.renderIngredientsList();
    this.updateSelectionCounter();
    this.modal.show();
  }

  /**
   * Show the ingredients export modal with grouped recipes (each recipe has its own scale)
   * @param {Array} groupedRecipes - Array of recipe objects with ingredients
   */
  async showModalWithGroupedRecipes(groupedRecipes) {
    if (!this.isInitialized) {
      await this.init();
    }

    // Store grouped recipes data
    this.groupedRecipes = groupedRecipes;
    this.recipeScales = new Map();
    
    // Initialize scales for each recipe
    groupedRecipes.forEach(recipe => {
      this.recipeScales.set(recipe.recipeId, recipe.defaultScale || 1);
    });

    // Flatten and normalize all ingredients for selection tracking
    const allIngredients = [];
    groupedRecipes.forEach(recipe => {
      const normalizedIngredients = normalizeIngredientsList(recipe.ingredients);
      normalizedIngredients.forEach(ingredient => {
        ingredient._recipeId = recipe.recipeId; // Add recipe reference
        allIngredients.push(ingredient);
      });
    });

    this.ingredients = allIngredients;
    
    // Select ingredients based on their export defaults
    this.selectedIngredients = new Set();
    this.ingredients.forEach(ingredient => {
      if (ingredient.exportDefault) {
        this.selectedIngredients.add(ingredient);
      }
    });
    
    this.renderGroupedIngredientsList();
    this.updateSelectionCounter();
    this.modal.show();
  }

  /**
   * Render the ingredients list with checkboxes
   */
  renderIngredientsList() {
    const container = document.getElementById('ingredientsList');
    if (!container) return;
    
    if (this.ingredients.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted">
          <i class="fas fa-exclamation-circle me-2"></i>
          <span data-i18n="ingredientsExport.noIngredients">No ingredients found</span>
        </div>
      `;
      return;
    }

    // Single-recipe mode: no scaling applied (scale = 1)
    const scale = 1;

    const ingredientsHTML = this.ingredients.map((ingredient, index) => {
      const isSelected = this.selectedIngredients.has(ingredient);
      const ingredientId = `ingredient-${index}`;
      const originalText = ingredient.text || ingredient;
      
      // Apply scaling to the ingredient text if scale is not 1
      let displayText;
      let showMultiplier = false;
      
      if (scale !== 1) {
        try {
          // If it's a simple string ingredient, parse it first
          if (typeof ingredient === 'string') {
            const parsed = parseIngredient(originalText);
            if (parsed.amount && !isNaN(parsed.amount)) {
              // We have a numeric amount, calculate the scaled amount
              const scaledAmount = (parsed.amount * scale).toString();
              const unit = parsed.unit || '';
              const ingredientName = parsed.ingredient || '';
              displayText = `${scaledAmount} ${unit} ${ingredientName}`.trim();
              showMultiplier = false;
            } else {
              // No numeric amount, show original with multiplier
              displayText = originalText;
              showMultiplier = true;
            }
          } else {
            // For ingredient objects, check if they have numeric amounts
            if (ingredient.amount && !isNaN(ingredient.amount)) {
              const scaledAmount = (ingredient.amount * scale).toString();
              const unit = ingredient.unit || '';
              const ingredientName = ingredient.ingredient || '';
              displayText = `${scaledAmount} ${unit} ${ingredientName}`.trim();
              showMultiplier = false;
            } else {
              displayText = ingredient.text || originalText;
              showMultiplier = true;
            }
          }
        } catch {
          // If parsing fails, show original with multiplier
          displayText = originalText;
          showMultiplier = true;
        }
      } else {
        displayText = originalText;
        showMultiplier = false;
      }
      
      return `
        <div class="form-check mb-2">
          <input class="form-check-input ingredient-checkbox" 
                 type="checkbox" 
                 value="${this.escapeHtml(displayText)}" 
                 id="${ingredientId}"
                 data-index="${index}"
                 ${isSelected ? 'checked' : ''}>
          <label class="form-check-label" for="${ingredientId}">
            ${this.escapeHtml(displayText)}
            ${showMultiplier && scale !== 1 ? `<small class="text-muted ms-2">(×${scale})</small>` : ''}
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
   * Render ingredients list grouped by recipe with individual scaling
   */
  renderGroupedIngredientsList() {
    const container = document.getElementById('ingredientsList');
    if (!container) return;

    if (!this.groupedRecipes || this.groupedRecipes.length === 0) {
      container.innerHTML = `
        <div class="text-muted text-center py-4">
          <i class="fas fa-list-ul fa-3x mb-3 opacity-50"></i><br>
          <span data-i18n="ingredientsExport.noIngredients">No ingredients found</span>
        </div>
      `;
      return;
    }

    const recipeSectionsHTML = this.groupedRecipes.map((recipe, recipeIndex) => {
      const recipeScale = this.recipeScales.get(recipe.recipeId) || 1;
      const normalizedIngredients = normalizeIngredientsList(recipe.ingredients);
      
      const ingredientsHTML = normalizedIngredients.map((ingredient, ingredientIndex) => {
        const globalIndex = this.ingredients.findIndex(ing => 
          ing._recipeId === recipe.recipeId && 
          (ing.text === ingredient.text || ing === ingredient)
        );
        const isSelected = this.selectedIngredients.has(this.ingredients[globalIndex]);
        
        // Apply scaling to display text
        let displayText;
        let showMultiplier = false;
        
        if (recipeScale !== 1) {
          try {
            if (ingredient.amount && !isNaN(ingredient.amount)) {
              const scaledAmount = (ingredient.amount * recipeScale).toString();
              const unit = ingredient.unit || '';
              const ingredientName = ingredient.ingredient || '';
              displayText = `${scaledAmount} ${unit} ${ingredientName}`.trim();
              showMultiplier = false;
            } else {
              displayText = ingredient.text;
              showMultiplier = true;
            }
          } catch {
            displayText = ingredient.text;
            showMultiplier = true;
          }
        } else {
          displayText = ingredient.text;
          showMultiplier = false;
        }
        
        return `
          <div class="form-check mb-2">
            <input class="form-check-input ingredient-checkbox" 
                   type="checkbox" 
                   value="${this.escapeHtml(ingredient.text)}" 
                   id="ingredient-${recipeIndex}-${ingredientIndex}" 
                   data-global-index="${globalIndex}"
                   ${isSelected ? 'checked' : ''}>
            <label class="form-check-label" for="ingredient-${recipeIndex}-${ingredientIndex}">
              ${this.escapeHtml(displayText)}
              ${showMultiplier && recipeScale !== 1 ? `<small class="text-muted ms-2">(×${recipeScale})</small>` : ''}
            </label>
          </div>
        `;
      }).join('');

      return `
        <div class="recipe-section mb-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-utensils me-2"></i>
              ${this.escapeHtml(recipe.recipeName)}
            </h6>
            <div class="d-flex align-items-center">
              <small class="text-muted me-2">Scale:</small>
              <div class="input-group input-group-sm" style="width: 120px;">
                <button class="btn btn-outline-secondary recipe-scale-decrease" 
                        type="button" data-recipe-id="${recipe.recipeId}">
                  <i class="fas fa-minus"></i>
                </button>
                <input type="number" 
                       class="form-control text-center recipe-scale-input" 
                       data-recipe-id="${recipe.recipeId}"
                       value="${recipeScale}" 
                       min="0.25" max="4" step="0.25">
                <button class="btn btn-outline-secondary recipe-scale-increase" 
                        type="button" data-recipe-id="${recipe.recipeId}">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="ms-3">
            ${ingredientsHTML}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = recipeSectionsHTML;
    
    // Add event listeners
    this.setupGroupedEventListeners(container);
  }

  /**
   * Setup event listeners for grouped recipe controls
   */
  setupGroupedEventListeners(container) {
    // Ingredient checkboxes
    container.querySelectorAll('.ingredient-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const globalIndex = parseInt(e.target.dataset.globalIndex, 10);
        const ingredient = this.ingredients[globalIndex];
        if (e.target.checked) {
          this.selectedIngredients.add(ingredient);
        } else {
          this.selectedIngredients.delete(ingredient);
        }
        this.updateSelectionCounter();
      });
    });

    // Recipe scale inputs
    container.querySelectorAll('.recipe-scale-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const recipeId = e.target.dataset.recipeId;
        const newScale = parseFloat(e.target.value) || 1;
        this.recipeScales.set(recipeId, newScale);
        this.renderGroupedIngredientsList();
      });
    });

    // Recipe scale increase/decrease buttons
    container.querySelectorAll('.recipe-scale-increase').forEach(button => {
      button.addEventListener('click', (e) => {
        const recipeId = e.currentTarget.dataset.recipeId;
        const currentScale = this.recipeScales.get(recipeId) || 1;
        const newScale = this.getNextScale(currentScale);
        this.recipeScales.set(recipeId, newScale);
        this.renderGroupedIngredientsList();
      });
    });

    container.querySelectorAll('.recipe-scale-decrease').forEach(button => {
      button.addEventListener('click', (e) => {
        const recipeId = e.currentTarget.dataset.recipeId;
        const currentScale = this.recipeScales.get(recipeId) || 1;
        const newScale = this.getPreviousScale(currentScale);
        this.recipeScales.set(recipeId, newScale);
        this.renderGroupedIngredientsList();
      });
    });
  }

  /**
   * Handle individual ingredient checkbox change
   * @param {HTMLInputElement} checkbox - The checkbox element
   */
  handleIngredientCheckboxChange(checkbox) {
    const index = parseInt(checkbox.dataset.index, 10);
    const ingredient = this.ingredients[index];
    
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
    const copyBtn = document.getElementById('copyToClipboard');
    
    if (selectedCountElement && totalCountElement) {
      selectedCountElement.textContent = this.selectedIngredients.size;
      totalCountElement.textContent = this.ingredients.length;
    }
    
    // Enable/disable both buttons based on selection
    const hasSelection = this.selectedIngredients.size > 0;
    if (exportBtn) {
      exportBtn.disabled = !hasSelection;
    }
    if (copyBtn) {
      copyBtn.disabled = !hasSelection;
    }
  }

  /**
   * Export selected ingredients to shopping list
   */
  async exportSelectedIngredients() {
    const selectedIngredientObjects = Array.from(this.selectedIngredients);
    
    if (selectedIngredientObjects.length === 0) {
      alert(t('ingredientsExport.noIngredientsSelected'));
      return;
    }

    try {
      let selectedIngredientTexts;
      
      if (this.groupedRecipes && this.recipeScales) {
        // Grouped mode: apply per-recipe scaling
        selectedIngredientTexts = selectedIngredientObjects.map(ingredient => {
          const recipeId = ingredient._recipeId;
          const scale = this.recipeScales.get(recipeId) || 1;
          const originalText = ingredient.text || ingredient;
          
          if (scale !== 1) {
            try {
              if (ingredient.amount && !isNaN(ingredient.amount)) {
                const scaledAmount = (ingredient.amount * scale).toString();
                const unit = ingredient.unit || '';
                const ingredientName = ingredient.ingredient || '';
                return `${scaledAmount} ${unit} ${ingredientName}`.trim();
              } else {
                return originalText; // Can't scale non-numeric ingredients
              }
            } catch {
              return originalText;
            }
          }
          return originalText;
        });
      } else {
        // Single mode: no scaling applied (scale = 1)
        const scale = 1;
        
        selectedIngredientTexts = selectedIngredientObjects.map(ingredient => {
          const originalText = ingredient.text || ingredient;
          return scale !== 1 ? scaleIngredient(originalText, scale) : originalText;
        });
      }
      
      // Hide the modal
      this.modal.hide();
      
      // Show success message
      const count = selectedIngredientTexts.length;
      const plural = count === 1 ? '' : 's';
      const message = t('ingredientsExport.exportSuccess', { count, plural });
      this.showSuccessMessage(message);
      
      // Open shortcut with selected ingredients
      openShortcut(selectedIngredientTexts);
      
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
   * Copy selected ingredients to clipboard
   */
  async copySelectedIngredientsToClipboard() {
    const selectedIngredientObjects = Array.from(this.selectedIngredients);
    
    if (selectedIngredientObjects.length === 0) {
      alert(t('ingredientsExport.noIngredientsSelected'));
      return;
    }

    try {
      let selectedIngredientTexts;
      
      if (this.groupedRecipes && this.recipeScales) {
        // Grouped mode: apply per-recipe scaling
        selectedIngredientTexts = selectedIngredientObjects.map(ingredient => {
          const recipeId = ingredient._recipeId;
          const scale = this.recipeScales.get(recipeId) || 1;
          const originalText = ingredient.text || ingredient;
          
          if (scale !== 1) {
            try {
              if (ingredient.amount && !isNaN(ingredient.amount)) {
                const scaledAmount = (ingredient.amount * scale).toString();
                const unit = ingredient.unit || '';
                const ingredientName = ingredient.ingredient || '';
                return `${scaledAmount} ${unit} ${ingredientName}`.trim();
              } else {
                return originalText; // Can't scale non-numeric ingredients
              }
            } catch {
              return originalText;
            }
          }
          return originalText;
        });
      } else {
        // Single mode: no scaling applied
        selectedIngredientTexts = selectedIngredientObjects.map(ingredient => {
          return ingredient.text || ingredient;
        });
      }
      
      // Join ingredients with newlines for clipboard
      const clipboardText = selectedIngredientTexts.join('\n');
      
      // Copy to clipboard
      await navigator.clipboard.writeText(clipboardText);
      
      // Show success message
      const count = selectedIngredientTexts.length;
      const message = t('ingredientsExport.copySuccess', { count });
      this.showSuccessMessage(message);
      
    } catch (error) {
      console.error('❌ Copy to clipboard failed:', error);
      alert(t('ingredientsExport.copyError'));
    }
  }

  /**
   * Get the next larger scale value using practical cooking ratios
   * @param {number} currentValue - Current scale value
   * @returns {number} Next scale value
   */
  getNextScale(currentValue) {
    // Common cooking scale ratios: 0.25 (quarter), 0.5 (half), 1, 2 (double), 4 (quadruple)
    const scales = [0.25, 0.5, 1, 2, 4];
    
    // Find the next larger scale
    for (const scale of scales) {
      if (scale > currentValue) {
        return scale;
      }
    }
    
    // If already at max, stay at max
    return scales[scales.length - 1];
  }

  /**
   * Get the next smaller scale value using practical cooking ratios
   * @param {number} currentValue - Current scale value
   * @returns {number} Previous scale value
   */
  getPreviousScale(currentValue) {
    // Common cooking scale ratios: 0.25 (quarter), 0.5 (half), 1, 2 (double), 4 (quadruple)
    const scales = [0.25, 0.5, 1, 2, 4];
    
    // Find the next smaller scale
    for (let i = scales.length - 1; i >= 0; i--) {
      if (scales[i] < currentValue) {
        return scales[i];
      }
    }
    
    // If already at min, stay at min
    return scales[0];
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
