/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Mock shortcuts utility
const mockOpenShortcut = jest.fn();
jest.unstable_mockModule('../utils/shortcutsUtils.js', () => ({
  openShortcut: mockOpenShortcut
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
      const mockCheckbox = {
        value: 'test ingredient',
        checked: true
      };
      
      ingredientsExportService.handleIngredientCheckboxChange(mockCheckbox);
      
      expect(ingredientsExportService.selectedIngredients.has('test ingredient')).toBe(true);
      
      // Test unchecking
      mockCheckbox.checked = false;
      ingredientsExportService.handleIngredientCheckboxChange(mockCheckbox);
      
      expect(ingredientsExportService.selectedIngredients.has('test ingredient')).toBe(false);
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
});
