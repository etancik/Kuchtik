/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Mock shortcuts utility
const mockOpenShortcut = jest.fn();
jest.unstable_mockModule('../utils/shortcutsUtils.js', () => ({
  openShortcut: mockOpenShortcut
}));

// Mock template loader
const mockLoadTemplate = jest.fn().mockResolvedValue(`
  <div id="ingredientsModal" class="modal">
    <div id="ingredientsList"></div>
    <button id="selectAllIngredients"></button>
    <button id="deselectAllIngredients"></button>
    <button id="exportSelectedIngredients"></button>
    <span id="selectedIngredientsCount">0</span>
    <span id="totalIngredientsCount">0</span>
  </div>
`);

jest.unstable_mockModule('../utils/templateLoader.js', () => ({
  templateLoader: {
    loadTemplate: mockLoadTemplate
  }
}));

// Import after mocking
const { ingredientsExportService } = await import('../services/ingredientsExport.js');

// Mock Bootstrap Modal and Toast
global.bootstrap = {
  Modal: class MockModal {
    constructor() {
      this.isShown = false;
    }
    show() { this.isShown = true; }
    hide() { this.isShown = false; }
  },
  Toast: class MockToast {
    constructor() {}
    show() {}
  }
};

// Mock window.bootstrap
window.bootstrap = global.bootstrap;

// Mock alert
global.alert = jest.fn();

