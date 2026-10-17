import { get, put, getAll, del, exportAll, importAll } from '../db.js';
import { formatDate, formatNombre, parseNombre, aujourdHui, esc } from '../format.js';
import { navigate, toast } from '../app.js';

export async function vueReglages() {
  const reglages = (await get('reglages', 'main')) || {};
  const taux = (await getAll('changes')).sort((a, b) => a.id.localeCompare(b.id));

  const html = `
  <div class="wrap">
    <h2>Taux de change</h2>
    <p class="sub">Nécessaire seulement pour un compte hors euro. Sans taux saisi, ses lignes sont exclues des totaux et signalées. Saisie manuelle, datée ; les cours automatiques viendront avec le module connecteurs.</p>
    ${taux.length ? `<table class="tbl"><thead><tr><th>Devise</th><th>Taux</th><th>Date</th><th></th></tr></thead><tbody>
      ${taux.map((t) => `<tr><td>${esc(t.id)}</td><td class="num">1 ${esc(t.id)} = ${formatNombre(t.taux, 6)} €</td><td>${formatDate(t.date)}</td><td><button type="button" class="small danger" data-suppr-taux="${esc(t.id)}">Retirer</button></td></tr>`).join('')}
    </tbody></table>` : ''}
    <form id="f-taux">
      <div class="row">
        <div><label for="t-devise">Devise</label><select id="t-devise"><option>USD</option><option>GBP</option><option>CHF</option></select></div>
        <div><label for="t-taux">1 unité = … €</label><input id="t-taux" required class="mono-field" inputmode="decimal" placeholder="Ex. 0,92"></div>
      </div>
      <label for="t-date">Date du taux</label>
      <input id="t-date" required type="date" value="${aujourdHui()}">
      <button type="submit" class="ghost block" style="margin-top:.7rem">Enregistrer le taux</button>
    </form>

    <h2>Sauvegarde</h2>
    <p class="sub">Toutes les données restent sur ce téléphone, dans le navigateur. Rien n'est envoyé ailleurs. L'export JSON est ta seule sauvegarde : sans lui, perdre le téléphone signifie perdre les données.</p>
    <button id="btn-export" class="block">Exporter toutes mes données (JSON)</button>

    <h2>Réimporter une sauvegarde</h2>
    <div class="notice warn"><p>L'import remplace entièrement les données actuelles par celles du fichier. Cette action n'est pas réversible.</p></div>
    <input type="file" id="f-import" accept="application/json,.json">

    <h2>À propos</h2>
    <table class="tbl">
      <tr><td>Devise principale</td><td class="num">${reglages.devisePrincipale || 'EUR'}</td></tr>
      <tr><td>Installée le</td><td class="num">${formatDate(reglages.dateInstallation)}</td></tr>
      <tr><td>Module en cours</td><td class="num">M2</td></tr>
    </table>
  </div>`;

  return {
    html,
    after(root) {
      root.querySelector('#f-taux').addEventListener('submit', async (e) => {
        e.preventDefault();
        const devise = root.querySelector('#t-devise').value;
        const valeur = parseNombre(root.querySelector('#t-taux').value);
        const date = root.querySelector('#t-date').value;
        if (!(valeur > 0) || !date) { toast('Taux invalide'); return; }
        await put('changes', { id: devise, taux: valeur, date, source: 'saisie', creeLe: Date.now() });
        toast('Taux enregistré');
        navigate('#/reglages');
      });
      root.querySelectorAll('[data-suppr-taux]').forEach((b) => b.addEventListener('click', async () => {
        await del('changes', b.dataset.supprTaux);
        navigate('#/reglages');
      }));

      root.querySelector('#btn-export').addEventListener('click', async () => {
        const dump = await exportAll();
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'patrimoine-export-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('Export lancé');
      });

      root.querySelector('#f-import').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm('Remplacer toutes les données actuelles par le contenu de ce fichier ?')) {
          e.target.value = '';
          return;
        }
        try {
          const texte = await file.text();
          const payload = JSON.parse(texte);
          await importAll(payload);
          toast('Import terminé');
          navigate('#/');
        } catch (err) {
          alert("Échec de l'import : " + (err && err.message ? err.message : err));
        }
        e.target.value = '';
      });
    },
  };
}
