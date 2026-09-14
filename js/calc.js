// Calculs dérivés du modèle. Rien ici n'est une estimation : tout sort des données saisies.
import { getByIndex } from './db.js';

// Capital net versé = somme des opérations à flux_externe=true (versements positifs, retraits négatifs).
export function capitalNetVerse(operations) {
  return operations
    .filter((o) => o.fluxExterne)
    .reduce((s, o) => s + (o.type === 'retrait' ? -o.montant : o.montant), 0);
}

export function parOrdreRecent(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.creeLe || 0) - (a.creeLe || 0);
}

export async function derniereValorisation(positionId) {
  const vals = await getByIndex('valorisations', 'positionId', positionId);
  if (!vals.length) return null;
  return vals.slice().sort(parOrdreRecent)[0];
}

export async function positionResume(positionId) {
  const [ops, val] = await Promise.all([
    getByIndex('operations', 'positionId', positionId),
    derniereValorisation(positionId),
  ]);
  const verse = capitalNetVerse(ops);
  const valeur = val ? val.valeur : 0;
  return {
    valeur,
    dateValeur: val ? val.date : null,
    sourceValeur: val ? val.source : null,
    capitalVerse: verse,
    plusValue: val ? valeur - verse : null,
    operations: ops,
  };
}