describe('IngredientsExportService', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="ingredientsModal">
        <div id="ingredientsList"></div>
        <button id="selectAllIngredients"></button>
        <button id="deselectAllIngredients"></button>
        <button id="exportSelectedIngredients"></button>
        <span id="selectedIngredientsCount">0</span>
        <span id="totalIngredientsCount">0</span>
      </div>
    `;
    
    // Reset service state
    ingredientsExportService.isInitialized = false;
    ingredientsExportService.modal = null;
    ingredientsExportService.ingredients = [];
    ingredientsExportService.selectedIngredients.clear();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('ingredient selection logic', () => {
    test('should select all ingredients', () => {
      const testIngredients = ['ingredient1', 'ingredient2', 'ingredient3'];
      ingredientsExportService.ingredients = testIngredients;
      ingredientsExportService.selectedIngredients.clear();
      
      ingredientsExportService.selectAllIngredients();
      
      expect(ingredientsExportService.selectedIngredients.size).toBe(3);
      expect(Array.from(ingredientsExportService.selectedIngredients)).toEqual(testIngredients);
    });

    test('should deselect all ingredients', () => {
      const testIngredients = ['ingredient1', 'ingredient2', 'ingredient3'];
      ingredientsExportService.ingredients = testIngredients;
      ingredientsExportService.selectedIngredients = new Set(testIngredients);
      
      ingredientsExportService.deselectAllIngredients();
      
      expect(ingredientsExportService.selectedIngredients.size).toBe(0);
    });

    test('should handle individual ingredient checkbox changes', () => {
      // Setup ingredients first
      const testIngredients = [
        { text: 'test ingredient 1', exportDefault: true },
        { text: 'test ingredient 2', exportDefault: false }
      ];
      ingredientsExportService.ingredients = testIngredients;
      
      const mockCheckbox = {
        dataset: { index: '0' },
        checked: true
      };
      
      ingredientsExportService.handleIngredientCheckboxChange(mockCheckbox);
      
      expect(ingredientsExportService.selectedIngredients.has(testIngredients[0])).toBe(true);
      
      // Test unchecking
      mockCheckbox.checked = false;
      ingredientsExportService.handleIngredientCheckboxChange(mockCheckbox);
      
      expect(ingredientsExportService.selectedIngredients.has(testIngredients[0])).toBe(false);
    });
  });

  describe('HTML escaping', () => {
    test('should escape HTML in ingredients', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const escaped = ingredientsExportService.escapeHtml(maliciousInput);
      
      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    test('should handle normal text without changes', () => {
      const normalText = '500g beef meat';
      const escaped = ingredientsExportService.escapeHtml(normalText);
      
      expect(escaped).toBe('500g beef meat');
    });
  });

  describe('export functionality', () => {
    test('should show alert if no ingredients selected', async () => {
      ingredientsExportService.modal = { hide: jest.fn() };
      ingredientsExportService.selectedIngredients.clear();
      
      await ingredientsExportService.exportSelectedIngredients();
      
      expect(global.alert).toHaveBeenCalledWith('ingredientsExport.noIngredientsSelected');
    });

    test('should export selected ingredients', async () => {
      ingredientsExportService.modal = { hide: jest.fn() };
      ingredientsExportService.showSuccessMessage = jest.fn(); // Mock the success message
      const testIngredients = ['ingredient1', 'ingredient2'];
      ingredientsExportService.selectedIngredients = new Set(testIngredients);
      
      await ingredientsExportService.exportSelectedIngredients();
      
      expect(mockOpenShortcut).toHaveBeenCalledWith(testIngredients);
      expect(ingredientsExportService.modal.hide).toHaveBeenCalled();
    });
  });

  describe('counter updates', () => {
    test('should update selection counter correctly', () => {
      ingredientsExportService.ingredients = ['a', 'b', 'c'];
      ingredientsExportService.selectedIngredients = new Set(['a', 'b']);
      
      ingredientsExportService.updateSelectionCounter();
      
      const selectedCount = document.getElementById('selectedIngredientsCount');
      const totalCount = document.getElementById('totalIngredientsCount');
      
      expect(selectedCount.textContent).toBe('2');
      expect(totalCount.textContent).toBe('3');
    });

    test('should disable export button when no ingredients selected', () => {
      ingredientsExportService.selectedIngredients.clear();
      
      ingredientsExportService.updateSelectionCounter();
      
      const exportBtn = document.getElementById('exportSelectedIngredients');
      expect(exportBtn.disabled).toBe(true);
    });

    test('should enable export button when ingredients are selected', () => {
      ingredientsExportService.selectedIngredients.add('test ingredient');
      
      ingredientsExportService.updateSelectionCounter();
      
      const exportBtn = document.getElementById('exportSelectedIngredients');
      expect(exportBtn.disabled).toBe(false);
    });
  });

  describe('exportDefault flag integration', () => {
    test('should respect exportDefault flags from recipe ingredients', async () => {
      // Simulate gulas recipe ingredients
      const gulasIngredients = [
        { text: "500 g hovězí kližky", exportDefault: true },
        { text: "2 cibule", exportDefault: true },
        { text: "2 stroužky česneku", exportDefault: true },
        { text: "1 lžíce sladké papriky", exportDefault: true },
        { text: "olej", exportDefault: false },
        { text: "sůl", exportDefault: false },
        { text: "pepř", exportDefault: false }
      ];

      await ingredientsExportService.showModal(gulasIngredients);

      // Check that selected ingredients match exportDefault flags
      const selectedArray = Array.from(ingredientsExportService.selectedIngredients);
      const selectedTexts = selectedArray.map(ing => ing.text);

      expect(selectedTexts).toContain("500 g hovězí kližky");
      expect(selectedTexts).toContain("2 cibule");
      expect(selectedTexts).toContain("2 stroužky česneku");
      expect(selectedTexts).toContain("1 lžíce sladké papriky");
      expect(selectedTexts).not.toContain("olej");
      expect(selectedTexts).not.toContain("sůl");
      expect(selectedTexts).not.toContain("pepř");

      expect(ingredientsExportService.selectedIngredients.size).toBe(4);
    });

    test('should render checkboxes with correct checked state based on exportDefault', async () => {
      const ingredients = [
        { text: "test ingredient 1", exportDefault: true },
        { text: "test ingredient 2", exportDefault: false }
      ];

      await ingredientsExportService.showModal(ingredients);

      const checkboxes = document.querySelectorAll('.ingredient-checkbox');
      expect(checkboxes).toHaveLength(2);
      
      expect(checkboxes[0].checked).toBe(true);  // exportDefault: true
      expect(checkboxes[1].checked).toBe(false); // exportDefault: false
    });

    test('should handle object ingredients with explicit exportDefault flags', async () => {
      const ingredients = [
        { text: "test ingredient 1", exportDefault: true },
        { text: "test ingredient 2", exportDefault: false }
      ];

      await ingredientsExportService.showModal(ingredients);

      const selectedArray = Array.from(ingredientsExportService.selectedIngredients);
      expect(selectedArray).toHaveLength(1);
      expect(selectedArray[0].text).toBe("test ingredient 1");
    });

    test('should preserve exportDefault through normalization pipeline', async () => {
      const ingredients = [
        { text: "2 cibule", exportDefault: true },
        { text: "1 cibule", exportDefault: false }, // Same ingredient name, different exportDefault
        { text: "olej", exportDefault: false }
      ];

      await ingredientsExportService.showModal(ingredients);

      // Should have 3 ingredients (no merging)
      expect(ingredientsExportService.ingredients).toHaveLength(3);

      const onionIngredient1 = ingredientsExportService.ingredients.find(ing => ing.text === '2 cibule');
      const onionIngredient2 = ingredientsExportService.ingredients.find(ing => ing.text === '1 cibule');
      const oilIngredient = ingredientsExportService.ingredients.find(ing => ing.text === 'olej');

      expect(onionIngredient1.exportDefault).toBe(true);
      expect(onionIngredient2.exportDefault).toBe(false);
      expect(oilIngredient.exportDefault).toBe(false);

      // Only ingredients with exportDefault: true should be selected
      expect(ingredientsExportService.selectedIngredients.size).toBe(1);
    });
  });
});
