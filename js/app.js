import { ensureReglages } from './db.js';
import { vueAccueil } from './views/accueil.js';
import { vueComptesListe, vueCompteForm, vueCompteDetail } from './views/comptes.js';
import { vuePositionForm, vuePositionDetail } from './views/positions.js';
import { vueDettesListe, vueDetteForm, vueDetteDetail } from './views/dettes.js';
import { vueReglages } from './views/export.js';

const ROUTES = [
  { re: /^#\/$/, view: vueAccueil, titre: 'Patrimoine' },
  { re: /^#\/comptes$/, view: vueComptesListe, titre: 'Comptes' },
  { re: /^#\/comptes\/nouveau$/, view: () => vueCompteForm(null), titre: 'Nouveau compte' },
  { re: /^#\/comptes\/([^/]+)\/modifier$/, view: (id) => vueCompteForm(id), titre: 'Modifier le compte' },
  { re: /^#\/comptes\/([^/]+)\/positions\/nouveau$/, view: (compteId) => vuePositionForm(compteId, null), titre: 'Nouvelle ligne' },
  { re: /^#\/comptes\/([^/]+)$/, view: (id) => vueCompteDetail(id), titre: null },
  { re: /^#\/positions\/([^/]+)$/, view: (id) => vuePositionDetail(id), titre: null },
  { re: /^#\/dettes$/, view: vueDettesListe, titre: 'Dettes' },
  { re: /^#\/dettes\/nouveau$/, view: () => vueDetteForm(null), titre: 'Nouvelle dette' },
  { re: /^#\/dettes\/([^/]+)\/modifier$/, view: (id) => vueDetteForm(id), titre: 'Modifier la dette' },
  { re: /^#\/dettes\/([^/]+)$/, view: (id) => vueDetteDetail(id), titre: null },
  { re: /^#\/reglages$/, view: vueReglages, titre: 'Réglages et sauvegarde' },
];

const app = document.getElementById('app');
const topTitle = document.getElementById('top-titre');
const backBtn = document.getElementById('top-back');

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function refresh() {
  render();
}

function setActiveTab() {
  const h = location.hash || '#/';
  document.querySelectorAll('nav.tabbar a').forEach((a) => {
    const prefixes = (a.dataset.match || a.getAttribute('href')).split(',');
    const on = prefixes.some((p) => (p === '#/' ? h === '#/' : h.startsWith(p)));
    a.classList.toggle('on', on);
  });
}

async function render() {
  const hash = location.hash || '#/';
  const match = ROUTES.find((r) => r.re.test(hash));
  window.scrollTo(0, 0);
  setActiveTab();
  if (!match) {
    app.innerHTML = '<div class="wrap"><p>Page introuvable.</p></div>';
    return;
  }
  const params = match.re.exec(hash).slice(1).map(decodeURIComponent);
  backBtn.hidden = hash === '#/';
  if (match.titre) topTitle.textContent = match.titre;
  try {
    const result = await match.view(...params);
    if (typeof result === 'string') {
      app.innerHTML = result;
    } else if (result && result.html !== undefined) {
      app.innerHTML = result.html;
      if (match.titre === null && result.titre) topTitle.textContent = result.titre;
      if (typeof result.after === 'function') result.after(app);
    }
  } catch (err) {
    console.error(err);
    app.innerHTML = '<div class="wrap"><div class="notice warn"><p>Erreur d\'affichage : ' + (err && err.message ? err.message : err) + '</p></div></div>';
  }
}

backBtn.addEventListener('click', () => history.back());
window.addEventListener('hashchange', render);

async function boot() {
  await ensureReglages();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW non enregistré :', e));
  }
  render();
}

boot();
