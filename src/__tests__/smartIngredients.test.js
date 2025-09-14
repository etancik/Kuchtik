/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { 
  parseIngredient, 
  scaleIngredient,
  normalizeIngredientsList
} from '../utils/smartIngredients.js';

describe('Smart Ingredients Processing', () => {
  describe('parseIngredient', () => {
    it('should parse ingredient with amount and unit', () => {
      const result = parseIngredient('500 g hovězí kližky');
      
      expect(result).toEqual({
        text: '500 g hovězí kližky',
        amount: 500,
        unit: 'g',
        ingredient: 'hovězí kližky'
      });
    });

    it('should parse ingredient with fractional amount', () => {
      const result = parseIngredient('0.5 kg másla');
      
      expect(result).toEqual({
        text: '0.5 kg másla',
        amount: 0.5,
        unit: 'kg',
        ingredient: 'másla'
      });
    });

    it('should parse ingredient with count units', () => {
      const result = parseIngredient('2 stroužky česneku');
      
      expect(result).toEqual({
        text: '2 stroužky česneku',
        amount: 2,
        unit: 'stroužky',
        ingredient: 'česneku'
      });
    });

    it('should handle complex units', () => {
      const result = parseIngredient('1 lžíce olivového oleje');
      
      expect(result).toEqual({
        text: '1 lžíce olivového oleje',
        amount: 1,
        unit: 'lžíce',
        ingredient: 'olivového oleje'
      });
    });

    it('should handle ingredient without amount', () => {
      const result = parseIngredient('sůl podle chuti');
      
      expect(result).toEqual({
        text: 'sůl podle chuti',
        amount: null,
        unit: null,
        ingredient: 'sůl podle chuti'
      });
    });

    it('should handle descriptive amounts', () => {
      const result = parseIngredient('špetka soli');
      
      expect(result).toEqual({
        text: 'špetka soli',
        amount: 1,
        unit: 'špetka',
        ingredient: 'soli'
      });
    });
  });

  describe('scaleIngredient', () => {
    it('should scale ingredient with amount proportionally', () => {
      const ingredient = {
        text: '500 g mouky',
        parsed: { amount: 500, unit: 'g', ingredient: 'mouky' }
      };
      
      const result = scaleIngredient(ingredient, 2);
      
      expect(result.text).toBe('1000 g mouky');
      expect(result.parsed.amount).toBe(1000);
    });

    it('should handle fractional scaling', () => {
      const ingredient = {
        text: '4 vejce',
        parsed: { amount: 4, unit: 'ks', ingredient: 'vejce' }
      };
      
      const result = scaleIngredient(ingredient, 0.5);
      
      expect(result.text).toBe('2 vejce');
      expect(result.parsed.amount).toBe(2);
    });

    it('should not scale ingredients without amount', () => {
      const ingredient = {
        text: 'sůl podle chuti',
        parsed: { amount: null, unit: null, ingredient: 'sůl podle chuti' }
      };
      
      const result = scaleIngredient(ingredient, 2);
      
      expect(result.text).toBe('sůl podle chuti');
      expect(result.parsed).toEqual({ amount: null, unit: null, ingredient: 'sůl podle chuti' });
    });

    it('should handle decimal results properly', () => {
      const ingredient = {
        text: '3 vejce',
        parsed: { amount: 3, unit: 'ks', ingredient: 'vejce' }
      };
      
      const result = scaleIngredient(ingredient, 0.5);
      
      expect(result.text).toBe('1.5 vejce');
      expect(result.parsed.amount).toBe(1.5);
    });
  });

  describe('normalizeIngredientsList', () => {
    it('should handle objects with explicit exportDefault values', () => {
      const ingredients = [
        { text: '500 g mouky', exportDefault: true },
        { text: 'sůl', exportDefault: false },
        { text: 'pepř', exportDefault: true }
      ];
      const result = normalizeIngredientsList(ingredients);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        text: '500 g mouky',
        exportDefault: true,
        amount: 500,
        unit: 'g',
        ingredient: 'mouky'
      });
      expect(result[1]).toMatchObject({
        text: 'sůl',
        exportDefault: false,
        amount: null,
        unit: null,
        ingredient: 'sůl'
      });
      expect(result[2]).toMatchObject({
        text: 'pepř',
        exportDefault: true,
        amount: null,
        unit: null,
        ingredient: 'pepř'
      });
    });

    it('should handle objects without exportDefault property defaulting to true', () => {
      const ingredients = [
        { text: '500 g hovězí kližky' },
        { text: 'olej' }
      ];
      const result = normalizeIngredientsList(ingredients);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        text: '500 g hovězí kližky',
        exportDefault: true,
        amount: 500,
        unit: 'g',
        ingredient: 'hovězí kližky'
      });
      expect(result[1]).toMatchObject({
        text: 'olej',
        exportDefault: true,
        amount: null,
        unit: null,
        ingredient: 'olej'
      });
    });

    it('should preserve all ingredient properties after normalization', () => {
      const ingredients = [
        { text: '2 cibule', exportDefault: true },
        { text: '1 lžíce sladké papriky', exportDefault: true },
        { text: 'sůl', exportDefault: false }
      ];
      const result = normalizeIngredientsList(ingredients);
      
      expect(result[0]).toMatchObject({
        text: '2 cibule',
        exportDefault: true,
        amount: 2,
        unit: 'ks',
        ingredient: 'cibule'
      });
      expect(result[1]).toMatchObject({
        text: '1 lžíce sladké papriky',
        exportDefault: true,
        amount: 1,
        unit: 'lžíce',
        ingredient: 'sladké papriky'
      });
      expect(result[2]).toMatchObject({
        text: 'sůl',
        exportDefault: false,
        amount: null,
        unit: null,
        ingredient: 'sůl'
      });
    });

    it('should handle gulas recipe format correctly', () => {
      const gulasIngredients = [
        { text: "500 g hovězí kližky", exportDefault: true },
        { text: "2 cibule", exportDefault: true },
        { text: "2 stroužky česneku", exportDefault: true },
        { text: "1 lžíce sladké papriky", exportDefault: true },
        { text: "olej", exportDefault: false },
        { text: "sůl", exportDefault: false },
        { text: "pepř", exportDefault: false }
      ];
      const result = normalizeIngredientsList(gulasIngredients);
      
      expect(result).toHaveLength(7);
      
      // Check that exportDefault flags are preserved
      const selectedByDefault = result.filter(ing => ing.exportDefault);
      const notSelectedByDefault = result.filter(ing => !ing.exportDefault);
      
      expect(selectedByDefault).toHaveLength(4); // meat, onions, garlic, paprika
      expect(notSelectedByDefault).toHaveLength(3); // oil, salt, pepper
      
      expect(result[0].exportDefault).toBe(true); // hovězí kližky
      expect(result[4].exportDefault).toBe(false); // olej
      expect(result[5].exportDefault).toBe(false); // sůl
      expect(result[6].exportDefault).toBe(false); // pepř
    });

    it('should handle empty array', () => {
      expect(normalizeIngredientsList([])).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(normalizeIngredientsList(null)).toEqual([]);
      expect(normalizeIngredientsList(undefined)).toEqual([]);
      expect(normalizeIngredientsList('not an array')).toEqual([]);
    });

    it('should log warning and handle unsupported string format as fallback', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const ingredients = ['500 g mouky']; // String format (unsupported)
      const result = normalizeIngredientsList(ingredients);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unsupported ingredient format. Expected object with "text" property:',
        '500 g mouky'
      );
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        text: '500 g mouky',
        exportDefault: true // Fallback behavior
      });
      
      consoleSpy.mockRestore();
    });
  });
});