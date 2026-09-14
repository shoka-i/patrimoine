import { getAll, getByIndex, get, put, del, uid } from '../db.js';
import { derniereValorisation, positionResume } from '../calc.js';
import { formatMontant, esc, aujourdHui } from '../format.js';
import { navigate, toast } from '../app.js';

const ENVELOPPES = [
  ['livret', 'Livret réglementé'],
  ['CTO', 'Compte-titres (CTO)'],
  ['PEA', 'PEA'],
  ['assurance-vie', 'Assurance-vie'],
  ['PER', 'PER'],
  ['crypto', 'Portefeuille crypto'],
  ['especes', 'Compte courant / espèces'],
  ['immobilier', 'Immobilier'],
  ['autre', 'Autre'],
];
const DEVISES = ['EUR', 'USD', 'GBP', 'CHF'];

function granulariteParDefaut(enveloppe) {
  if (enveloppe === 'assurance-vie' || enveloppe === 'PER') return 'globale';
  return 'ligne';
}

export async function vueComptesListe() {
  const comptes = await getAll('comptes');
  const lignes = [];
  for (const c of comptes) {
    const positions = await getByIndex('positions', 'compteId', c.id);
    let total = 0;
    for (const p of positions) {
      const v = await derniereValorisation(p.id);
      total += v ? v.valeur : 0;
    }
    lignes.push({ c, total, n: positions.length });
  }
  const html = `
  <div class="wrap">
    <a class="btn block" href="#/comptes/nouveau">+ Nouveau compte</a>
    ${lignes.length === 0 ? '<div class="empty">Aucun compte pour l\'instant.</div>' : lignes.map(({ c, total, n }) => `
      <a class="card" href="#/comptes/${c.id}">
        <div class="top"><span class="lbl">${esc(c.libelle)}</span><span class="val">${formatMontant(total, c.devise)}</span></div>
        <div class="meta">${esc(labelEnveloppe(c.enveloppe))}${c.etablissement ? ' · ' + esc(c.etablissement) : ''} · ${n} ligne${n === 1 ? '' : 's'}</div>
      </a>`).join('')}
  </div>`;
  return { html };
}

function labelEnveloppe(code) {
  return (ENVELOPPES.find((e) => e[0] === code) || [code, code])[1];
}

