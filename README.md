# Kuchtik - Recipe Manager

Simple recipe manager with iOS Shortcuts integration.

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
- 🚧 Modular architecture (in progress)
- 🚧 Unit tests (in progress)

## Browser Support

Modern browsers with ES2022 support.
