'use strict';
const catalog = [["babovka","Babovka"],["bramborove-knedliky","Bramborové knedlíky"],["churros","Churros"],["cokoladovy-mousse-s-jahodami","Cokoladovy mousse s jahodami"],["dynova-polevka","Dynova polevka"],["gulas","Guláš"],["hlavkovy-salat","Hlavkový salát"],["houbove-kremove-rizoto","Houbové krémové rizoto"],["hovezi-steak","Hovězí steak"],["indicke-maslove-kure","Indicke maslove kure"],["jablecny-kolac-s-drobenkou","Jablečný koláč s drobenkou"],["jablecny-tvarohovy-kolac","Jablečný tvarohový koláč"],["kokosove-kulicky","Kokosové kuličky"],["korpus-dortu","Korpus dortu"],["kureci-stehynka-s-ryzi","Kureci stehynka s ryzi"],["langose","Langoše"],["limetkovy-kolac","Limetkovy kolac"],["marmelada-z-rybizu","Marmeláda z rybízu"],["mrkvovy-dort","Mrkvovy dort"],["nivova-pomazanka","Nivová pomazánka"],["palacinky","Palačinky"],["pernicky","Perníčky"],["rebarborovy-kolac","Rebarborový koláč"],["rizoto-ala-lukas","Rizoto ala Lukas"],["rybi-karbenatky","Rybi karbenatky"],["sirup-z-rybizu","Sirup z rybízu"],["stava-z-aronie","Šťáva z arónie"],["vyvar","Vývar"],["zakladni-okurkovy-salat","Základní okurkový salát"],["zeleninov-kari","Zeleninové kari"]];

const categories = [
  ['Hlavní jídla','gulas houbove-kremove-rizoto hovezi-steak indicke-maslove-kure kureci-stehynka-s-ryzi langose rizoto-ala-lukas rybi-karbenatky zeleninov-kari'],
  ['Polévky','dynova-polevka vyvar'],
  ['Saláty a přílohy','bramborove-knedliky hlavkovy-salat nivova-pomazanka zakladni-okurkovy-salat'],
  ['Sladké','babovka churros cokoladovy-mousse-s-jahodami jablecny-kolac-s-drobenkou jablecny-tvarohovy-kolac kokosove-kulicky korpus-dortu limetkovy-kolac mrkvovy-dort palacinky pernicky rebarborovy-kolac'],
  ['Zavařeniny a nápoje','marmelada-z-rybizu sirup-z-rybizu stava-z-aronie'],
].map(([name, ids]) => ({ name, ids: ids.split(' ') }));

const variants = [
  ['A1', 'Oblíbené nahoře'], ['A2', 'Přepínač seznamů'],
  ['B1', 'Rozbalovací skupiny'], ['B2', 'Výběr kategorie'],
];
const sampleArchive = new Set(['korpus-dortu','mrkvovy-dort','rybi-karbenatky']);
const favorites = new Set(['langose','houbove-kremove-rizoto','palacinky']);
const selection = new Set();
let variant = variants.some(([id]) => id === location.hash.slice(1)) ? location.hash.slice(1) : 'A1';
let activeCategory = '';
let activeShelf = 'favorites';
let archive = false;
const search = document.getElementById('search');
const archiveButton = document.getElementById('archive');
const view = document.getElementById('view');
const shopping = document.getElementById('shopping');
const dialog = document.getElementById('selection');
const variantNav = document.getElementById('variants');

const assigned = new Map(categories.flatMap(({ name, ids }) => ids.map(id => [id, name])));
const recipes = catalog.map(([id, name]) => ({
  id, name, category: assigned.get(id) ?? 'Ostatní',
})).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
const categoryNames = [...new Set([...categories.map(c => c.name), ...recipes.map(r => r.category)])];

function el(tag, cls, text) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
}

function action(cls, label, handler, pressed) {
  const button = el('button', cls, label);
  button.type = 'button';
  if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed));
  button.addEventListener('click', handler);
  return button;
}

function renderRow(recipe, metadata = true) {
  const row = el('div', 'row');
  const check = el('input');
  check.type = 'checkbox';
  check.checked = selection.has(recipe.id);
  check.setAttribute('aria-label', 'Vybrat na nákup: ' + recipe.name);
  check.addEventListener('change', () => {
    if (check.checked) selection.add(recipe.id);
    else selection.delete(recipe.id);
    renderShopping();
    view.querySelectorAll('input[data-recipe]').forEach(input => {
      if (input.dataset.recipe === recipe.id) input.checked = check.checked;
    });
  });
  check.dataset.recipe = recipe.id;

  const info = el('div');
  const link = el('a', '', recipe.name);
  link.href = 'https://kuchtik.tancer.cz/?recipe=' + encodeURIComponent(recipe.id);
  link.target = '_blank';
  link.rel = 'noopener';
  info.append(link);
  if (metadata) info.append(el('span', 'meta', recipe.category));

  const starred = favorites.has(recipe.id);
  const star = action('star', starred ? '★' : '☆', () => {
    if (starred) favorites.delete(recipe.id);
    else favorites.add(recipe.id);
    render('star', recipe.id);
  }, starred);
  star.dataset.recipe = recipe.id;
  star.setAttribute('aria-label', (starred ? 'Odebrat z oblíbených: ' : 'Přidat k oblíbeným: ') + recipe.name);
  row.append(check, info, star);
  return row;
}

function renderRows(list, metadata = true) {
  if (!list.length) return el('p', 'empty', 'Žádné recepty.');
  const rows = el('div', 'rows');
  rows.append(...list.map(recipe => renderRow(recipe, metadata)));
  return rows;
}

