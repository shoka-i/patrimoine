import { chargerDonnees, calculerPatrimoine } from '../patrimoine.js';
import { capitalRestantDu } from '../amortization.js';
import { formatMontant, formatDate, esc, aujourdHui } from '../format.js';

export async function vueAccueil() {
  const donnees = await chargerDonnees();
  const p = calculerPatrimoine(donnees, aujourdHui());
  const { comptes, dettes } = donnees;

  const lignesComptes = comptes.map((c) => {
    const lignes = p.lignes.filter((l) => l.compteId === c.id);
    return { compte: c, total: lignes.reduce((s, l) => s + (l.valeur || 0), 0), nbPositions: lignes.length };
  });
  const lignesDettes = dettes.map((d) => ({ dette: d, crd: capitalRestantDu(d).crd }));
  const brut = p.brut;
  const passif = p.passif;
  const net = p.net;

  const html = `
  <div class="wrap">
    <p class="sub">Vue d'ensemble. Répartition, évolution et performance : onglet <a href="#/patrimoine">Patrimoine</a>.</p>

    <div class="totalcard">
      <div class="lign"><span class="lbl">Patrimoine brut (actifs)</span><span>${formatMontant(brut)}</span></div>
      <div class="lign"><span class="lbl">Passif (capital restant dû)</span><span>${formatMontant(passif)}</span></div>
      <div class="lign net"><span>Patrimoine net</span><span>${formatMontant(net)}</span></div>
    </div>

    ${p.horsConversion.length ? `<div class="notice warn"><p><b>${p.horsConversion.length} ligne(s) exclue(s) du total</b> : aucun taux de change saisi pour ${esc([...new Set(p.horsConversion.map((l) => l.devise))].join(', '))}. Voir <a href="#/reglages">Réglages</a>.</p></div>` : ''}

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
