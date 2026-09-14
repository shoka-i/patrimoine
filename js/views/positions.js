import { get, getAll, getByIndex, put, del, uid } from '../db.js';
import { positionResume, derniereValorisation, parOrdreRecent } from '../calc.js';
import { formatMontant, formatDate, formatNombre, parseNombre, esc, aujourdHui } from '../format.js';
import { navigate, toast } from '../app.js';

const CLASSES = [
  ['actions', 'Actions / ETF / parts'],
  ['obligations', 'Obligations / fonds €'],
  ['cash', 'Cash / monétaire'],
  ['crypto', 'Crypto-actif'],
  ['immobilier', 'Immobilier'],
  ['autre', 'Autre'],
];

const TYPES_OP = [
  ['versement', 'Versement', true],
  ['retrait', 'Retrait', true],
  ['arbitrage_entree', 'Arbitrage — entrée', false],
  ['arbitrage_sortie', 'Arbitrage — sortie', false],
  ['interets', 'Intérêts', false],
  ['dividende', 'Dividende', false],
];

function labelType(code) {
  return (TYPES_OP.find((t) => t[0] === code) || [code, code])[1];
}
function fluxExterneDeType(code) {
  return (TYPES_OP.find((t) => t[0] === code) || [null, null, false])[2];
}
function labelClasse(code) {
  return (CLASSES.find((c) => c[0] === code) || [code, code])[1];
}

async function trouverOuCreerActif(nom, classe, symbole, devise) {
  const actifs = await getAll('actifs');
  const existant = actifs.find((a) => a.nom.trim().toLowerCase() === nom.trim().toLowerCase());
  if (existant) return existant;
  const nouveau = { id: uid(), nom: nom.trim(), classe, symbole: symbole.trim(), devise };
  await put('actifs', nouveau);
  return nouveau;
}

export async function vuePositionForm(compteId, positionId) {
  const compte = await get('comptes', compteId);
  if (!compte) return { html: '<div class="wrap"><p>Compte introuvable.</p></div>' };
  const globale = compte.granularite === 'globale';

  const actifs = await getAll('actifs');
  const datalist = `<datalist id="dl-actifs">${actifs.map((a) => `<option value="${esc(a.nom)}">`).join('')}</datalist>`;

  const html = `
  <div class="wrap">
    <p class="sub">${globale ? 'Contrat suivi en valorisation globale.' : 'Nouvelle ligne dans ' + esc(compte.libelle) + '.'}</p>
    <form id="f-pos">
      <label class="req" for="nom">${globale ? 'Nom du contrat / support' : "Nom de l'actif"}</label>
      <input id="nom" required list="dl-actifs" placeholder="${globale ? 'Ex. Fonds euro, Gestion pilotée équilibrée' : 'Ex. Amundi MSCI World (CW8), Bitcoin, Livret A'}">
      ${datalist}

      ${globale ? '' : `
      <div class="row">
        <div>
          <label for="classe">Classe</label>
          <select id="classe">${CLASSES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        </div>
        <div>
          <label for="symbole">Symbole / ticker</label>
          <input id="symbole" placeholder="Ex. CW8.PA, BTC">
        </div>
      </div>
      <label for="quantite">Quantité (facultatif — vide pour du cash)</label>
      <input id="quantite" class="mono-field" inputmode="decimal" placeholder="Ex. 12,5">
      <label for="adresse">Adresse publique (facultatif, crypto)</label>
      <input id="adresse" class="mono-field" placeholder="Adresse on-chain">
      `}

      <label class="req" for="valeur">Solde de départ (valeur actuelle à la date d'ouverture)</label>
      <input id="valeur" required class="mono-field" inputmode="decimal" placeholder="Ex. 1500,00">
      <p class="hint">Enregistré comme le premier versement de cette ligne : c'est le point de départ, pas une reprise d'historique.</p>

      <label class="req" for="date">Date d'ouverture</label>
      <input id="date" required type="date" value="${aujourdHui()}">

      <div class="bar" style="margin-top:1.2rem">
        <button type="submit">Créer la ligne</button>
      </div>
    </form>
  </div>`;

  return {
    html,
    titre: globale ? 'Nouvelle valorisation' : 'Nouvelle ligne',
    after(root) {
      root.querySelector('#f-pos').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = root.querySelector('#nom').value.trim();
        const valeur = parseNombre(root.querySelector('#valeur').value);
        const date = root.querySelector('#date').value;
        if (!nom || Number.isNaN(valeur) || !date) return;

        const classe = globale ? 'autre' : root.querySelector('#classe').value;
        const symbole = globale ? '' : root.querySelector('#symbole').value;
        const quantiteRaw = globale ? '' : root.querySelector('#quantite').value.trim();
        const quantite = quantiteRaw ? parseNombre(quantiteRaw) : null;
        const adresse = globale ? '' : root.querySelector('#adresse').value.trim();

        const actif = await trouverOuCreerActif(nom, classe, symbole, compte.devise);
        const position = {
          id: uid(),
          compteId,
          actifId: actif.id,
          quantite,
          adresse,
          dateOuverture: date,
        };
        await put('positions', position);
        await put('valorisations', {
          id: uid(), positionId: position.id, date, valeur, devise: compte.devise, source: 'saisie', creeLe: Date.now(),
        });
        await put('operations', {
          id: uid(), positionId: position.id, compteId, type: 'versement', date,
          montant: valeur, quantite, fluxExterne: true, creeLe: Date.now(),
        });
        toast('Ligne créée');
        navigate('#/positions/' + position.id);
      });
    },
  };
}

