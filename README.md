# Kuchtik 🍳

A recipe management application with iOS Shortcuts integration, built with vanilla JavaScript and a modular architecture.

## Features

- 📱 **iOS Shortcuts Integration** - Export ingredients directly to iOS Reminders
- 🔄 **Dynamic Recipe Loading** - Automatically discovers recipes from GitHub repository
- 🃏 **Bootstrap UI** - Clean, responsive card-based interface
- ✅ **Recipe Selection** - Multi-select recipes for batch ingredient export
- 🔍 **GitHub API Integration** - Fetches recipe files dynamically
- 🆕 **Recipe Creation** - Create new recipes through web UI with GitHub OAuth
- 🔐 **GitHub Authentication** - OAuth Device Flow for secure recipe creation

## Project Structure

```
├── src/
│   ├── components/           # UI components
│   │   ├── RecipeCard.js     # Recipe card rendering
│   │   └── RecipeCreationUI.js # Recipe creation form
│   ├── services/             # External integrations
│   │   ├── recipeAPI.js      # GitHub API & data loading
│   │   ├── githubAuth.js     # GitHub OAuth authentication
│   │   └── recipeCreation.js # Recipe creation service
│   ├── utils/                # Utility functions
│   │   ├── recipeUtils.js    # Recipe data processing
│   │   └── shortcutsUtils.js # iOS Shortcuts integration
│   ├── config/               # Configuration
│   │   └── github.js         # GitHub API configuration
│   ├── __tests__/            # Unit tests
│   └── main.js              # Application entry point
├── recipes/              # Recipe JSON files
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

### GitHub OAuth Configuration

To enable recipe creation, you need to set up GitHub OAuth:

1. **Create GitHub OAuth App**:
   - Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Set Application name: "Kuchtik Recipe App"
   - Set Homepage URL: Your website URL (e.g., `https://your-username.github.io/Kuchtik`)
   - Set Authorization callback URL: Same as homepage URL
   - Click "Register application"

2. **Configure Application**:
   - Copy your Client ID from the OAuth App settings
   - Open `src/config/github.js`
   - Replace `'YOUR_CLIENT_ID_HERE'` with your actual Client ID
   - Update `REPO_OWNER` and `REPO_NAME` if different from defaults

   **Example**:
   ```javascript
   export const CONFIG = {
     GITHUB_CLIENT_ID: 'Ov23abcd1234567890123456', // Your actual Client ID
     REPO_OWNER: 'your-username',
     REPO_NAME: 'your-repo-name',
     // ... rest of config
   };
   ```

   **Note**: Only the Client ID is needed for Device Flow authentication. The Client Secret is not required in the frontend.

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
