# Décisions et verdicts

## Arbitrages de l'utilisateur (14/09/2026)

| Sujet | Décision |
|---|---|
| Hébergement | GitHub Pages, dépôt public. Le code est visible, les données ne quittent jamais le téléphone |
| Granularité | Paramétrable par compte : ligne à ligne sur CTO et PEA, valorisation globale sur assurance-vie |
| Historique | Solde de départ à la date d'installation, puis flux. Pas de reprise depuis l'origine |
| Adresses crypto | Adresses individuelles stockées dans l'app et présentes dans l'export. Pas d'xpub : la dérivation côté client impose une bibliothèque lourde et expose toutes les adresses d'un coup |
| Chiffrement | Pas de chiffrement applicatif en v1 — le téléphone est déjà chiffré par l'OS. Export JSON chiffrable en option |
| Rafraîchissement | Bouton manuel, plus une mise à jour automatique au maximum une fois par jour, désactivable |
| Passif | **Inclus en v1.** Prêts avec capital restant dû calculé par amortissement, recalable sur relevé annuel. L'écart entre calculé et relevé est affiché, jamais masqué |
| Immobilier | Type d'actif hors marché, valorisation manuelle rare, **exclu de l'allocation cible** |
| Patrimoine brut / net | Brut = actifs seuls, c'est la base des règles d'allocation. Net = brut − capital restant dû, affiché à part. Une dette n'est jamais une classe d'actifs négative : cela fausserait tous les pourcentages |
| Analyse par API (voie B) | En dernier, après M5. L'export Markdown à coller dans une conversation est la voie par défaut |

## Verdicts du banc d'essai (14/09/2026, Chrome Android, origine github.io)

### Acquis

| Source | Usage | Note |
|---|---|---|
| CoinGecko | Cours crypto, dont `staked-ether` | Sans clé, 321 ms. Palier public suffisant |
| mempool.space | Soldes Bitcoin par adresse | 252 ms. Source principale |
| blockstream.info | Soldes Bitcoin par adresse | 800 ms. Même API, opérateur différent : repli réel |
| Blockscout | Soldes ETH et jetons ERC-20 | Sans clé ni compte. **9,8 s** sur une adresse à très nombreux jetons : appel en arrière-plan obligatoire, valeur en cache affichée pendant ce temps |
| Frankfurter | Taux de change BCE | 264 ms |
| marketstack | Cours ETF, actions, Euronext | Clé gratuite, 100 requêtes/mois, cours de clôture. Format de symbole : `CW8.PA`, pas le code MIC. La devise est renvoyée par l'API |

### Écartés

| Source | Raison |
|---|---|
| Etherscan | Exige une clé là où Blockscout n'en demande aucune, et son palier gratuit s'est resserré en juillet 2026. Conservé en repli documenté, pas en dépendance |
| Twelve Data | Euronext réservé aux plans Pro ou Venture. HTTP 404 avec message de plan |
| Stooq | Aucun en-tête `Access-Control-Allow-Origin`. Le navigateur jette la réponse |
| Yahoo Finance | Idem. L'endpoint interne exige en outre un jeton de session |
| Agrégation DSP2 | Hors budget et hors modèle local |
| API privées d'exchange | Un secret HMAC stocké dans un navigateur mobile est un secret en clair. Remplacé par l'import du fichier d'export de l'exchange |
| Estimation par équivalent coté ailleurs | La tracking difference et le change fabriqueraient un chiffre faux affiché comme vrai. Entre deux saisies : dernière valeur connue et sa date |
| Relais CORS tiers | Dépendance à un service gratuit non contractuel, qui voit en outre la liste des ISIN interrogés |

### Ouvert

- **CORS de marketstack non vérifié.** Les appels de test ont été faits en ouvrant
  l'URL directement dans le navigateur, ce qui ne teste pas la politique CORS. À
  vérifier dans le connecteur lui-même, qui doit signaler son propre état. Si le
  CORS bloque, la saisie manuelle reprend son rôle nominal sans qu'une ligne
  d'architecture ne bouge.
- **Décalage de cotation.** Une action américaine remontait au 11/09 quand l'ETF
  Euronext remontait au 10/09. Décalage structurel du palier gratuit ou publication
  plus tardive dans la journée : à observer. Chaque valeur porte sa date de
  cotation, distincte de sa date de rafraîchissement.
- **Coût d'un appel groupé.** Inconnu : une requête ou une par symbole. Dans le pire
  cas, dix lignes coûtent 300 requêtes par mois et il faudra espacer à un appel tous
  les trois jours, ce qui reste acceptable pour du cours de clôture.

## Conséquence structurelle sur la bourse

marketstack couvre Euronext, mais sous réserve du CORS et avec un budget serré.
**La saisie manuelle des valorisations reste le mode nominal**, pas un repli :
écran conçu pour ça — une ligne par position, un champ nombre, date préremplie,
valeur précédente affichée à côté pour repérer une faute de frappe. Le connecteur
préremplit ces champs quand il fonctionne ; il ne remplace jamais l'écran.

## Modèle de données arrêté

Neuf collections : `comptes`, `actifs`, `positions`, `operations`, `valorisations`,
`cours` et `changes`, `dettes`, `strategie`, `reglages`.

Deux invariants portent tout le reste :

1. **Un livret est une position** de type espèces en euros, au même titre qu'une
   ligne d'ETF. Modèle uniforme, un seul moteur de calcul.
2. **Le champ `flux_externe`** sur chaque opération sépare versements et plus-values.
   Capital net versé = somme des flux externes. Plus-value = valorisation courante
   moins capital net versé. Sans ce champ, aucune analyse de performance n'est possible.
