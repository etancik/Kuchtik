# Kuchtik 🍳

A recipe management web application with iOS Shortcuts integration, built with vanilla JavaScript.

## Features

- **Recipe Management**: Create, edit, and delete recipes with form validation
- **GitHub Storage**: Recipes stored as JSON files in GitHub repository
- **iOS Shortcuts Export**: Export selected recipe ingredients to iOS Shortcuts (can forward to Reminders)
- **Search**: Filter recipes by name, tags, and ingredients with highlighting
- **Internationalization**: Czech and English language support
- **Drag & Drop**: Reorder recipe steps in the editor
- **Caching**: 5-minute client-side caching for faster loading
- **Authentication**: GitHub Personal Access Token authentication

## Architecture

Three-layer architecture:

1. **RecipeRepository** (`src/repositories/RecipeRepository.js`)
   - Recipe CRUD operations
   - Client-side caching (5 minute expiry)
   - Event emission for UI updates

2. **GitHubAPIAdapter** (`src/adapters/GitHubAPIAdapter.js`)
   - GitHub API communication
   - Multiple loading strategies with fallbacks
   - UTF-8 encoding handling

3. **RecipeUI** (`src/components/RecipeUI.js`)
   - Form handling and validation
   - Drag & drop functionality
   - Modal management

## Project Structure

├── src/
│   ├── main.js                   # Application entry point
│   ├── repositories/             # Data access layer
│   ├── adapters/                 # GitHub API integration
│   ├── components/               # UI components (RecipeCard, RecipeUI)
│   ├── services/                 # Business services
│   ├── utils/                    # Utility functions
│   ├── templates/                # HTML templates
│   ├── i18n/                     # Translation files
│   ├── config/                   # Configuration
│   └── __tests__/                # Test files
├── recipes/                      # Recipe JSON files
├── index.html                    # Main HTML
└── style.css                     # Styles

## Setup

**Requirements:**
- Node.js (v18+)
- Modern browser with ES modules support

**Install:**
```bash
npm install
npm test  # Verify setup
```

**Run:**
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## GitHub Authentication

To create/edit recipes, authenticate with GitHub:

1. **Create Personal Access Token:**
   - Go to [GitHub Settings → Personal access tokens](https://github.com/settings/tokens/new)
   - Generate new token (classic)
   - Select scopes: `repo` and `user`

2. **Configure:**
   - Update `src/config/github.js` with your repository details
   - Click "Sign In" in the app and paste your token

## Available Scripts

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # Check code style
npm run lint:fix      # Fix style issues
```

## API Usage

**RecipeRepository:**
```javascript
const repo = new RecipeRepository();
const recipes = await repo.getAll();
const recipe = await repo.get('recipe-id');
await repo.create(recipeData);
await repo.update('recipe-id', recipeData);
await repo.delete('recipe-id');
```

**Events:**
```javascript
repo.on('recipesUpdated', (recipes) => {
  // Handle recipe list changes
});
```

## Testing

214+ tests across 20 test files covering:
- Unit tests for utilities and services
- Integration tests for component interactions
- Repository caching and event system
- Form validation and error handling

## Development Features

**Caching:**
- 5-minute client-side cache
- Automatic cache invalidation
- Debug tools: `recipeUI.showCacheStatus()`

**Internationalization:**
- Language files in `src/i18n/locales/`
- Runtime language switching
- Translation helper: `t('key')`

**Error Handling:**
- Network failure fallbacks
- GitHub API rate limiting
- Validation error display

## Technical Details

**Browser Support:** Modern browsers with ES2022 support
**Dependencies:** Jest, ESLint, Prettier (dev only)
**Deployment:** Static files, no build process required

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License - see the [LICENSE](LICENSE) file for details.

This license allows you to use, copy, modify, and distribute this software freely for non-commercial purposes, provided that you give appropriate credit. **Commercial use, selling, or reselling is strictly prohibited.**