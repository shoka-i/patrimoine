import { get, getAll, put, del, uid } from '../db.js';
import { capitalRestantDu, mensualite } from '../amortization.js';
import { formatMontant, formatDate, formatNombre, parseNombre, esc, aujourdHui } from '../format.js';
import { navigate, toast } from '../app.js';

const TYPES = [
  ['immobilier', 'Prêt immobilier'],
  ['consommation', 'Crédit conso'],
  ['autre', 'Autre'],
];
function labelType(code) {
  return (TYPES.find((t) => t[0] === code) || [code, code])[1];
}

export async function vueDettesListe() {
  const dettes = await getAll('dettes');
  const html = `
  <div class="wrap">
    <a class="btn block" href="#/dettes/nouveau">+ Nouvelle dette</a>
    ${dettes.length === 0 ? '<div class="empty">Aucune dette enregistrée.</div>' : dettes.map((d) => {
      const { crd } = capitalRestantDu(d);
      return `<a class="card" href="#/dettes/${d.id}">
        <div class="top"><span class="lbl">${esc(d.libelle)}<span class="tag passif">passif</span></span><span class="val">${formatMontant(crd)}</span></div>
        <div class="meta">${labelType(d.type)}${d.etablissement ? ' · ' + esc(d.etablissement) : ''}</div>
      </a>`;
    }).join('')}
  </div>`;
  return { html };
}

