import { getAll, getByIndex } from '../db.js';
import { derniereValorisation } from '../calc.js';
import { capitalRestantDu } from '../amortization.js';
import { formatMontant, formatDate, esc } from '../format.js';

export async function vueAccueil() {
  const [comptes, dettes] = await Promise.all([getAll('comptes'), getAll('dettes')]);

  let brut = 0;
  const lignesComptes = [];
  for (const c of comptes) {
    const positions = await getByIndex('positions', 'compteId', c.id);
    let totalCompte = 0;
    for (const p of positions) {
      const v = await derniereValorisation(p.id);
      totalCompte += v ? v.valeur : 0;
    }
    brut += totalCompte;
    lignesComptes.push({ compte: c, total: totalCompte, nbPositions: positions.length });
  }

  let passif = 0;
  const lignesDettes = dettes.map((d) => {
    const { crd } = capitalRestantDu(d);
    passif += crd;
    return { dette: d, crd };
  });

  const net = brut - passif;

  const html = `
  <div class="wrap">
    <p class="sub">Vue d'ensemble. La répartition détaillée et l'évolution dans le temps arrivent avec M2.</p>

    <div class="totalcard">
      <div class="lign"><span class="lbl">Patrimoine brut (actifs)</span><span>${formatMontant(brut)}</span></div>
      <div class="lign"><span class="lbl">Passif (capital restant dû)</span><span>${formatMontant(passif)}</span></div>
      <div class="lign net"><span>Patrimoine net</span><span>${formatMontant(net)}</span></div>
    </div>

    <h2>Comptes</h2>
    ${lignesComptes.length === 0 ? emptyState('#/comptes/nouveau', 'Ajouter un compte') : lignesComptes.map((l) => `
      <a class="card" href="#/comptes/${l.compte.id}">
        <div class="top">
          <span class="lbl">${esc(l.compte.libelle)}</span>
          <span class="val">${formatMontant(l.total, l.compte.devise)}</span>
        </div>
        <div class="meta">${esc(l.compte.etablissement || l.compte.enveloppe)} · ${l.nbPositions} ligne${l.nbPositions > 1 ? 's' : ''}</div>
      </a>`).join('')}
    <a class="btn ghost block" href="#/comptes/nouveau">+ Ajouter un compte</a>

    <h2>Dettes</h2>
    ${lignesDettes.length === 0 ? emptyState('#/dettes/nouveau', 'Ajouter une dette') : lignesDettes.map((l) => `
      <a class="card" href="#/dettes/${l.dette.id}">
        <div class="top">
          <span class="lbl">${esc(l.dette.libelle)}<span class="tag passif">passif</span></span>
          <span class="val">${formatMontant(l.crd)}</span>
        </div>
        <div class="meta">Capital restant dû au ${formatDate(new Date().toISOString().slice(0,10))}</div>
      </a>`).join('')}
    <a class="btn ghost block" href="#/dettes/nouveau">+ Ajouter une dette</a>
  </div>`;

  return { html };
}

function emptyState(href, label) {
  return `<div class="empty">Rien pour l'instant.<br><a href="${href}">${label}</a></div>`;
}
