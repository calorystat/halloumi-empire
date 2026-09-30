# Halloumi Empire — V0

Jeu idle mobile jouable dans le navigateur. Trois postes (ferme, fromagerie, grill), actions manuelles, automatisation, améliorations, sauvegarde locale et production hors ligne plafonnée à quatre heures. Aucun compte, paiement, publicité ou serveur.

## GitHub sans terminal

1. Créer un dépôt **public** sur GitHub (branche `main`). Décompresser l'archive puis, dans **Add file → Upload files**, glisser le **contenu** du dossier `halloumi-empire-v0`, et non le dossier lui-même. Vérifier que `package.json`, `astro.config.mjs`, `netlify.toml`, `src/pages/index.astro`, `src/scripts/game.js` et `.github/workflows/pages.yml` sont visibles à ces emplacements. L'interface GitHub peut ignorer les dossiers commençant par un point lors d'un glisser-déposer : si `.github/workflows/pages.yml` manque, utiliser **Add file → Create new file**, saisir ce chemin, et coller le contenu de l'archive.
2. Commit sur `main`. Dans **Settings → Pages → Build and deployment → Source**, sélectionner **GitHub Actions**. Dans **Actions**, ouvrir `Deploy to GitHub Pages` et vérifier la réussite.
3. URL : `https://PSEUDO.github.io/NOM-DU-DEPOT/`. Le nom du dépôt est déduit automatiquement par le workflow. Attendre quelques minutes et recharger si besoin.

## Netlify sans terminal

1. Connecter GitHub à Netlify et choisir **Add new project → Import an existing project → GitHub** (les libellés peuvent évoluer). Choisir le même dépôt. Netlify lit `netlify.toml` : commande `npm run build`, dossier publié `dist`, Node 22. Laisser le répertoire de base vide.
2. Lancer le déploiement et ouvrir l'URL `.netlify.app`. Les commits suivants redéploient automatiquement.
3. Ne pas utiliser Netlify Drop avec l'archive source : Astro doit d'abord être compilé. Sur Netlify le jeu est à la racine ; sur GitHub Pages il est sous le nom du dépôt.

## Développement facultatif

`npm install` puis `npm run dev`; `npm run build` pour produire `dist/`.

## Limites

Sauvegarde `localStorage`, propre à chaque origine : GitHub Pages et Netlify ont deux parties distinctes; pas de synchronisation entre appareils. Les données peuvent être effacées avec celles du navigateur. Le temps hors ligne est calculé au retour, pas par un processus exécuté en arrière-plan. L'horloge de l'appareil n'est pas protégée contre la triche. Mesures affichées dans le jeu, uniquement locales.
