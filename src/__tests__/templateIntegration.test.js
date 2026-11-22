/**
 * Simple integration tests for import/export patterns
 * Focuses on catching the bugs we fixed without complex DOM mocking
 */

describe('Import/Export Pattern Validation', () => {
  describe('TemplateLoader export patterns', () => {
    test('should export templateLoader singleton correctly', async () => {
      const { templateLoader } = await import('../utils/templateLoader.js');
      
      expect(templateLoader).toBeDefined();
      expect(typeof templateLoader.loadTemplate).toBe('function');
    });

    test('should not export individual loadTemplate function', async () => {
      try {
        const { loadTemplate } = await import('../utils/templateLoader.js');
        // If this doesn't throw, it means loadTemplate is incorrectly exported
        expect(loadTemplate).toBeUndefined();
      } catch (error) {
        // This is expected - loadTemplate should not be directly exportable
        expect(error.message).toContain('does not provide an export named \'loadTemplate\'');
      }
    });
  });
});
