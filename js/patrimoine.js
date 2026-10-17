// Calculs M2 : agrégation du patrimoine, répartitions, évolution, performance.
// Fonctions pures (hors chargerDonnees) : mêmes données en entrée, mêmes chiffres en sortie.
// Rien ici n'est estimé. Une ligne dont la devise n'a pas de taux saisi est exclue des totaux
// et signalée, jamais convertie « au jugé ».
import { getAll } from './db.js';
import { capitalNetVerse, parOrdreRecent } from './calc.js';
import { capitalRestantDu } from './amortization.js';

const STORES_LUS = ['comptes', 'actifs', 'positions', 'operations', 'valorisations', 'dettes', 'changes'];

export async function chargerDonnees() {
  const res = await Promise.all(STORES_LUS.map((n) => getAll(n)));
  return Object.fromEntries(STORES_LUS.map((n, i) => [n, res[i]]));
}

// Taux : 1 unité de `devise` = taux EUR. Collection `changes`, une entrée par devise (id = code devise).
export function tauxVersEUR(devise, changes) {
  if (devise === 'EUR') return { taux: 1, date: null, source: null };
  const c = changes.find((x) => x.id === devise && x.taux > 0);
  return c ? { taux: c.taux, date: c.date, source: c.source } : null;
}

// Ordre chronologique croissant (parOrdreRecent est décroissant).
function indexParPosition(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.positionId)) m.set(r.positionId, []);
    m.get(r.positionId).push(r);
  }
  for (const arr of m.values()) arr.sort(parOrdreRecent).reverse();
  return m;
}

export function calculerPatrimoine(donnees, dateRef) {
  const compteById = new Map(donnees.comptes.map((c) => [c.id, c]));
  const actifById = new Map(donnees.actifs.map((a) => [a.id, a]));
  const vals = indexParPosition(donnees.valorisations);
  const ops = indexParPosition(donnees.operations);

  const lignes = [];
  for (const p of donnees.positions) {
    const compte = compteById.get(p.compteId);
    if (!compte) continue;
    const actif = actifById.get(p.actifId);
    const valorisations = vals.get(p.id) || [];
    const operations = ops.get(p.id) || [];
    const derniere = valorisations.length ? valorisations[valorisations.length - 1] : null;
    const fx = tauxVersEUR(compte.devise, donnees.changes);
    const capital = capitalNetVerse(operations);
    const valeur = derniere ? derniere.valeur : null;
    lignes.push({
      positionId: p.id,
      compteId: compte.id,
      compteLibelle: compte.libelle,
      libelle: actif ? actif.nom : 'Position',
      classe: compte.granularite === 'globale' ? '__global' : ((actif && actif.classe) || 'autre'),
      enveloppe: compte.enveloppe,
      etablissement: (compte.etablissement || '').trim(),
      devise: compte.devise,
      valeur,
      dateValeur: derniere ? derniere.date : null,
      source: derniere ? derniere.source : null,
      capital,
      fx,
      valeurEUR: fx && valeur !== null ? valeur * fx.taux : null,
      capitalEUR: fx ? capital * fx.taux : null,
      valorisations,
      operations,
    });
  }

  const retenues = lignes.filter((l) => l.fx && l.valeur !== null);
  const horsConversion = lignes.filter((l) => !l.fx);
  const sansValorisation = lignes.filter((l) => l.fx && l.valeur === null);

  const brut = retenues.reduce((s, l) => s + l.valeurEUR, 0);
  const capital = retenues.reduce((s, l) => s + l.capitalEUR, 0);
  const passif = donnees.dettes.reduce((s, d) => s + capitalRestantDu(d, dateRef).crd, 0);

  return {
    lignes, retenues, horsConversion, sansValorisation,
    brut, capital, plusValue: brut - capital,
    passif, net: brut - passif,
  };
}

// cle(ligne) -> { k, label }. Pourcentages rapportés au brut converti.
export function repartir(retenues, cle, brut) {
  const m = new Map();
  for (const l of retenues) {
    const { k, label } = cle(l);
    const e = m.get(k) || { cle: k, label, montant: 0 };
    e.montant += l.valeurEUR;
    m.set(k, e);
  }
  return [...m.values()]
    .sort((a, b) => b.montant - a.montant)
    .map((e) => ({ ...e, part: brut > 0 ? e.montant / brut : null }));
}

// Une entrée par date où quelque chose a bougé (valorisation ou flux externe), plus la date de référence.
// Valeur d'une ligne à une date = dernière valorisation connue à cette date (0 avant la première).
// Les taux de change actuels s'appliquent à tout l'historique : pas de taux historiques.
export function serieEvolution(retenues, dateRef) {
  const dates = new Set([dateRef]);
  for (const l of retenues) {
    for (const v of l.valorisations) dates.add(v.date);
    for (const o of l.operations) if (o.fluxExterne) dates.add(o.date);
  }
  return [...dates].sort().map((date) => {
    let valeur = 0;
    let capital = 0;
    for (const l of retenues) {
      let dv = null;
      for (const v of l.valorisations) {
        if (v.date <= date) dv = v; else break;
      }
      if (dv) valeur += dv.valeur * l.fx.taux;
      capital += capitalNetVerse(l.operations.filter((o) => o.date <= date)) * l.fx.taux;
    }
    return { date, valeur, capital, plusValue: valeur - capital };
  });
}

// Performance par compte (en EUR, lignes retenues seulement).
export function performanceParCompte(retenues) {
  const m = new Map();
  for (const l of retenues) {
    const e = m.get(l.compteId) || { compteId: l.compteId, libelle: l.compteLibelle, valeur: 0, capital: 0 };
    e.valeur += l.valeurEUR;
    e.capital += l.capitalEUR;
    m.set(l.compteId, e);
  }
  return [...m.values()]
    .map((e) => ({ ...e, plusValue: e.valeur - e.capital, ratio: e.capital > 0 ? (e.valeur - e.capital) / e.capital : null }))
    .sort((a, b) => b.valeur - a.valeur);
}