function heading(title, count) {
  const head = el('div', 'head');
  head.append(el('h2', '', title), el('span', 'count', String(count)));
  return head;
}

function favoritePanel(list) {
  const box = el('section', 'favorite-strip');
  const items = list.filter(recipe => favorites.has(recipe.id));
  box.append(heading('Oblíbené', items.length));
  if (!items.length) box.append(renderRows(items, false));
  else {
    const strip = el('div', 'strip-grid');
    strip.append(...items.map(recipe => renderRow(recipe, false)));
    box.append(strip);
  }
  return box;
}

function catalogSection(title, list, metadata = true) {
  const section = el('section', 'section');
  section.append(heading(title, list.length), renderRows(list, metadata));
  return section;
}

function byShelf(list) {
  const liked = list.filter(recipe => favorites.has(recipe.id));
  const switches = el('nav', 'shelf-switch');
  switches.setAttribute('aria-label', 'Zobrazení receptů');
  for (const [id, label, count] of [['favorites', 'Oblíbené', liked.length], ['all', 'Všechny', list.length]]) {
    const button = action('shelf-button', label, () => {
      activeShelf = id;
      render('shelf', id);
    }, id === activeShelf);
    button.dataset.shelf = id;
    button.append(el('span', 'shelf-count', String(count)));
    switches.append(button);
  }
  view.append(switches, renderRows(activeShelf === 'favorites' ? liked : list));
}

function byGroups(list) {
  const box = el('div', 'category-groups');
  for (const name of categoryNames) {
    const items = list.filter(r => r.category === name);
    if (!items.length) continue;
    const group = el('details');
    group.open = expanded.has(name);
    group.addEventListener('toggle', () => {
      if (group.open) expanded.add(name);
      else expanded.delete(name);
    });
    const label = el('summary', '', name);
    label.append(el('span', '', String(items.length)));
    group.append(label, renderRows(items, false));
    box.append(group);
  }
  return box;
}

function byTiles(list) {
  const tiles = el('div', 'tiles');
  for (const name of categoryNames) {
    const count = list.filter(r => r.category === name).length;
    if (!count) continue;
    const tile = action('tile', name, () => {
      activeCategory = activeCategory === name ? '' : name;
      render('tile', name);
    }, activeCategory === name);
    tile.dataset.category = name;
    const total = el('small', '', String(count));
    total.append(el('span', '', count === 1 ? ' recept' : count < 5 ? ' recepty' : ' receptů'));
    tile.append(total);
    tiles.append(tile);
  }
  const items = activeCategory ? list.filter(r => r.category === activeCategory) : list;
  view.append(tiles, catalogSection(activeCategory || 'Všechny recepty', items, !activeCategory));
}

function norm(text) {
  return text.toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function render(kind, key) {
  const list = recipes.filter(recipe => !sampleArchive.has(recipe.id));
  const term = norm(search.value.trim());
  archiveButton.setAttribute('aria-pressed', String(archive));
  archiveButton.textContent = archive ? 'Zpět do katalogu' : 'Archiv';
  view.replaceChildren();

  if (term) {
    const found = recipes.filter(recipe => (!archive || sampleArchive.has(recipe.id)) &&
      norm(recipe.name + ' ' + recipe.category).includes(term));
    view.append(heading('Výsledky hledání', found.length), renderRows(found));
    for (const row of view.querySelectorAll('.row')) {
      if (sampleArchive.has(row.querySelector('input').dataset.recipe)) row.querySelector('.meta').append(' · Archiv');
    }
  } else if (archive) {
    const label = el('div', 'archive-banner');
    label.append(el('h2', '', 'Archiv'), el('p', 'hint', 'Ukázkové zařazení receptů z dětství.'));
    view.append(label, renderRows(recipes.filter(recipe => sampleArchive.has(recipe.id))));
  } else if (variant === 'A2') {
    byShelf(list);
  } else {
    view.append(favoritePanel(list));
    if (variant === 'A1') view.append(catalogSection('Všechny recepty', list));
    if (variant === 'B1') view.append(heading('Kategorie', list.length), byGroups(list));
    if (variant === 'B2') byTiles(list);
  }

  if (kind === 'star') [...view.querySelectorAll('.star')].find(btn => btn.dataset.recipe === key)?.focus();
  if (kind === 'shelf') [...view.querySelectorAll('.shelf-button')].find(btn => btn.dataset.shelf === key)?.focus();
  if (kind === 'tile') [...view.querySelectorAll('.tile')].find(btn => btn.dataset.category === key)?.focus();
}

function setVariant(id) {
  variant = id;
  location.hash = id;
  for (const btn of variantNav.children) btn.setAttribute('aria-pressed', String(btn.dataset.variant === id));
  render();
}

function renderShopping() {
  shopping.hidden = !selection.size;
  shopping.textContent = 'Výběr na nákup (' + selection.size + ')';
}

const expanded = new Set();
for (const [id, label] of variants) {
  const btn = action('tab', id + ' · ' + label, () => setVariant(id), id === variant);
  btn.dataset.variant = id;
  variantNav.append(btn);
}
search.addEventListener('input', () => render());
archiveButton.addEventListener('click', () => {
  archive = !archive;
  search.value = '';
  render();
});
shopping.addEventListener('click', () => {
  const chosen = recipes.filter(recipe => selection.has(recipe.id));
  document.getElementById('selected-list').replaceChildren(...chosen.map(recipe => el('li', '', recipe.name)));
  dialog.showModal();
});
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (next !== variant && variants.some(([id]) => id === next)) setVariant(next);
});
render();
