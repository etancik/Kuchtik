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

## Cloudflare deployment

The Worker serves the public catalog and the Access-protected editor at `/admin/` from the same D1 database. MCP uses the same store on its own hostname. Read a recipe before updating it and send its revision with the change. On a conflict, reload the recipe before saving.

| Environment | Worker branch | Database | Access |
| --- | --- | --- | --- |
| Production | `main` | `tancer-kuchtik-production` | Public catalog, protected `/admin/` and MCP |
| Working preview | Working branch | `tancer-kuchtik-preview` | Access-protected catalog, read-only |
| Integration preview | `kuchtik-preview` | `tancer-kuchtik-preview` | Access-protected editor and MCP when the integration hostname is configured |

### Import existing recipes

Run these commands from the reviewed checkout containing the desired `recipes/*.json` snapshot. Seed the preview first. Before production cutover, seed production from the final Git snapshot and compare the source count with D1.

```sh
node scripts/seed-recipes.mjs recipes-seed.sql
npx wrangler@4.151.2 d1 execute tancer-kuchtik-preview --remote --file migrations/0001_recipes.sql
npx wrangler@4.151.2 d1 execute tancer-kuchtik-preview --remote --file recipes-seed.sql
npx wrangler@4.151.2 d1 execute tancer-kuchtik-preview --remote --command "SELECT count(*) FROM recipes"
```

For production use the same three Wrangler commands with `tancer-kuchtik-production`. Import is additive, so retrying it preserves existing rows. Run the import only during setup to avoid recreating a recipe deleted after cutover. Keep the generated SQL outside Git. Git JSONs remain the pre-cutover snapshot. D1 becomes the source after cutover.

For Workers Builds use `npm run build`, `npm run preview` and `npm run deploy`. Keep the Worker Access mode set to Previews only and protect the production `/admin` path and its descendants. Only the configured `PREVIEW_INTEGRATION_HOST` permits preview writes. For MCP configure Managed OAuth, `ACCESS_MCP_AUD` and `MCP_WRITER_EMAIL` on the intended environment. Set `ACCESS_ISSUER` and `ACCESS_WEB_AUD` for the editor.

Before cutover, check the public catalog, editor login, saving and a stale revision on preview. Verify MCP if its hostname is configured. After production serves D1, set `KUCHTIK_PAGES_REDIRECT=1` and run the GitHub Pages workflow to redirect the legacy URL, preserving query and fragment.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License - see the [LICENSE](LICENSE) file for details.

This license allows you to use, copy, modify, and distribute this software freely for non-commercial purposes, provided that you give appropriate credit. **Commercial use, selling, or reselling is strictly prohibited.**