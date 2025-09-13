# Kuchtik 🍳

A recipe management application with iOS Shortcuts integration, built with vanilla JavaScript and a modular architecture.

## Features

- 📱 **iOS Shortcuts Integration** - Export ingredients directly to iOS Reminders
- 🔄 **Dynamic Recipe Loading** - Automatically discovers recipes from GitHub repository
- 🃏 **Bootstrap UI** - Clean, responsive card-based interface
- ✅ **Recipe Selection** - Multi-select recipes for batch ingredient export
- 🔍 **GitHub API Integration** - Fetches recipe files dynamically

## Project Structure

```
├── src/
│   ├── components/        # UI components
│   │   └── RecipeCard.js  # Recipe card rendering
│   ├── services/          # External integrations
│   │   └── recipeAPI.js   # GitHub API & data loading
│   ├── utils/             # Utility functions
│   │   ├── recipeUtils.js # Recipe data processing
│   │   └── shortcutsUtils.js # iOS Shortcuts integration
│   ├── __tests__/         # Unit tests
│   └── main.js           # Application entry point
├── recepty/              # Recipe JSON files
├── index.html           # Main HTML file
└── style.css           # Styles
```

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
```bash
npm install
```

### Available Scripts

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode  
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── main.js              # Entry point
├── services/            # API services
├── utils/               # Utility functions  
├── components/          # UI components
└── __tests__/          # Test files
    ├── setup.js        # Jest setup
    └── *.test.js       # Test files
```

### Testing

We use Jest for testing with jsdom environment for DOM testing. All tests should be placed in `src/__tests__/` with `.test.js` extension.

### Linting

ESLint v9 with recommended rules. Configuration in `eslint.config.mjs`.

## Features

- ✅ Load recipes dynamically via GitHub API
- ✅ Export ingredients to iOS Reminders
- ✅ Bootstrap UI with responsive design
- ✅ Modular architecture
- ✅ Unit tests

## Browser Support

Modern browsers with ES2022 support.
