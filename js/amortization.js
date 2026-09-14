// Amortissement d'un prêt à mensualités constantes (méthode française standard).
// Calcul déterministe, reproductible — aucune approximation par tableau externe.

function moisEcoules(dateDebutISO, dateRefISO) {
  const d0 = new Date(dateDebutISO + 'T00:00:00');
  const d1 = new Date(dateRefISO + 'T00:00:00');
  let mois = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth());
  if (d1.getDate() < d0.getDate()) mois -= 1;
  return mois;
}

export function mensualite(capitalInitial, tauxAnnuelPct, dureeMois) {
  const i = tauxAnnuelPct / 100 / 12;
  if (dureeMois <= 0) return 0;
  if (i === 0) return capitalInitial / dureeMois;
  return (capitalInitial * i) / (1 - Math.pow(1 + i, -dureeMois));
}

// Capital restant dû calculé à une date de référence, par la formule fermée
// (pas de boucle mois par mois : CRD_k = C0(1+i)^k - M((1+i)^k - 1)/i).
export function capitalRestantDu(dette, dateRefISO = new Date().toISOString().slice(0, 10)) {
  const { capitalInitial, tauxAnnuel, dureeMois, dateDebut } = dette;
  const k = Math.max(0, Math.min(dureeMois, moisEcoules(dateDebut, dateRefISO)));
  if (k <= 0) return { crd: capitalInitial, moisEcoules: 0, solde: false };
  if (k >= dureeMois) return { crd: 0, moisEcoules: k, solde: true };
  const i = tauxAnnuel / 100 / 12;
  const M = mensualite(capitalInitial, tauxAnnuel, dureeMois);
  let crd;
  if (i === 0) {
    crd = capitalInitial - M * k;
  } else {
    crd = capitalInitial * Math.pow(1 + i, k) - M * ((Math.pow(1 + i, k) - 1) / i);
  }
  return { crd: Math.max(0, Math.round(crd * 100) / 100), moisEcoules: k, solde: false };
}
