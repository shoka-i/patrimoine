import { get, put, exportAll, importAll } from '../db.js';
import { formatDate } from '../format.js';
import { navigate, toast } from '../app.js';

export async function vueReglages() {
  const reglages = (await get('reglages', 'main')) || {};

  const html = `
  <div class="wrap">
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
      <tr><td>Module en cours</td><td class="num">M1</td></tr>
    </table>
  </div>`;

  return {
    html,
    after(root) {
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
