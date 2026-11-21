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

## Cloudflare nasazení

Kuchtík má veřejný přehled a editor na `/admin/`. Editor ukládá přes Worker a GitHub App.
MCP používá vlastní hostname a zpřístupňuje nástroje pro hledání, načtení a úpravu receptu.
Úprava posílá revizi z načteného receptu a vrací SHA commitu. Při konfliktu načti recept znovu.

| Prostředí | Větev buildu | Web | MCP | Větev receptů |
| --- | --- | --- | --- | --- |
| Pracovní preview | Pracovní větev | URL z Workers Builds | — | Veřejné recepty pouze pro čtení |
| Integrační preview | `kuchtik-preview` | URL z Workers Builds | `/mcp` na adrese integračního preview | `kuchtik-preview-recipes` |
| Produkce | `main` | `kuchtik.tancer.cz` | `mcp-kuchtik.tancer.cz/mcp` | `main` |

1. V Cloudflare ověř živý stav hostname a Access. Na Workeru nastav Access v režimu Previews only, v produkci chraň `/admin` a všechny jeho podcesty. Pro MCP nastav Managed OAuth a ověř očekávané audience. Povol jen potřebné OAuth redirect URI pro ChatGPT a Claude Code. Custom Domains připoj až po ověření politik. Pracovní preview používají společný Access issuer a audience. Přihlašovací údaje GitHub App, `MCP_WRITER_EMAIL`, MCP audience a `PREVIEW_INTEGRATION_HOST` nastav pouze v pojmenovaném integračním preview. Hostname opiš z jeho stabilní URL.
2. GitHub App nainstaluj jen do `etancik/Kuchtik` s Contents Read and write. Worker potřebuje `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID` a secret `GITHUB_APP_PRIVATE_KEY`. Dále nastav `ACCESS_ISSUER`, `ACCESS_WEB_AUD`, `ACCESS_MCP_AUD` a `MCP_WRITER_EMAIL`. Nastavení a klíč patří do Cloudflare. Preview používá pevně danou testovací větev, kterou založ z `main`.
3. Pro Workers Builds nastav root repozitáře a `npm run build`, pro preview `npm run preview`, pro produkci `npm run deploy`. Po úspěšném nasazení pošli uživateli stabilní Preview URL z Workers Builds nebo z komentáře v PR a uveď větev. U odkazu ověř Access; při chybě buildu uveď výsledek a odkaz na build. Lokální kontrola probíhá přes `npm run lint`, `npm run test:worker` a `npm run build`. Dále ověř GitHub Pages CI a chráněné preview.
4. Na preview ověř přihlášení a obnovu relace v obou MCP klientech, zápis oprávněného účtu, odmítnutí jiného účtu a konflikt verzí. Ověř také webový editor, odkaz `?recipe=…` a iOS Zkratky. Po ověření produkční adresy přidej kartu rozcestníku. Proměnná `KUCHTIK_PAGES_REDIRECT=1` v GitHub Actions zapne po ručním spuštění workflow přesměrování staré Pages adresy včetně query a fragmentu.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License - see the [LICENSE](LICENSE) file for details.

This license allows you to use, copy, modify, and distribute this software freely for non-commercial purposes, provided that you give appropriate credit. **Commercial use, selling, or reselling is strictly prohibited.**