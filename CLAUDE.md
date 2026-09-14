# Application personnelle de suivi et d'analyse d'épargne

PWA mono-utilisateur, installée sur un téléphone Android, qui centralise la vision
du patrimoine (actif et passif), suit l'écart entre une stratégie définie et la
réalité, et produit ponctuellement une analyse approfondie.

Référence fonctionnelle : Finary, pour la centralisation et l'analyse — pas pour
l'agrégation bancaire automatisée, qui est hors de portée.

## Interlocuteur

Consultant en cybersécurité. Niveau fonctionnel solide, technique débutant.
**Il ne lit pas et n'écrit pas de code.** Ne jamais lui demander de modifier une
ligne : écrire le fichier, puis dire quoi tester et comment. Toute procédure
s'adresse à quelqu'un qui découvre l'outil concerné.

Langue de travail : français.

## Contraintes non négociables

- **Zéro euro récurrent.** Aucune API payante, aucun abonnement, aucun hébergement
  payant. Seule exception validée : l'appel LLM à la demande, facturé à l'usage.
- **Données locales uniquement.** IndexedDB sur le téléphone. Aucun backend, aucun
  compte, aucune télémétrie, aucune police ni ressource chargée depuis un CDN tiers.
  Rien ne sort sans action explicite de l'utilisateur.
- **Installable** sur l'écran d'accueil Android, plein écran, sans barre de navigateur.
- **Hors ligne.** Consultation et saisie fonctionnent sans réseau. Seules les mises
  à jour de cours exigent une connexion.
- **Aucune chaîne d'outils.** Pas de build, pas de compilation, pas de gestionnaire
  de paquets, pas de framework. Fichiers statiques, modules ES natifs, JavaScript
  sans dépendance.
- **Sauvegarde.** Export JSON complet et réimport, déclenchés manuellement.

## Garde-fous

- **Calcul et commentaire sont séparés.** Tout chiffre affiché sort d'un calcul
  déterministe et reproductible. Le LLM commente, il ne calcule jamais.
- **Pas de conseil en investissement.** Les sorties sont des constats factuels sur
  un écart, une concentration, un seuil. Jamais « tu devrais acheter X ».
- **Fiscalité : rien de mémorisé.** Tout plafond, taux, seuil ou durée d'antériorité
  se vérifie contre une source officielle (service-public.fr, impots.gouv.fr,
  Banque de France), s'affiche avec sa date de vérification, et reste modifiable
  par l'utilisateur sans toucher au code.
- **Traçabilité.** Chaque valeur affichée porte sa source et son horodatage :
  saisie manuelle, import de fichier, ou nom de l'API.
- **Aucun connecteur n'est une dépendance dure.** Si une API disparaît, l'application
  continue en mode saisie. Tout ce qui est automatisable reste saisissable à la main.

## Méthode

Un module à la fois. Chaque livraison comprend : les fichiers complets, ce qui est
testable immédiatement, ce qui reste en attente, les limites connues.

Une PWA installable et fonctionnelle existe dès la fin du premier module de code.

Signaler une incertitude plutôt que la combler par plausibilité — en particulier
sur les conditions d'accès aux API et sur les règles fiscales. Poser les questions
de clarification avant de produire, pas après. Si une demande est infaisable dans
ce cadre, le dire immédiatement et proposer le repli le plus proche.

Réponses structurées et denses : une demi-page exploitable vaut mieux que trois
pages exhaustives.

## Modules

| | | Statut |
|---|---|---|
| M0 | Banc d'essai des connecteurs | fait |
| M1 | Modèle de données et saisie (actif et passif) + PWA installable | en cours |
| M2 | Vue patrimoine : répartition, évolution, capital versé vs performance | |
| M3 | Stratégie et moteur de règles | |
| M4 | Connecteurs de données | |
| M5 | Analyse (export Markdown, puis appel API) | |
| M6 | Enveloppes fiscales françaises | |

## Avant de démarrer un module

Lire `docs/decisions.md` : arbitrages de l'utilisateur et verdicts datés sur les
sources de données. Le cadrage d'origine est dans `docs/cadrage.md`.

## Déploiement

GitHub Pages, dépôt `patrimoine`, branche `main`, racine. Le point d'entrée doit
s'appeler `index.html` à la racine. Le dépôt est public : il ne contient que du
code, jamais de données financières, jamais de clé API.
