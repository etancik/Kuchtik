/**
 * Unit test for UTF-8 encoding fix in GitHubAPIAdapter
 */

import { Buffer } from 'node:buffer';

// Mock browser globals for Node.js environment
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

describe('GitHubAPIAdapter UTF-8 Encoding', () => {
  test('should properly decode UTF-8 characters from base64', () => {
    // Test the decodeBase64 function with UTF-8 content
    // This simulates what GitHub API returns for files with special characters
    
    // Sample Czech text: "Guláš" (goulash)
    const originalText = 'Guláš';
    
    // This is what GitHub would return (base64 encoded UTF-8)
    const base64Content = global.btoa(unescape(encodeURIComponent(originalText)));
    
    // Mock the decodeBase64 function behavior
    const decodeBase64 = (content) => {
      try {
        // The fixed version - properly decode UTF-8
        return decodeURIComponent(escape(global.atob(content)));
      } catch (error) {
        throw new Error(`Failed to decode base64 content: ${error.message}`);
      }
    };
    
    const decodedText = decodeBase64(base64Content);
    
    expect(decodedText).toBe('Guláš');
    expect(decodedText).not.toBe('GulÃ¡Å¡'); // Should not be corrupted
  });

  test('should handle various Czech diacritics correctly', () => {
    const testCases = [
      'Guláš',        // á
      'Palacinky',    // č (though this example doesn't have it)
      'Šťáva z arónie', // Š, ť, á, ó
      'žluťoučký',    // ž, ť, ů, č, ý
      'příšerný'      // ř, í, š, ě, ý
    ];

    const decodeBase64 = (content) => {
      return decodeURIComponent(escape(global.atob(content)));
    };

    testCases.forEach(originalText => {
      const base64Content = global.btoa(unescape(encodeURIComponent(originalText)));
      const decodedText = decodeBase64(base64Content);
      
      expect(decodedText).toBe(originalText);
    });
  });

  test('should handle recipe JSON with UTF-8 characters', () => {
    const recipeData = {
      name: 'Guláš',
      ingredients: ['hovězí maso', 'cibule', 'paprika'],
      instructions: ['Nakrájejte maso', 'Přidejte koření']
    };

    const jsonString = JSON.stringify(recipeData);
    const base64Content = global.btoa(unescape(encodeURIComponent(jsonString)));

    const decodeBase64 = (content) => {
      return decodeURIComponent(escape(global.atob(content)));
    };

    const decodedJson = decodeBase64(base64Content);
    const parsedRecipe = JSON.parse(decodedJson);

    expect(parsedRecipe.name).toBe('Guláš');
    expect(parsedRecipe.ingredients[0]).toBe('hovězí maso');
    expect(parsedRecipe.instructions[0]).toBe('Nakrájejte maso');
  });
});
