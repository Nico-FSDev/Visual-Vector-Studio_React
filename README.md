# Visual Vector Studio React (Visual-Vector-Studio_React)

Application professionnelle de création graphique vectorielle, conception de cartes de visite, QR codes artistiques, et studio tableau blanc/noir/paperboard pédagogique.

- **Dépôt GitHub** : [https://github.com/Nico-FSDev/Visual-Vector-Studio_React](https://github.com/Nico-FSDev/Visual-Vector-Studio_React)
- **Stack Technique** : React 19, TypeScript, Vite, Tailwind CSS v4, Capacitor 8 (Android), Firebase Auth & Firestore.

## Démarrage Rapide

```bash
# Installation des dépendances
npm install

# Lancement du serveur de développement
npm run dev

# Vérification du typage et du code
npm run lint

# Compilation pour la production
npm run build
```

## Build Android (APK & AAB)

Le pipeline CI/CD GitHub Actions (`.github/workflows/build-apk.yml`) compile automatiquement les assets web et génère les binaires Android (APK de débogage et APK/AAB signés pour la publication).

```bash
# Synchronisation Capacitor
npx cap sync android
```
