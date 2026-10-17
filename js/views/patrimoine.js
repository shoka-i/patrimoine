import { chargerDonnees, calculerPatrimoine, repartir, serieEvolution, performanceParCompte } from '../patrimoine.js';
import { formatNombre, formatMontant, formatMontantCompact, formatPct, formatSigne, formatDate, esc, aujourdHui } from '../format.js';
import { labelEnveloppe } from './comptes.js';
import { labelClasse } from './positions.js';

const DIMENSIONS = [
  ['classe', 'Classe', (l) => (l.classe === '__global'
    ? { k: '__global', label: 'Contrats en valorisation globale (non ventilés)' }
    : { k: l.classe, label: labelClasse(l.classe) })],
  ['enveloppe', 'Enveloppe', (l) => ({ k: l.enveloppe, label: labelEnveloppe(l.enveloppe) })],
  ['etablissement', 'Établissement', (l) => ({
    k: l.etablissement.toLowerCase() || '__aucun',
    label: l.etablissement || 'Non renseigné',
  })],
  ['devise', 'Devise', (l) => ({ k: l.devise, label: l.devise })],
];

export async function vuePatrimoine() {
  const dateRef = aujourdHui();
  const donnees = await chargerDonnees();
  const p = calculerPatrimoine(donnees, dateRef);

  if (donnees.comptes.length === 0) {
    return { html: '<div class="wrap"><div class="empty">Rien à afficher pour l\'instant.<br><a href="#/comptes/nouveau">Ajouter un compte</a></div></div>' };
  }

  const serie = serieEvolution(p.retenues, dateRef);
  const perf = performanceParCompte(p.retenues);
  const graphe = serie.length >= 2 ? grapheEvolution(serie) : null;

  const html = `
  <div class="wrap">
    <div class="totalcard">
      <div class="lign"><span class="lbl">Patrimoine brut (actifs)</span><span>${formatMontant(p.brut)}</span></div>
      <div class="lign"><span class="lbl">Passif (capital restant dû)</span><span>${formatMontant(p.passif)}</span></div>
      <div class="lign net"><span>Patrimoine net</span><span>${formatMontant(p.net)}</span></div>
    </div>
    ${avertissements(p)}

    <h2>Évolution</h2>
    ${graphe ? `
      <div class="viz-legend">
        <span><i class="sw sw-valeur"></i>Valeur</span>
        <span><i class="sw sw-capital"></i>Capital net versé</span>
      </div>
      <div id="lecture" class="viz-lecture" aria-live="polite"></div>
      ${graphe.svg}
      <details class="viz-table">
        <summary>Voir les valeurs en tableau</summary>
        <table class="tbl"><thead><tr><th>Date</th><th>Valeur</th><th>Versé</th><th>+/−</th></tr></thead><tbody>
          ${serie.slice().reverse().map((s) => `<tr><td>${formatDate(s.date)}</td><td class="num">${formatMontant(s.valeur)}</td><td class="num">${formatMontant(s.capital)}</td><td class="num">${formatSigne(s.plusValue)}</td></tr>`).join('')}
        </tbody></table>
      </details>
      <p class="hint">Une date par saisie (valorisation ou flux externe). Entre deux saisies, la dernière valeur connue est reportée : une ligne non mise à jour reste à son ancienne valeur. Taux de change actuels appliqués à tout l'historique. L'historique démarre à la première saisie, pas avant.</p>
    ` : '<div class="empty">Un seul point de mesure pour l\'instant. La courbe apparaît dès la deuxième date de saisie.</div>'}

    <h2>Capital versé et performance</h2>
    <div class="totalcard">
      <div class="lign"><span class="lbl">Valeur actuelle</span><span>${formatMontant(p.brut)}</span></div>
      <div class="lign"><span class="lbl">Capital net versé</span><span>${formatMontant(p.capital)}</span></div>
      <div class="lign net"><span>Plus-value</span><span>${formatSigne(p.plusValue)}${p.capital > 0 ? ' · ' + formatPct(p.plusValue / p.capital) : ''}</span></div>
    </div>
    ${perf.length ? `<table class="tbl"><thead><tr><th>Compte</th><th>Valeur</th><th>Versé</th><th>+/−</th></tr></thead><tbody>
      ${perf.map((c) => `<tr><td>${esc(c.libelle)}</td><td class="num">${formatMontant(c.valeur)}</td><td class="num">${formatMontant(c.capital)}</td><td class="num">${formatSigne(c.plusValue)}${c.ratio !== null ? '<br><span class="muted">' + formatPct(c.ratio) + '</span>' : ''}</td></tr>`).join('')}
    </tbody></table>` : ''}
    <p class="hint">Plus-value = valeur − capital net versé. Le pourcentage rapporte la plus-value au capital net versé : ce n'est ni un rendement annualisé ni un rendement pondéré par le temps. Le solde de départ compte comme un premier versement.</p>

    <h2>Répartition</h2>
    <div class="seg" role="tablist" id="seg-dim">
      ${DIMENSIONS.map(([k, l], i) => `<button type="button" role="tab" data-dim="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <div id="rep"></div>

    <h2>Sources</h2>
    <p class="hint">${sourcesTexte(p)}</p>
  </div>`;

  return {
    html,
    titre: 'Patrimoine',
    after(root) {
      const rep = root.querySelector('#rep');
      const dessinerRepartition = (dim) => {
        const def = DIMENSIONS.find((d) => d[0] === dim);
        const items = repartir(p.retenues, def[2], p.brut);
        rep.innerHTML = htmlRepartition(items, dim, p);
      };
      dessinerRepartition('classe');
      root.querySelector('#seg-dim').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-dim]');
        if (!b) return;
        root.querySelectorAll('#seg-dim button').forEach((x) => x.classList.toggle('on', x === b));
        dessinerRepartition(b.dataset.dim);
      });

      if (graphe) brancherLecture(root, serie, graphe);
    },
  };
}

function avertissements(p) {
  const out = [];
  if (p.horsConversion.length) {
    const devises = [...new Set(p.horsConversion.map((l) => l.devise))].join(', ');
    out.push(`<div class="notice warn"><p><b>${p.horsConversion.length} ligne(s) exclue(s) des totaux</b> : aucun taux de change saisi pour ${esc(devises)}. Les saisir dans <a href="#/reglages">Réglages</a>.</p></div>`);
  }
  if (p.sansValorisation.length) {
    out.push(`<div class="notice warn"><p><b>${p.sansValorisation.length} ligne(s) sans valorisation</b> : comptées pour 0 et exclues de la performance (${p.sansValorisation.map((l) => esc(l.libelle)).join(', ')}).</p></div>`);
  }
  return out.join('');
}

function sourcesTexte(p) {
  if (!p.retenues.length) return 'Aucune valorisation.';
  const dates = p.retenues.map((l) => l.dateValeur).sort();
  const sources = [...new Set(p.retenues.map((l) => l.source))].join(', ');
  const taux = [...new Map(p.retenues.filter((l) => l.fx && l.fx.source).map((l) => [l.devise, l.fx])).entries()]
    .map(([d, fx]) => `1 ${esc(d)} = ${formatNombre(fx.taux, 6)} € (${esc(fx.source)}, ${formatDate(fx.date)})`).join(' ; ');
  return `${p.retenues.length} ligne(s) valorisée(s). Source : ${esc(sources)}. Dernières valorisations du ${formatDate(dates[0])} (la plus ancienne) au ${formatDate(dates[dates.length - 1])} (la plus récente).${taux ? ' Taux : ' + taux + '.' : ''} Calculé le ${formatDate(aujourdHui())}.`;
}

function htmlRepartition(items, dim, p) {
  if (!items.length) return '<div class="empty">Aucune ligne valorisée.</div>';
  let html = items.map((it) => `
    <div class="rep-row">
      <div class="rep-top"><span class="rep-lbl">${esc(it.label)}${it.cle === 'immobilier' ? '<span class="tag">hors marché</span>' : ''}</span><span class="rep-val">${formatMontant(it.montant)} · ${formatPct(it.part)}</span></div>
      <div class="rep-track"><div class="rep-bar" style="width:${Math.max(0, Math.min(100, (it.part || 0) * 100)).toFixed(1)}%"></div></div>
    </div>`).join('');

  if (dim === 'devise') {
    const natif = new Map();
    for (const l of p.retenues) if (l.devise !== 'EUR') natif.set(l.devise, (natif.get(l.devise) || 0) + l.valeur);
    if (natif.size) {
      html += `<p class="hint">Montants d'origine : ${[...natif].map(([d, v]) => formatMontant(v, d)).join(' ; ')}.</p>`;
    }
    const hors = new Map();
    for (const l of p.horsConversion) hors.set(l.devise, (hors.get(l.devise) || 0) + (l.valeur || 0));
    for (const [d, v] of hors) html += `<div class="rep-row"><div class="rep-top"><span class="rep-lbl">${esc(d)}<span class="tag passif">non converti</span></span><span class="rep-val">${formatMontant(v, d)}</span></div></div>`;
  }
  if (dim === 'classe' && items.some((i) => i.cle === 'immobilier')) {
    html += '<p class="hint">L\'immobilier est compté dans le brut. Il sera exclu de l\'allocation cible au module suivant.</p>';
  }
  return html;
}

