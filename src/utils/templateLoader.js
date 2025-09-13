/**
 * Template Loading Utility
 * Handles loading and caching of HTML templates
 */

class TemplateLoader {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Load HTML template from file
   * @param {string} templatePath - Path to template file
   * @returns {Promise<string>} Template HTML content
   */
  async loadTemplate(templatePath) {
    // Check cache first
    if (this.cache.has(templatePath)) {
      return this.cache.get(templatePath);
    }

    try {
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // Cache the template
      this.cache.set(templatePath, html);
      
      return html;
    } catch (error) {
      console.error(`Error loading template ${templatePath}:`, error);
      throw new Error(`Failed to load template: ${templatePath}`);
    }
  }

  /**
   * Create DOM element from template
   * @param {string} templatePath - Path to template file
   * @returns {Promise<HTMLElement>} DOM element
   */
  async createElement(templatePath) {
    const html = await this.loadTemplate(templatePath);
    const template = document.createElement('div');
    template.innerHTML = html;
    return template.firstElementChild;
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Remove specific template from cache
   * @param {string} templatePath - Path to template file
   */
  removeFromCache(templatePath) {
    this.cache.delete(templatePath);
  }
}

// Export singleton instance
export const templateLoader = new TemplateLoader();
export default templateLoader;
