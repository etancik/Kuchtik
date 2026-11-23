# Kuchtik 🍳

A recipe management web application with iOS Shortcuts integration, built with vanilla JavaScript.

## Features

- **Recipe Management**: Create, edit, and delete recipes with form validation
- **Storage**: Recipes stored in Cloudflare D1
- **iOS Shortcuts Export**: Export selected recipe ingredients to iOS Shortcuts (can forward to Reminders)
- **Search**: Filter recipes by name, tags, and ingredients with highlighting
- **Internationalization**: Czech and English language support
- **Drag & Drop**: Reorder recipe steps in the editor
- **Caching**: 5-minute client-side caching for faster loading
- **Authentication**: Cloudflare Access protects editing

## Architecture

Three-layer architecture:

1. **RecipeRepository** (`src/repositories/RecipeRepository.js`)
   - Recipe CRUD operations
   - Client-side caching (5 minute expiry)
   - Event emission for UI updates

2. **Cloudflare Worker** (`worker/index.js`)
   - Public recipe catalog and protected editing API
   - Persists recipes in D1

3. **RecipeUI** (`src/components/RecipeUI.js`)
   - Form handling and validation
   - Drag & drop functionality
   - Modal management

## Project Structure

├── src/
│   ├── main.js                   # Application entry point
│   ├── repositories/             # Data access layer
│   ├── components/               # UI components (RecipeCard, RecipeUI)
│   ├── services/                 # Business services
│   ├── utils/                    # Utility functions
│   ├── templates/                # HTML templates
│   ├── i18n/                     # Translation files
│   ├── config/                   # Configuration
│   └── __tests__/                # Test files
├── index.html                    # Main HTML
├── style.css                     # Styles
└── worker/                       # Cloudflare Worker

## Setup

**Requirements:**
- Node.js 22.12+
- Modern browser with ES modules support

**Install:**
```bash
npm install
npm test  # Verify setup
```

**Preview:** Open the Access-protected URL from Cloudflare Workers Builds.

## Available Scripts

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # Check code style
npm run knip          # Check for unused code and dependencies
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

The test suite covers:
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
- Validation error display

## Technical Details

**Browser Support:** Modern browsers with ES2022 support
**Dependencies:** Jest, ESLint, Knip and Prettier for development
**Deployment:** Cloudflare Workers with D1

## Cloudflare deployment

The Worker serves the public catalog and the Access-protected editor at `/admin/` from the same D1 database. MCP uses the same store at `https://kuchtik.tancer.cz/mcp`. The Worker also recognizes the former MCP hostname during the transition. Read a recipe before updating it and send its revision with the change. On a conflict, reload the recipe before saving.

| Environment | Worker branch | Database | Access |
| --- | --- | --- | --- |
| Production | `main` | `tancer-kuchtik-production` | Public catalog, protected `/admin/` and MCP |
| Working preview | Working branch | `tancer-kuchtik-preview` | Access-protected catalog, read-only |
| Integration preview | `kuchtik-preview` | `tancer-kuchtik-preview` | Access-protected editor and MCP when the integration hostname is configured |

### Connect the private Kuchtík plugin

Kuchtík follows the same setup as [Rodokmen](https://github.com/etancik/family-tree/blob/main/docs/direct-mcp.md). A private ChatGPT plugin connects directly to the Worker through Cloudflare Access Managed OAuth. Every account allowed by the MCP Access policy can search, read, create, and update recipes.

1. In Cloudflare Zero Trust, inspect the existing MCP Access application. Add the exact destination `kuchtik.tancer.cz/mcp` to that application if it can be reused. If a dedicated application is needed, use the intended MCP user policy and set the production Worker’s `ACCESS_MCP_AUD` to its audience. Keep the editor’s Access application and audience separate.
2. Enable Managed OAuth for that MCP application and allow the ChatGPT callback `https://chatgpt.com/connector/oauth/*`. Keep the public catalog outside the MCP Access application. Access serves OAuth discovery and handles sign-in and token refresh.
3. Verify that an anonymous MCP `initialize` request returns `401` with a Bearer `WWW-Authenticate` challenge containing `resource_metadata`. Open that metadata URL in the browser and check that `resource` matches the exact MCP endpoint and that `authorization_servers` lists the OAuth issuer.
4. In ChatGPT Plugins, create a private custom MCP plugin named **Kuchtík**. Set the server URL to `https://kuchtik.tancer.cz/mcp` and select **OAuth**. Install and connect it, then start a new chat and use `@Kuchtík` to search for Langoše and read the recipe. Verify the public catalog and protected editor separately.
5. Switch any remaining clients to the new URL after the plugin can read a recipe. Only then retire the former destination.

### Import existing recipes

Use an explicit directory with recipe JSON files when initializing an empty D1 database. The former Git snapshot is available in commit `d0cffd835f759067615dc353cb83d37808efaca2`.

```sh
node scripts/seed-recipes.mjs /path/to/recipe-json recipes-seed.sql
npx wrangler@4.151.2 d1 execute tancer-kuchtik-preview --remote --file migrations/0001_recipes.sql
npx wrangler@4.151.2 d1 execute tancer-kuchtik-preview --remote --file recipes-seed.sql
npx wrangler@4.151.2 d1 execute tancer-kuchtik-preview --remote --command "SELECT count(*) FROM recipes"
```

Import is additive, so retrying it preserves existing rows. Use the import only for initial setup to avoid recreating deleted recipes. Keep the generated SQL outside Git. D1 is the source for the live catalog.

For Workers Builds use `npm run build`, `npm run preview` and `npm run deploy`. Keep the Worker Access mode set to Previews only and protect the production `/admin` path and its descendants. Only the configured `PREVIEW_INTEGRATION_HOST` permits preview writes. For MCP configure Managed OAuth and `ACCESS_MCP_AUD` on the intended environment. Set `ACCESS_ISSUER` and `ACCESS_WEB_AUD` for the editor.

The legacy GitHub Pages URL redirects to Kuchtík and preserves the query and fragment.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License - see the [LICENSE](LICENSE) file for details.

This license allows you to use, copy, modify, and distribute this software freely for non-commercial purposes, provided that you give appropriate credit. **Commercial use, selling, or reselling is strictly prohibited.**