// --- Graphique : SVG en ligne, deux courbes sur un seul axe ---

const G = { W: 360, H: 200, ml: 46, mr: 12, mt: 12, mb: 24 };

function grapheEvolution(serie) {
  const t0 = Date.parse(serie[0].date + 'T00:00:00');
  const t1 = Date.parse(serie[serie.length - 1].date + 'T00:00:00');
  const vals = serie.flatMap((s) => [s.valeur, s.capital]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = hi > lo ? (hi - lo) * 0.1 : Math.max(Math.abs(hi) * 0.01, 1);
  lo -= pad; hi += pad;

  const x = (d) => G.ml + ((Date.parse(d + 'T00:00:00') - t0) / (t1 - t0)) * (G.W - G.ml - G.mr);
  const y = (v) => G.mt + (1 - (v - lo) / (hi - lo)) * (G.H - G.mt - G.mb);

  const pts = serie.map((s) => ({ ...s, px: x(s.date), pyV: y(s.valeur), pyC: y(s.capital) }));
  const ligne = (cle) => pts.map((q, i) => (i ? 'L' : 'M') + q.px.toFixed(1) + ' ' + q[cle].toFixed(1)).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const last = pts[pts.length - 1];

  const svg = `
  <svg id="graphe" class="viz" viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="Évolution de la valeur du patrimoine brut et du capital net versé, du ${formatDate(serie[0].date)} au ${formatDate(serie[serie.length - 1].date)}">
    ${ticks.map((t) => `<line class="viz-grid" x1="${G.ml}" x2="${G.W - G.mr}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="viz-axis" x="${G.ml - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${formatMontantCompact(t)}</text>`).join('')}
    <text class="viz-axis" x="${G.ml}" y="${G.H - 6}" text-anchor="start">${formatDate(serie[0].date)}</text>
    <text class="viz-axis" x="${G.W - G.mr}" y="${G.H - 6}" text-anchor="end">${formatDate(serie[serie.length - 1].date)}</text>
    <path class="viz-line capital" d="${ligne('pyC')}"/>
    <path class="viz-line valeur" d="${ligne('pyV')}"/>
    <circle class="viz-dot capital" cx="${last.px.toFixed(1)}" cy="${last.pyC.toFixed(1)}" r="4"/>
    <circle class="viz-dot valeur" cx="${last.px.toFixed(1)}" cy="${last.pyV.toFixed(1)}" r="4"/>
    <g id="curseur" hidden>
      <line class="viz-cursor" y1="${G.mt}" y2="${G.H - G.mb}"/>
      <circle class="viz-dot capital" r="4"/>
      <circle class="viz-dot valeur" r="4"/>
    </g>
    <rect x="0" y="0" width="${G.W}" height="${G.H}" fill="transparent" id="zone"/>
  </svg>`;
  return { svg, pts };
}

function texteLecture(s) {
  return `<b>${formatDate(s.date)}</b> · Valeur ${formatMontant(s.valeur)} · Versé ${formatMontant(s.capital)} · ${formatSigne(s.plusValue)}`;
}

function brancherLecture(root, serie, graphe) {
  const lecture = root.querySelector('#lecture');
  const svg = root.querySelector('#graphe');
  const curseur = root.querySelector('#curseur');
  const [ligneC, dotC, dotV] = [curseur.querySelector('line'), ...curseur.querySelectorAll('circle')];
  lecture.innerHTML = texteLecture(serie[serie.length - 1]);

  const viser = (clientX) => {
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * G.W;
    let best = graphe.pts[0];
    for (const q of graphe.pts) if (Math.abs(q.px - vx) < Math.abs(best.px - vx)) best = q;
    curseur.hidden = false;
    ligneC.setAttribute('x1', best.px); ligneC.setAttribute('x2', best.px);
    dotV.setAttribute('cx', best.px); dotV.setAttribute('cy', best.pyV);
    dotC.setAttribute('cx', best.px); dotC.setAttribute('cy', best.pyC);
    lecture.innerHTML = texteLecture(best);
  };
  svg.addEventListener('pointerdown', (e) => viser(e.clientX));
  svg.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') viser(e.clientX); });
  svg.addEventListener('pointerleave', () => {
    curseur.hidden = true;
    lecture.innerHTML = texteLecture(serie[serie.length - 1]);
  });
}
