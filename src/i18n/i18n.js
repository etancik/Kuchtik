/**
 * Internationalization (i18n) system
 * Supports English (en) and Czech (cs) languages
 */

class I18n {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.fallbackLanguage = 'en';
  }

  /**
   * Initialize i18n system
   */
  async initialize() {
    // Load saved language preference or detect from browser
    this.currentLanguage = this.getSavedLanguage() || this.detectBrowserLanguage();
    
    // Load translations for current language
    await this.loadTranslations(this.currentLanguage);
    
    // Load fallback language if different
    if (this.currentLanguage !== this.fallbackLanguage) {
      await this.loadTranslations(this.fallbackLanguage);
    }

    console.log('🌍 i18n initialized with language:', this.currentLanguage);
  }

  /**
   * Get saved language preference from localStorage
   */
  getSavedLanguage() {
    return localStorage.getItem('kuchtik-language');
  }

  /**
   * Detect browser language
   */
  detectBrowserLanguage() {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('cs')) {
      return 'cs';
    }
    return 'en'; // Default to English
  }

  /**
   * Load translations for a specific language
   */
  async loadTranslations(language) {
    try {
      const response = await fetch(`src/i18n/locales/${language}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${language}`);
      }
      
      const translations = await response.json();
      this.translations[language] = translations;
      
      console.log(`✅ Loaded ${language} translations`);
    } catch (error) {
      console.error(`❌ Failed to load translations for ${language}:`, error);
    }
  }

  /**
   * Get translation for a key
   * @param {string} key - Translation key (dot notation supported)
   * @param {Object} params - Parameters to replace in translation
   * @returns {string} Translated text
   */
  t(key, params = {}) {
    let translation = this.getNestedValue(this.translations[this.currentLanguage], key);
    
    // Fallback to fallback language if translation not found
    if (!translation && this.currentLanguage !== this.fallbackLanguage) {
      translation = this.getNestedValue(this.translations[this.fallbackLanguage], key);
    }
    
    // Final fallback to key itself
    if (!translation) {
      console.warn(`🔸 Missing translation for key: ${key}`);
      return key;
    }

    // Replace parameters in translation
    return this.interpolate(translation, params);
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Replace parameters in translation string
   */
  interpolate(text, params) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Change language
   */
  async setLanguage(language) {
    if (language === this.currentLanguage) return;

    this.currentLanguage = language;
    localStorage.setItem('kuchtik-language', language);

    // Load translations if not already loaded
    if (!this.translations[language]) {
      await this.loadTranslations(language);
    }

    // Trigger language change event
    this.onLanguageChange();
    
    console.log('🔄 Language changed to:', language);
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'cs', name: 'Czech', nativeName: 'Čeština' }
    ];
  }

  /**
   * Override this method to handle language changes
   */
  onLanguageChange() {
    // Update HTML translations
    this.updateHTMLTranslations();
    
    // Reload page to apply new language for dynamic content
    // In a more sophisticated app, this could update all dynamic content
    setTimeout(() => window.location.reload(), 100);
  }

  /**
   * Update HTML translations without page reload
   */
  updateHTMLTranslations() {
    // Update document language
    document.documentElement.lang = this.currentLanguage;
    
    // Update title
    document.title = this.t('recipes.title');
    
    // Update all elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });
  }

  /**
   * Format numbers according to current locale
   */
  formatNumber(number) {
    const locale = this.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US';
    return new Intl.NumberFormat(locale).format(number);
  }

  /**
   * Get plural form based on count and current language
   */
  plural(count, singular, plural, genitivePlural = null) {
    if (this.currentLanguage === 'cs') {
      // Czech plural rules
      if (count === 1) return singular;
      if (count >= 2 && count <= 4) return plural;
      return genitivePlural || plural;
    } else {
      // English plural rules
      return count === 1 ? singular : plural;
    }
  }
}

// Create and export singleton instance
export const i18n = new I18n();

// Make it available globally for templates
window.i18n = i18n;

// Export translation function for convenience
export const t = (key, params) => i18n.t(key, params);
