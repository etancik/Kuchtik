const hostMode = typeof document !== 'undefined' ? document.querySelector('meta[name="kuchtik-host"]')?.content : null;
export const readOnlyWorker = hostMode === 'readonly-worker';
export const workerHosted = hostMode === 'worker' || readOnlyWorker;
export const editorMode = workerHosted && location.pathname === '/admin/';

export function switchView() {
  const url = new window.URL(location.href);
  url.pathname = editorMode ? '/' : '/admin/';
  location.assign(url);
}

export async function editorRequest(path, options) {
  const response = await fetch('/admin/api/' + path, {
    redirect: 'error',
    ...options,
  }).catch(() => {
    throw new Error('Unable to reach the editor. Reload the page to check your Access session.');
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Unable to complete the editor request.');
  return payload;
}

function save(method, path, payload) {
  return editorRequest(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export const workerRecipeAdapter = {
  isAuthenticated: () => editorMode,
  getCurrentUser: () => null,
  getFileList: () => editorRequest('recipes'),
  getFile: filename => editorRequest('recipes/' + encodeURIComponent(filename)),
  getAllFiles: () => editorRequest('catalog'),
  async checkFileExists(filename) {
    return (await this.getFileList()).includes(filename);
  },
  createFile: (_filename, recipe) => save('POST', 'recipes', { recipe }),
  updateFile: (filename, recipe) => save('PUT', 'recipes/' + encodeURIComponent(filename),
    { recipe, revision: recipe.metadata?.sha }),
  deleteFile: (filename, revision) => save('DELETE', 'recipes/' + encodeURIComponent(filename), { revision }),
};

async function fetchPublicRecipes(path = '') {
  const response = await fetch('/api/recipes' + path);
  if (!response.ok) throw new Error('Unable to load recipes.');
  return response.json();
}

export const publicWorkerRecipeAdapter = {
  getAllFiles: () => fetchPublicRecipes(),
  async getFileList() {
    return (await this.getAllFiles()).map(recipe => recipe.metadata.filename);
  },
  getFile: filename => fetchPublicRecipes('/' + encodeURIComponent(filename)),
};