export async function vuePositionDetail(id) {
  const position = await get('positions', id);
  if (!position) return { html: '<div class="wrap"><p>Ligne introuvable.</p></div>', titre: 'Ligne' };
  const [compte, actif, resume] = await Promise.all([
    get('comptes', position.compteId), get('actifs', position.actifId), positionResume(id),
  ]);
  const valorisations = (await getByIndex('valorisations', 'positionId', id)).sort(parOrdreRecent);
  const operations = resume.operations.slice().sort(parOrdreRecent);

  const html = `
  <div class="wrap">
    <p class="sub">${esc(compte?.libelle || '')}${actif?.classe ? ' · ' + labelClasse(actif.classe) : ''}${actif?.symbole ? ' · ' + esc(actif.symbole) : ''}${position.quantite != null ? ' · ' + formatNombre(position.quantite, 6) + ' unité(s)' : ''}</p>
    ${position.adresse ? `<p class="mono hint">${esc(position.adresse)}</p>` : ''}

    <div class="totalcard">
      <div class="lign"><span class="lbl">Valeur actuelle${resume.dateValeur ? ' (' + formatDate(resume.dateValeur) + ')' : ''}</span><span>${formatMontant(resume.valeur, compte?.devise)}</span></div>
      <div class="lign"><span class="lbl">Capital net versé</span><span>${formatMontant(resume.capitalVerse, compte?.devise)}</span></div>
      <div class="lign net"><span>Plus-value</span><span>${resume.plusValue >= 0 ? '+' : ''}${formatMontant(resume.plusValue, compte?.devise)}</span></div>
    </div>

    <h2>Mettre à jour la valeur</h2>
    <form id="f-val">
      <div class="row">
        <div>
          <label class="req" for="v-valeur">Nouvelle valeur</label>
          <input id="v-valeur" required class="mono-field" inputmode="decimal" placeholder="${resume.valeur ? formatNombre(resume.valeur) : ''}">
          <p class="hint">Précédente : ${formatMontant(resume.valeur, compte?.devise)}</p>
        </div>
        <div>
          <label class="req" for="v-date">Date</label>
          <input id="v-date" required type="date" value="${aujourdHui()}">
        </div>
      </div>
      <button type="submit" class="ghost block">Enregistrer la valorisation</button>
    </form>

    <h2>Ajouter une opération</h2>
    <form id="f-op">
      <div class="row">
        <div>
          <label class="req" for="o-type">Type</label>
          <select id="o-type">${TYPES_OP.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        </div>
        <div>
          <label class="req" for="o-date">Date</label>
          <input id="o-date" required type="date" value="${aujourdHui()}">
        </div>
      </div>
      <label class="req" for="o-montant">Montant</label>
      <input id="o-montant" required class="mono-field" inputmode="decimal" placeholder="Ex. 200,00">
      ${position.quantite != null ? '<label for="o-quantite">Variation de quantité (facultatif)</label><input id="o-quantite" class="mono-field" inputmode="decimal">' : ''}
      <button type="submit" class="ghost block">Ajouter l'opération</button>
    </form>

    <h2>Historique des opérations</h2>
    ${operations.length === 0 ? '<div class="empty">Aucune opération.</div>' : `
    <table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Flux</th><th>Montant</th></tr></thead><tbody>
      ${operations.map((o) => `<tr><td>${formatDate(o.date)}</td><td>${labelType(o.type)}</td><td>${o.fluxExterne ? 'externe' : 'interne'}</td><td class="num">${formatMontant(o.type === 'retrait' ? -o.montant : o.montant, compte?.devise)}</td></tr>`).join('')}
    </tbody></table>`}

    <h2>Historique des valorisations</h2>
    ${valorisations.length === 0 ? '<div class="empty">Aucune valorisation.</div>' : `
    <table class="tbl"><thead><tr><th>Date</th><th>Source</th><th>Valeur</th></tr></thead><tbody>
      ${valorisations.map((v) => `<tr><td>${formatDate(v.date)}</td><td>${esc(v.source)}</td><td class="num">${formatMontant(v.valeur, v.devise)}</td></tr>`).join('')}
    </tbody></table>`}

    <div class="bar" style="margin-top:1.5rem">
      <button type="button" class="danger" id="btn-suppr-pos">Supprimer cette ligne</button>
    </div>
  </div>`;

  return {
    html,
    titre: actif?.nom || 'Ligne',
    after(root) {
      root.querySelector('#f-val').addEventListener('submit', async (e) => {
        e.preventDefault();
        const valeur = parseNombre(root.querySelector('#v-valeur').value);
        const date = root.querySelector('#v-date').value;
        if (Number.isNaN(valeur) || !date) return;
        await put('valorisations', { id: uid(), positionId: id, date, valeur, devise: compte?.devise || 'EUR', source: 'saisie', creeLe: Date.now() });
        toast('Valorisation enregistrée');
        navigate('#/positions/' + id);
      });

      root.querySelector('#f-op').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = root.querySelector('#o-type').value;
        const date = root.querySelector('#o-date').value;
        const montant = parseNombre(root.querySelector('#o-montant').value);
        if (Number.isNaN(montant) || !date) return;
        const qEl = root.querySelector('#o-quantite');
        const quantite = qEl && qEl.value.trim() ? parseNombre(qEl.value) : null;
        await put('operations', {
          id: uid(), positionId: id, compteId: position.compteId, type, date, montant, quantite,
          fluxExterne: fluxExterneDeType(type), creeLe: Date.now(),
        });
        toast('Opération ajoutée');
        navigate('#/positions/' + id);
      });

      root.querySelector('#btn-suppr-pos').addEventListener('click', async () => {
        if (!confirm('Supprimer cette ligne et tout son historique ?')) return;
        for (const o of operations) await del('operations', o.id);
        for (const v of valorisations) await del('valorisations', v.id);
        await del('positions', id);
        toast('Ligne supprimée');
        navigate('#/comptes/' + position.compteId);
      });
    },
  };
}
