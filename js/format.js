export function formatMontant(valeur, devise = 'EUR') {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise, maximumFractionDigits: 2 }).format(valeur);
  } catch (_) {
    return valeur.toFixed(2) + ' ' + devise;
  }
}

export function formatNombre(valeur, decimales = 2) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(valeur);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function aujourdHui() {
  return new Date().toISOString().slice(0, 10);
}

// Accepte "1234,56" ou "1234.56" ou "1 234,56"
export function parseNombre(saisie) {
  if (typeof saisie === 'number') return saisie;
  if (!saisie) return NaN;
  const nettoye = String(saisie).trim().replace(/\s/g, '').replace(',', '.');
  return parseFloat(nettoye);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
