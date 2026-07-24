# Contributing to Mini-SOC

Merci de votre intérêt pour contribuer à Mini-SOC ! 🎉

## 🚀 Comment contribuer

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/mini-soc.git
cd mini-soc
git remote add upstream https://github.com/original/mini-soc.git
```

### 2. Créer une branche

```bash
git checkout -b feature/ma-fonctionnalite
# ou
git checkout -b fix/mon-correctif
```

### 3. Convention de commits

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajouter détection DNS tunneling
fix: corriger le calcul du score de risque
docs: mettre à jour le guide d'installation
refactor: restructurer le module alerts
test: ajouter tests unitaires auth service
chore: mettre à jour les dépendances
security: corriger une injection SQL dans le module IOC
```

### 4. Code Quality

Avant de soumettre :

```bash
# Linter
npm run lint

# Tests
npm run test

# Format
npm run format
```

### 5. Pull Request

- Titre clair et descriptif
- Description détaillée des changements
- Référence aux issues liées
- Screenshots si changement UI

## 📏 Standards de code

- **TypeScript strict** (`strict: true`)
- **ESLint + Prettier** configurés
- **Tests** : couverture minimum 70%
- **Documentation** : JSDoc sur les fonctions publiques
- **Sécurité** : pas de secrets dans le code, validation des inputs

## 🏗️ Architecture

- **SOLID** principles
- **Clean Architecture** / Hexagonal
- **Domain Driven Design** pour le backend
- **CQRS** pour les modules complexes
- **Twelve-Factor App** pour les services

## 🔒 Sécurité

- Ne jamais commit de secrets, tokens, ou clés
- Utiliser `.env.example` avec des placeholders
- Valider tous les inputs utilisateur
- Utiliser des requêtes paramétrées (Prisma)
- Suivre OWASP Top 10

## 📋 Issue Templates

Utilisez les templates GitHub pour :
- Bug Report
- Feature Request
- Security Vulnerability (privé)

## ⚖️ Licence

En contribuant, vous acceptez que vos contributions soient sous licence MIT.
