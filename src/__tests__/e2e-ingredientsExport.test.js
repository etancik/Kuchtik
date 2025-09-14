/**
 * End-to-End Integration Tests for Ingredients Export
 * Tests the complete workflow from recipe display to final export
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockTemplateLoader = {
  loadTemplate: jest.fn().mockResolvedValue(`
    <div class="modal fade" id="ingredientsModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Export Ingredients</h5>
          </div>
          <div class="modal-body">
            <!-- Select All / Deselect All -->
            <button id="selectAllIngredients">Select All</button>
            <button id="deselectAllIngredients">Deselect All</button>
            
            <!-- Ingredients list -->
            <div id="ingredientsList"></div>
            
            <!-- Selection counter -->
            <span id="selectedIngredientsCount">0</span>
            <span id="totalIngredientsCount">0</span>
          </div>
          <div class="modal-footer">
            <button id="exportSelectedIngredients">Export</button>
          </div>
        </div>
      </div>
    </div>
  `)
};

const mockShortcutsUtils = {
  openShortcut: jest.fn().mockResolvedValue(true)
};

const mockI18n = {
  t: jest.fn((key, params = {}) => {
    const translations = {
      'ingredientsExport.noIngredientsSelected': 'Please select ingredients',
      'ingredientsExport.exportSuccess': `${params.count} ingredient${params.plural} exported`,
      'ingredientsExport.exportError': 'Export failed'
    };
    return translations[key] || key;
  })
};

// Mock the imports
jest.unstable_mockModule('../utils/templateLoader.js', () => ({
  templateLoader: mockTemplateLoader
}));

jest.unstable_mockModule('../utils/shortcutsUtils.js', () => mockShortcutsUtils);

jest.unstable_mockModule('../i18n/i18n.js', () => mockI18n);

// Mock Bootstrap Modal
global.bootstrap = {
  Modal: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn()
  }))
};

global.alert = jest.fn();

// Import the module under test
const { default: ingredientsExportService } = await import('../services/ingredientsExport.js');

describe('End-to-End Ingredients Export Integration', () => {
  let service;
  
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    jest.clearAllMocks();
    
    // Insert the mock template into the DOM so getElementById works
    document.body.innerHTML = `
      <div class="modal fade" id="ingredientsModal">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Export Ingredients</h5>
            </div>
            <div class="modal-body">
              <!-- Select All / Deselect All -->
              <button id="selectAllIngredients">Select All</button>
              <button id="deselectAllIngredients">Deselect All</button>
              
              <!-- Ingredients list -->
              <div id="ingredientsList"></div>
              
              <!-- Selection counter -->
              <span id="selectedIngredientsCount">0</span>
              <span id="totalIngredientsCount">0</span>
            </div>
            <div class="modal-footer">
              <button id="exportSelectedIngredients">Export</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Reset service state
    ingredientsExportService.selectedIngredients.clear();
    ingredientsExportService.ingredientsList = [];
    ingredientsExportService.portionScale = 1;
    
    service = ingredientsExportService;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Complete Export Workflow', () => {
    test('should handle complete workflow from mixed ingredients to export', async () => {
      // Test data: Mixed format ingredients (strings and objects)
      const mixedIngredients = [
        '500g beef',                              // Legacy string format
        { text: '200g onions', exportDefault: true },    // Object format with export
        { text: '2 tbsp oil' },                   // Object format, should get default true
        { text: '1 tsp salt', exportDefault: false },    // Explicit false
        { text: '2 cups water', exportDefault: true }     // Explicit true
      ];

      // Step 1: Show the modal - this should initialize everything
      await service.showModal(mixedIngredients);

      // Verify template loading and modal initialization
      expect(mockTemplateLoader.loadTemplate).toHaveBeenCalledWith('src/templates/ingredients-modal.html');
      expect(global.bootstrap.Modal).toHaveBeenCalled();

      // Step 2: Verify ingredients were normalized and processed correctly
      expect(service.ingredients).toHaveLength(5);
      
      // Check that legacy strings were converted to objects
      expect(service.ingredients.every(ing => typeof ing === 'object' && ing.text)).toBe(true);
      
      // Check export defaults were applied correctly
      const exportDefaults = service.ingredients.map(ing => ing.exportDefault);
      expect(exportDefaults).toEqual([true, true, true, false, true]); // beef, onions, oil get defaults, salt explicit false, water explicit true

      // Step 3: Verify selected ingredients match exportDefault
      const selectedTexts = Array.from(service.selectedIngredients).map(ing => ing.text);
      expect(selectedTexts).toContain('500g beef');
      expect(selectedTexts).toContain('200g onions');
      expect(selectedTexts).toContain('2 tbsp oil');
      expect(selectedTexts).not.toContain('1 tsp salt'); // exportDefault: false
      expect(selectedTexts).toContain('2 cups water');
    });

    test('should handle ingredient selection properly', async () => {
      const ingredients = [
        { text: '100ml milk', exportDefault: false },
        { text: '50g flour', exportDefault: true }
      ];

      await service.showModal(ingredients);

      // Verify initial selection based on exportDefault
      expect(service.selectedIngredients.size).toBe(1);
      const selectedTexts = Array.from(service.selectedIngredients).map(ing => ing.text);
      expect(selectedTexts).toContain('50g flour');
      expect(selectedTexts).not.toContain('100ml milk');

      // Test service methods for selecting ingredients
      service.selectedIngredients.clear();
      service.ingredients.forEach(ingredient => {
        service.selectedIngredients.add(ingredient);
      });
      
      expect(service.selectedIngredients.size).toBe(2);
    });

    test('should handle grouped recipes export workflow', async () => {
      // Test the core grouped recipes functionality
      const groupedRecipes = [
        {
          recipeId: 'recipe1',
          name: 'Simple Recipe',
          defaultScale: 1,
          ingredients: [
            { text: '200ml milk', exportDefault: true },
            { text: '100g flour', exportDefault: true }
          ]
        }
      ];

      // Verify the service can handle grouped recipes  
      await service.showModalWithGroupedRecipes(groupedRecipes);
      
      // Check that grouped recipes data is stored
      expect(service.groupedRecipes).toBeDefined();
      expect(service.groupedRecipes).toHaveLength(1);
      expect(service.recipeScales).toBeDefined();
      expect(service.recipeScales.get('recipe1')).toBe(1);

      // Verify that ingredients are processed correctly
      expect(service.ingredients).toBeDefined();
      expect(service.ingredients.length).toBeGreaterThan(0);
    });

    test('should handle complex ingredient formats', async () => {
      const complexIngredients = [
        { text: '1 1/2 cups sugar', exportDefault: true },
        { text: '2-3 medium tomatoes', exportDefault: true },
        { text: 'Salt to taste', exportDefault: false },
        { text: '1/4 teaspoon vanilla extract', exportDefault: true }
      ];

      await service.showModal(complexIngredients);

      // Verify complex ingredients are processed correctly
      expect(service.ingredients).toHaveLength(4);
      expect(service.ingredients.every(ing => typeof ing === 'object' && ing.text)).toBe(true);
      
      // Check selection matches exportDefault flags
      const selectedTexts = Array.from(service.selectedIngredients).map(ing => ing.text);
      expect(selectedTexts).toContain('1 1/2 cups sugar');
      expect(selectedTexts).toContain('2-3 medium tomatoes');
      expect(selectedTexts).not.toContain('Salt to taste'); // exportDefault: false
      expect(selectedTexts).toContain('1/4 teaspoon vanilla extract');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty ingredients list gracefully', async () => {
      await service.showModal([]);

      const ingredientsList = document.getElementById('ingredientsList');
      // Should show some kind of no ingredients message
      expect(ingredientsList.innerHTML).toContain('ingredients');

      const totalCount = document.getElementById('totalIngredientsCount');
      expect(totalCount.textContent).toBe('0');
    });

    test('should handle empty selection properly', async () => {
      const ingredients = [
        { text: '100g flour', exportDefault: false }
      ];

      await service.showModal(ingredients);

      // Verify no ingredients are selected when all have exportDefault: false
      expect(service.selectedIngredients.size).toBe(0);

      // Test that service state is correct
      expect(service.ingredients).toHaveLength(1);
      expect(service.ingredients[0].exportDefault).toBe(false);
    });
  });
});
