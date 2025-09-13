import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        encodeURIComponent: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        btoa: 'readonly',
        unescape: 'readonly',
        confirm: 'readonly',
        location: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.test.js', 'src/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        global: 'readonly',
      },
    },
  },
];
