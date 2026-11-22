import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { jest } from '@jest/globals';

const openShortcut = jest.fn();
jest.unstable_mockModule('../utils/shortcutsUtils.js', () => ({ openShortcut }));

test('exports ingredients from the recipe selected in the Worker catalog', async () => {
  const recipes = [
    { name: 'Langoše (domácí)', metadata: { id: 'langose-a' }, ingredients: ['100 g mouky'] },
    { name: 'Langoše (domácí)', metadata: { id: 'langose-b' }, ingredients: ['200 g brambor'] },
  ].map(recipe => ({ ...recipe, tags: [], instructions: [] }));
  const readAsset = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  document.documentElement.innerHTML = readAsset('index.html');
  // The build adds this marker to the source HTML.
  if (!document.querySelector('meta[name="kuchtik-host"]')) {
    document.head.insertAdjacentHTML('beforeend', '<meta name="kuchtik-host" content="worker">');
  }
  window.bootstrap = {
    Modal: class {
      constructor(element) { this.element = element; }
      show() { this.element.classList.add('show'); }
    },
  };
  fetch.mockImplementation(async path => {
    if (path === '/admin/api/session') return { ok: false, status: 401 };
    if (path === '/api/recipes') return { ok: true, json: async () => recipes };
    const asset = readAsset(path);
    return { ok: true, text: async () => asset, json: async () => JSON.parse(asset) };
  });

  await import('../main.js');
  await new Promise(resolve => setTimeout(resolve, 0));

  document.getElementById('checkbox-langose-b').click();
  document.getElementById('exportBtn').click();
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(alert).not.toHaveBeenCalled();
  const modal = document.querySelector('#ingredientsModal.show');
  expect(modal).not.toBeNull();
  expect(modal.querySelector('#ingredientsList').textContent).toContain('200 g brambor');
  expect(modal.querySelector('#ingredientsList').textContent).not.toContain('100 g mouky');
  expect(openShortcut).not.toHaveBeenCalled();
});
