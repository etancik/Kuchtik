import { templateLoader } from '../utils/templateLoader.js';

/**
 * Skeleton Card Service
 * Manages skeleton loading cards for better loading experience
 */
export class SkeletonCardService {
  constructor() {
    this.skeletonTemplate = null;
  }

  /**
   * Initialize the skeleton service by loading the template
   */
  async init() {
    try {
      console.log('🔄 Initializing skeleton card service...');
      this.skeletonTemplate = await templateLoader.loadTemplate('src/templates/skeleton-card.html');
      console.log('✅ Skeleton card template loaded successfully');
    } catch (error) {
      console.error('Failed to load skeleton card template:', error);
      console.log('🔄 Using fallback skeleton template');
      // Fallback to inline template if file loading fails
      this.skeletonTemplate = this.createFallbackTemplate();
    }
  }

  /**
   * Create fallback skeleton template if file loading fails
   */
  createFallbackTemplate() {
    return `
      <div class="skeleton-recipe-card">
        <div class="card recipe-card position-relative">
          <div class="card-body p-0">
            <div class="recipe-header">
              <div class="d-flex align-items-center p-3">
                <div class="checkbox-container">
                  <input type="checkbox" class="selectRecipe" disabled>
                </div>
                <div class="flex-grow-1 recipe-title-area">
                  <div class="skeleton skeleton-title"></div>
                  <div class="skeleton skeleton-subtitle"></div>
                </div>
                <div class="expand-toggle" role="button">
                  <i class="fas fa-chevron-down expand-icon"></i>
                </div>
                <div class="fullscreen-toggle" role="button" title="View recipe in fullscreen">
                  <i class="fas fa-expand"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show skeleton cards while content is loading
   * @param {HTMLElement} container - Container to show skeletons in
   * @param {number} count - Number of skeleton cards to show
   */
  showSkeletons(container, count = 6) {
    console.log(`🔄 Showing ${count} skeleton cards...`);
    
    if (!this.skeletonTemplate) {
      console.warn('Skeleton template not loaded, skipping skeleton display');
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Add skeleton cards with proper Bootstrap grid structure
    // The container already has "row row-cols-1 g-3" classes
    for (let i = 0; i < count; i++) {
      // Create a column wrapper (like real recipe cards)
      const colDiv = document.createElement('div');
      colDiv.className = 'col';
      
      // Create skeleton card inside the column
      const skeletonDiv = document.createElement('div');
      skeletonDiv.innerHTML = this.skeletonTemplate;
      
      // Append skeleton to column, then column to container
      colDiv.appendChild(skeletonDiv.firstElementChild);
      container.appendChild(colDiv);
    }
    
    // Add skeleton-specific class to container for potential styling
    container.classList.add('loading-skeletons');
    
    console.log(`✅ Skeleton cards displayed in container`);
  }

  /**
   * Hide skeleton cards and prepare for real content
   * @param {HTMLElement} container - Container with skeleton cards
   */
  hideSkeletons(container) {
    // Remove skeleton-specific class
    container.classList.remove('loading-skeletons');
    
    // Clear skeleton content
    container.innerHTML = '';
  }

  /**
   * Replace a single skeleton card with real content
   * @param {HTMLElement} container - Container with skeleton cards
   * @param {HTMLElement} realCard - Real recipe card to insert
   * @param {number} index - Index of skeleton card to replace (0-based)
   */
  replaceSkeletonWithCard(container, realCard, index = 0) {
    // Find all columns that contain skeleton cards
    const allCols = container.querySelectorAll('.col');
    const skeletonCols = Array.from(allCols).filter(col => 
      col.querySelector('.skeleton-recipe-card')
    );
    
    if (index < skeletonCols.length) {
      const skeletonCol = skeletonCols[index];
      
      // Create new column wrapper for the real card
      const realCol = document.createElement('div');
      realCol.className = 'col';
      
      // Add fade-in animation to real card
      realCard.classList.add('recipe-card-fade-in');
      
      // Put real card in the column
      realCol.appendChild(realCard);
      
      // Replace skeleton column with real column
      skeletonCol.parentNode.replaceChild(realCol, skeletonCol);
      
      // Remove animation class after animation completes
      setTimeout(() => {
        realCard.classList.remove('recipe-card-fade-in');
      }, 300);
    } else {
      // If no more skeleton columns, create new column and append
      const newCol = document.createElement('div');
      newCol.className = 'col';
      newCol.appendChild(realCard);
      container.appendChild(newCol);
    }
  }

  /**
   * Get the number of skeleton cards currently displayed
   * @param {HTMLElement} container - Container with potential skeleton cards
   * @returns {number} Number of skeleton cards
   */
  getSkeletonCount(container) {
    return container.querySelectorAll('.skeleton-recipe-card').length;
  }

  /**
   * Check if container is currently showing skeleton cards
   * @param {HTMLElement} container - Container to check
   * @returns {boolean} True if showing skeletons
   */
  isShowingSkeletons(container) {
    return container.classList.contains('loading-skeletons') || 
           this.getSkeletonCount(container) > 0;
  }

  /**
   * Estimate optimal number of skeleton cards based on viewport
   * @returns {number} Estimated number of cards that fit in viewport
   */
  estimateCardCount() {
    // Estimate based on viewport height and typical card height
    const viewportHeight = window.innerHeight;
    const estimatedCardHeight = 120; // Collapsed card height estimate
    const headerHeight = 100; // Estimate for nav/header
    const availableHeight = viewportHeight - headerHeight;
    
    // Add 2 extra cards to ensure scrolling area
    return Math.max(4, Math.ceil(availableHeight / estimatedCardHeight) + 2);
  }
}

// Export singleton instance
export const skeletonCardService = new SkeletonCardService();