export async function vueCompteForm(id) {
  const compte = id ? await get('comptes', id) : null;
  if (id && !compte) return { html: '<div class="wrap"><p>Compte introuvable.</p></div>' };

  const html = `
  <div class="wrap">
    <form id="f-compte">
      <label class="req" for="libelle">Libellé</label>
      <input id="libelle" required value="${esc(compte?.libelle || '')}" placeholder="Ex. Livret A, PEA Boursorama">

      <label for="etablissement">Établissement</label>
      <input id="etablissement" value="${esc(compte?.etablissement || '')}" placeholder="Ex. Boursorama, Ledger">

      <label class="req" for="enveloppe">Type d'enveloppe</label>
      <select id="enveloppe">
        ${ENVELOPPES.map(([v, l]) => `<option value="${v}" ${compte?.enveloppe === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>

      <div class="row">
        <div>
          <label for="devise">Devise du compte</label>
          <select id="devise">
            ${DEVISES.map((d) => `<option ${compte?.devise === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="granularite">Granularité de saisie</label>
          <select id="granularite">
            <option value="ligne" ${compte?.granularite === 'ligne' ? 'selected' : ''}>Ligne à ligne</option>
            <option value="globale" ${compte?.granularite === 'globale' ? 'selected' : ''}>Valorisation globale</option>
          </select>
        </div>
      </div>
      <p class="hint">Ligne à ligne : une position par actif (CTO, PEA, crypto). Valorisation globale : un seul montant pour tout le contrat (assurance-vie, PER en gestion pilotée).</p>

      <div class="bar" style="margin-top:1.2rem">
        <button type="submit">${id ? 'Enregistrer' : 'Créer le compte'}</button>
        ${id ? '<button type="button" class="danger" id="btn-suppr">Supprimer</button>' : ''}
      </div>
    </form>
  </div>`;

  return {
    html,
    titre: id ? 'Modifier le compte' : 'Nouveau compte',
    after(root) {
      const envSel = root.querySelector('#enveloppe');
      const graSel = root.querySelector('#granularite');
      if (!id) envSel.addEventListener('change', () => { graSel.value = granulariteParDefaut(envSel.value); });
      if (!id) graSel.value = granulariteParDefaut(envSel.value);

      root.querySelector('#f-compte').addEventListener('submit', async (e) => {
        e.preventDefault();
        const libelle = root.querySelector('#libelle').value.trim();
        if (!libelle) return;
        const obj = {
          id: id || uid(),
          libelle,
          etablissement: root.querySelector('#etablissement').value.trim(),
          enveloppe: envSel.value,
          devise: root.querySelector('#devise').value,
          granularite: graSel.value,
          dateCreation: compte?.dateCreation || aujourdHui(),
        };
        await put('comptes', obj);
        toast('Compte enregistré');
        navigate('#/comptes/' + obj.id);
      });

      const btnSuppr = root.querySelector('#btn-suppr');
      if (btnSuppr) {
        btnSuppr.addEventListener('click', async () => {
          const positions = await getByIndex('positions', 'compteId', id);
          if (positions.length) {
            toast('Impossible : ce compte contient encore ' + positions.length + ' ligne(s). Supprime-les d\'abord.');
            return;
          }
          if (!confirm('Supprimer définitivement ce compte ?')) return;
          await del('comptes', id);
          toast('Compte supprimé');
          navigate('#/comptes');
        });
      }
    },
  };
}

export async function vueCompteDetail(id) {
  const compte = await get('comptes', id);
  if (!compte) return { html: '<div class="wrap"><p>Compte introuvable.</p></div>', titre: 'Compte' };
  const positions = await getByIndex('positions', 'compteId', id);
  const actifs = await getAll('actifs');
  const actifById = Object.fromEntries(actifs.map((a) => [a.id, a]));

  const resumes = await Promise.all(positions.map(async (p) => ({ p, r: await positionResume(p.id) })));
  const total = resumes.reduce((s, x) => s + (x.r.valeur || 0), 0);
  const seuleLigne = compte.granularite === 'globale' && positions.length === 1;

  const html = `
  <div class="wrap">
    <p class="sub">${labelEnveloppe(compte.enveloppe)}${compte.etablissement ? ' · ' + esc(compte.etablissement) : ''} · ${compte.devise}</p>

    <div class="totalcard">
      <div class="lign net"><span>Valeur actuelle</span><span>${formatMontant(total, compte.devise)}</span></div>
    </div>

    <div class="bar">
      <a class="btn small" href="#/comptes/${id}/modifier">Modifier le compte</a>
    </div>

    <h2>${compte.granularite === 'globale' ? 'Valorisation' : 'Lignes'}</h2>
    ${resumes.length === 0 ? '<div class="empty">Aucune ligne. Ajoute la première ci-dessous.</div>' : resumes.map(({ p, r }) => {
      const actif = actifById[p.actifId];
      return `<a class="list-item" href="#/positions/${p.id}">
        <div class="l">
          <div class="t1">${esc(actif?.nom || 'Position')}</div>
          <div class="t2">${r.dateValeur ? 'maj ' + esc(r.dateValeur) : 'aucune valorisation'}${r.plusValue !== null ? ' · ' + (r.plusValue >= 0 ? '+' : '') + formatMontant(r.plusValue, compte.devise) : ''}</div>
        </div>
        <div class="r">${formatMontant(r.valeur, compte.devise)}</div>
      </a>`;
    }).join('')}

    ${(compte.granularite === 'ligne' || positions.length === 0) ? `<a class="btn ghost block" href="#/comptes/${id}/positions/nouveau">+ Ajouter une ligne</a>` : ''}
  </div>`;

  return { html, titre: compte.libelle };
}
