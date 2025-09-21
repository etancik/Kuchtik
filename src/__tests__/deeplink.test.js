/**
 * Deeplink functionality tests
 */

import { 
  updateUrlForFullscreen, 
  removeFullscreenFromUrl, 
  parseFullscreenUrl,
  handleFullscreenNavigation,
  initializeFullscreenFromUrl
} from '../services/fullscreenRecipe.js';

describe('Deeplink URL Management', () => {
  const originalLocation = window.location;
  const originalHistory = window.history;
  const originalURL = window.URL;
  const originalURLSearchParams = window.URLSearchParams;
  
  // Mock URLSearchParams class
  class MockURLSearchParams {
    constructor(search = '') {
      this.params = new Map();
      if (search.startsWith('?')) {
        search = search.slice(1);
      }
      if (search) {
        search.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key) {
            this.params.set(key, decodeURIComponent(value || ''));
          }
        });
      }
    }
    
    set(key, value) {
      this.params.set(key, value);
    }
    
    delete(key) {
      this.params.delete(key);
    }
    
    get(key) {
      return this.params.get(key);
    }
    
    toString() {
      const params = [];
      this.params.forEach((value, key) => {
        params.push(`${key}=${encodeURIComponent(value)}`);
      });
      return params.join('&');
    }
  }
  
  beforeEach(() => {
    // Mock window.location and history
    delete window.location;
    delete window.history;
    delete window.URL;
    delete window.URLSearchParams;
    
    window.location = {
      search: '',
      href: 'http://localhost:3000/',
      pathname: '/',
      protocol: 'http:',
      host: 'localhost:3000',
      origin: 'http://localhost:3000'
    };
    
    window.history = {
      pushState: jest.fn(),
      replaceState: jest.fn()
    };

    // Mock URL constructor
    window.URL = class MockURL {
      constructor() {
        this.origin = 'http://localhost:3000';
        this.pathname = '/';
        this.searchParams = new MockURLSearchParams(window.location.search);
      }
      
      toString() {
        const params = this.searchParams.toString();
        return params ? `/?${params}` : '/';
      }
    };

    // Mock URLSearchParams
    window.URLSearchParams = MockURLSearchParams;
  });

  afterEach(() => {
    window.location = originalLocation;
    window.history = originalHistory;
    window.URL = originalURL;
    window.URLSearchParams = originalURLSearchParams;
  });

  describe('updateUrlForFullscreen', () => {
    test('should add recipe parameter to URL', () => {
      updateUrlForFullscreen('test-recipe');
      
      expect(window.history.pushState).toHaveBeenCalledWith(
        { fullscreenRecipe: 'test-recipe' },
        '',
        '/?recipe=test-recipe'
      );
    });

    test('should handle existing URL parameters', () => {
      window.location.search = '?existing=param';
      
      updateUrlForFullscreen('test-recipe');
      
      expect(window.history.pushState).toHaveBeenCalledWith(
        { fullscreenRecipe: 'test-recipe' },
        '',
        '/?existing=param&recipe=test-recipe'
      );
    });

    test('should handle recipe IDs with special characters', () => {
      updateUrlForFullscreen('český-recept');
      
      expect(window.history.pushState).toHaveBeenCalledWith(
        { fullscreenRecipe: 'český-recept' },
        '',
        '/?recipe=%C4%8Desk%C3%BD-recept'
      );
    });
  });

  describe('removeFullscreenFromUrl', () => {
    test('should remove recipe parameter from URL', () => {
      window.location.search = '?recipe=test-recipe&other=param';
      
      removeFullscreenFromUrl();
      
      expect(window.history.pushState).toHaveBeenCalledWith(
        null,
        '',
        '/?other=param'
      );
    });

    test('should clear URL when only recipe parameter exists', () => {
      window.location.search = '?recipe=test-recipe';
      
      removeFullscreenFromUrl();
      
      expect(window.history.pushState).toHaveBeenCalledWith(
        null,
        '',
        '/'
      );
    });

    test('should handle URL without recipe parameter', () => {
      window.location.search = '?other=param';
      
      removeFullscreenFromUrl();
      
      expect(window.history.pushState).toHaveBeenCalledWith(
        null,
        '',
        '/?other=param'
      );
    });
  });

  describe('parseFullscreenUrl', () => {
    test('should parse recipe ID from URL', () => {
      window.location.search = '?recipe=test-recipe';
      
      const result = parseFullscreenUrl();
      
      expect(result).toEqual({
        recipeId: 'test-recipe'
      });
    });

    test('should handle URL encoded recipe ID', () => {
      window.location.search = '?recipe=%C4%8Desk%C3%BD-recept';
      
      const result = parseFullscreenUrl();
      
      expect(result).toEqual({
        recipeId: 'český-recept'
      });
    });

    test('should return null when no recipe parameter', () => {
      window.location.search = '?other=param';
      
      const result = parseFullscreenUrl();
      
      expect(result).toBeNull();
    });

    test('should return null when empty URL', () => {
      window.location.search = '';
      
      const result = parseFullscreenUrl();
      
      expect(result).toBeNull();
    });
  });
});

describe('Deeplink Navigation', () => {
  const originalLocation = window.location;
  const originalHistory = window.history;
  
  beforeEach(() => {
    // Mock window.location and history
    delete window.location;
    delete window.history;
    
    window.location = {
      search: '',
      href: 'http://localhost:3000/',
      pathname: '/',
      protocol: 'http:',
      host: 'localhost:3000',
      origin: 'http://localhost:3000'
    };
    
    window.history = {
      pushState: jest.fn(),
      replaceState: jest.fn()
    };

    // Mock addEventListener
    window.addEventListener = jest.fn();
  });

  afterEach(() => {
    window.location = originalLocation;
    window.history = originalHistory;
    jest.clearAllMocks();
  });

  describe('handleFullscreenNavigation', () => {
    test('should set up popstate event listener', () => {
      const mockGetRecipeById = jest.fn();
      
      handleFullscreenNavigation(mockGetRecipeById);
      
      expect(window.addEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });
  });

  describe('initializeFullscreenFromUrl', () => {
    test('should handle URL without recipe parameter', async () => {
      window.location.search = '';
      const mockGetRecipeById = jest.fn();
      
      await initializeFullscreenFromUrl(mockGetRecipeById);
      
      expect(mockGetRecipeById).not.toHaveBeenCalled();
    });

    test('should handle valid recipe URL', async () => {
      // Mock the parseFullscreenUrl function internally
      window.location.search = '?recipe=test-recipe';
      window.URLSearchParams = class MockURLSearchParams {
        constructor() {
          this.params = new Map([['recipe', 'test-recipe']]);
        }
        get(key) {
          return this.params.get(key);
        }
      };
      
      const mockGetRecipeById = jest.fn().mockResolvedValue({ 
        id: 'test-recipe', 
        name: 'Test Recipe' 
      });
      
      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 1;
      });
      
      await initializeFullscreenFromUrl(mockGetRecipeById);
      
      expect(mockGetRecipeById).toHaveBeenCalledWith('test-recipe');
    });
  });
});