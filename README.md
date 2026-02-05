# 📸 Passport Pro

**Passport Pro** est une application web moderne conçue pour simplifier la création de photos d'identité conformes aux normes officielles (ISO/IEC 19794-5). Elle utilise l'Intelligence Artificielle pour analyser la conformité des photos et automatiser le traitement (détourage, recadrage).

![Passport Pro Banner](https://via.placeholder.com/800x200?text=Passport+Pro+Preview)

## ✨ Fonctionnalités Clés

- **🎯 Conformité IA** : Analyse automatique de la photo via Google Gemini 1.5 Flash (yeux ouverts, bouche fermée, éclairage, etc.).
- **✂️ Détourage Intelligent** : Suppression de l'arrière-plan en local (Client-side) sans envoi de données vers un serveur tiers pour la modification d'image.
- **📐 Mise en Page Automatique** : Génération de planches d'impression (A4, 10x15, Custom) avec repères de coupe.
- **🚀 Performance** : Architecture Reactive rapide, construite avec Vite et TypeScript.
- **🔒 Confidentialité** : Le traitement d'image lourd se fait dans le navigateur (WASM).

## 🛠️ Stack Technique

- **Frontend** : React 18, TypeScript
- **Build Tool** : Vite
- **Styling** : Tailwind CSS
- **IA (Analyse)** : Google Gemini API (`gemini-1.5-flash`)
- **IA (Traitement)** : `@imgly/background-removal` (WASM)

## 🚀 Installation & Démarrage

Suivez ces étapes pour installer le projet localement.

### Prérequis
- **Node.js** (v18 ou supérieur recommandé)
- **NPM** (installé avec Node.js)

### 1. Cloner le projet
```bash
git clone https://github.com/votre-username/passport-pro.git
cd passport-pro
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de l'environnement
Créez un fichier `.env.local` à la racine du projet et ajoutez votre clé API Google Gemini :

```env
VITE_GEMINI_API_KEY=votre_cle_api_ici
```
> **Note** : Vous pouvez obtenir une clé API gratuitement sur [Google AI Studio](https://aistudio.google.com/).

### 4. Lancer le serveur de développement
```bash
npm run dev
```
L'application sera accessible sur `http://localhost:5173`.

## 📂 Structure du Projet

```
passport-pro/
├── public/              # Assets statiques (favicon, etc.)
├── src/
│   ├── services/        # Logique métier et appels API
│   │   ├── geminiService.ts    # Service d'analyse IA
│   │   └── imageProcessing.ts  # Détourage et traitement d'image
│   ├── App.tsx          # Composant principal
│   ├── types.ts         # Définitions TypeScript
│   └── constants.ts     # Configuration (formats papier, normes)
├── index.html           # Point d'entrée HTML
├── tailwind.config.js   # Configuration Tailwind
└── tsconfig.json        # Configuration TypeScript
```

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une Pull Request pour suggérer des améliorations.

## 📄 Licence

Ce projet est sous licence MIT.