export async function vueDetteForm(id) {
  const dette = id ? await get('dettes', id) : null;
  if (id && !dette) return { html: '<div class="wrap"><p>Dette introuvable.</p></div>' };

  const html = `
  <div class="wrap">
    <form id="f-dette">
      <label class="req" for="libelle">Libellé</label>
      <input id="libelle" required value="${esc(dette?.libelle || '')}" placeholder="Ex. Prêt résidence principale">

      <label for="etablissement">Établissement prêteur</label>
      <input id="etablissement" value="${esc(dette?.etablissement || '')}">

      <label for="type">Type</label>
      <select id="type">${TYPES.map(([v, l]) => `<option value="${v}" ${dette?.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>

      <div class="row">
        <div>
          <label class="req" for="capital">Capital emprunté</label>
          <input id="capital" required class="mono-field" inputmode="decimal" value="${dette ? formatNombre(dette.capitalInitial) : ''}">
        </div>
        <div>
          <label class="req" for="taux">Taux annuel (%)</label>
          <input id="taux" required class="mono-field" inputmode="decimal" value="${dette ? formatNombre(dette.tauxAnnuel, 3) : ''}" placeholder="Ex. 3,5">
        </div>
      </div>
      <div class="row">
        <div>
          <label class="req" for="duree">Durée (mois)</label>
          <input id="duree" required class="mono-field" inputmode="numeric" value="${dette?.dureeMois || ''}" placeholder="Ex. 240">
        </div>
        <div>
          <label class="req" for="debut">Date de début</label>
          <input id="debut" required type="date" value="${dette?.dateDebut || aujourdHui()}">
        </div>
      </div>

      <label for="notes">Notes</label>
      <textarea id="notes">${esc(dette?.notes || '')}</textarea>

      <div class="bar" style="margin-top:1.2rem">
        <button type="submit">${id ? 'Enregistrer' : 'Créer la dette'}</button>
        ${id ? '<button type="button" class="danger" id="btn-suppr">Supprimer</button>' : ''}
      </div>
    </form>
  </div>`;

  return {
    html,
    titre: id ? 'Modifier la dette' : 'Nouvelle dette',
    after(root) {
      root.querySelector('#f-dette').addEventListener('submit', async (e) => {
        e.preventDefault();
        const libelle = root.querySelector('#libelle').value.trim();
        const capitalInitial = parseNombre(root.querySelector('#capital').value);
        const tauxAnnuel = parseNombre(root.querySelector('#taux').value);
        const dureeMois = parseInt(root.querySelector('#duree').value, 10);
        const dateDebut = root.querySelector('#debut').value;
        if (!libelle || Number.isNaN(capitalInitial) || Number.isNaN(tauxAnnuel) || !dureeMois || !dateDebut) return;
        const obj = {
          id: id || uid(),
          libelle,
          etablissement: root.querySelector('#etablissement').value.trim(),
          type: root.querySelector('#type').value,
          capitalInitial, tauxAnnuel, dureeMois, dateDebut,
          notes: root.querySelector('#notes').value.trim(),
          releves: dette?.releves || [],
        };
        await put('dettes', obj);
        toast('Dette enregistrée');
        navigate('#/dettes/' + obj.id);
      });

      const btnSuppr = root.querySelector('#btn-suppr');
      if (btnSuppr) {
        btnSuppr.addEventListener('click', async () => {
          if (!confirm('Supprimer définitivement cette dette ?')) return;
          await del('dettes', id);
          toast('Dette supprimée');
          navigate('#/dettes');
        });
      }
    },
  };
}

export async function vueDetteDetail(id) {
  const dette = await get('dettes', id);
  if (!dette) return { html: '<div class="wrap"><p>Dette introuvable.</p></div>', titre: 'Dette' };

  const { crd, moisEcoules, solde } = capitalRestantDu(dette);
  const M = mensualite(dette.capitalInitial, dette.tauxAnnuel, dette.dureeMois);
  const releves = (dette.releves || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const dernier = releves[0] || null;
  const ecart = dernier ? dernier.valeur - crd : null;

  const html = `
  <div class="wrap">
    <p class="sub">${labelType(dette.type)}${dette.etablissement ? ' · ' + esc(dette.etablissement) : ''}</p>

    <div class="totalcard">
      <div class="lign"><span class="lbl">Capital emprunté</span><span>${formatMontant(dette.capitalInitial)}</span></div>
      <div class="lign"><span class="lbl">Taux annuel</span><span>${formatNombre(dette.tauxAnnuel, 3)} %</span></div>
      <div class="lign"><span class="lbl">Mensualité</span><span>${formatMontant(M)}</span></div>
      <div class="lign"><span class="lbl">Durée écoulée</span><span>${moisEcoules} / ${dette.dureeMois} mois</span></div>
      <div class="lign net"><span>${solde ? 'Prêt soldé' : 'Capital restant dû (calculé)'}</span><span>${formatMontant(crd)}</span></div>
    </div>

    ${dernier ? `
    <div class="notice ${Math.abs(ecart) > 1 ? 'warn' : ''}">
      <p>Dernier relevé : ${formatMontant(dernier.valeur)} au ${formatDate(dernier.date)}.</p>
      <p>Écart avec le calcul : ${ecart >= 0 ? '+' : ''}${formatMontant(ecart)} ${Math.abs(ecart) > 1 ? '— vérifie le relevé ou le taux saisi.' : '— cohérent.'}</p>
    </div>` : `<div class="notice">Aucun relevé enregistré. Le montant ci-dessus est purement calculé par amortissement.</div>`}

    <h2>Enregistrer un relevé</h2>
    <p class="hint">Recopie le capital restant dû affiché sur ton relevé annuel : l'écart avec le calcul reste visible, jamais masqué.</p>
    <form id="f-releve">
      <div class="row">
        <div>
          <label class="req" for="r-valeur">Capital restant dû (relevé)</label>
          <input id="r-valeur" required class="mono-field" inputmode="decimal">
        </div>
        <div>
          <label class="req" for="r-date">Date du relevé</label>
          <input id="r-date" required type="date" value="${aujourdHui()}">
        </div>
      </div>
      <button type="submit" class="ghost block">Enregistrer le relevé</button>
    </form>

    ${releves.length > 1 ? `
    <h2>Historique des relevés</h2>
    <table class="tbl"><thead><tr><th>Date</th><th>Valeur</th></tr></thead><tbody>
      ${releves.map((r) => `<tr><td>${formatDate(r.date)}</td><td class="num">${formatMontant(r.valeur)}</td></tr>`).join('')}
    </tbody></table>` : ''}

    <div class="bar" style="margin-top:1.5rem">
      <a class="btn small" href="#/dettes/${id}/modifier">Modifier</a>
    </div>
  </div>`;

  return {
    html,
    titre: dette.libelle,
    after(root) {
      root.querySelector('#f-releve').addEventListener('submit', async (e) => {
        e.preventDefault();
        const valeur = parseNombre(root.querySelector('#r-valeur').value);
        const date = root.querySelector('#r-date').value;
        if (Number.isNaN(valeur) || !date) return;
        const nouveau = { ...dette, releves: [...(dette.releves || []), { date, valeur }] };
        await put('dettes', nouveau);
        toast('Relevé enregistré');
        navigate('#/dettes/' + id);
      });
    },
  };
}
