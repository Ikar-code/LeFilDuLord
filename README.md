# 📰 Le Fil du Lord

Système complet de média d'actualité francophone automatisé par intelligence artificielle.

Le projet transforme automatiquement des informations brutes en articles publiables grâce à un pipeline composé de collecte de données, vérification, rédaction IA, contrôle qualité et publication.

---

## ⚠️ Présentation

Le Fil du Lord est un média automatisé conçu pour expérimenter l'utilisation d'agents IA dans la chaîne éditoriale.

Le système fonctionne sans intervention humaine après configuration et orchestre plusieurs étapes :

- récupération d'informations
- sélection de sujets
- vérification des données
- génération d'articles
- évaluation qualité
- publication automatique

---

# 🚀 Fonctionnalités

## 🔎 Agent recherche — Scraping + flux RSS

Le système récupère automatiquement des informations depuis différentes sources :

- scraping web
- flux RSS spécialisés
- sources d'actualité

Les données brutes sont analysées afin d'identifier des sujets pertinents.

---

## ✅ Agent vérification — Gemini 2.5 Flash Lite

Chaque sujet est contrôlé avant rédaction.

L'agent analyse :

- cohérence des informations
- dates
- personnes ou organisations concernées
- disponibilité des sources
- risques d'informations incorrectes

Objectif : limiter les erreurs avant génération.

---

## ✍️ Agent rédaction — Qwen3-32B (Groq)

Les informations validées sont transformées en article journalistique.

L'agent génère :

- titre
- angle éditorial
- structure de l'article
- contenu complet

Le résultat respecte la ligne éditoriale du média.

---

## ⭐ Agent qualité — Gemini 3.1 Flash Lite

Avant publication, chaque article est évalué.

L'agent analyse :

- qualité rédactionnelle
- structure
- cohérence
- fiabilité
- respect des règles éditoriales

Un score est attribué avant validation.

---

# 🔁 Pipeline automatique

```
Sources web / RSS

        ↓

Collecte des informations

        ↓

Détection des sujets

        ↓

Vérification IA

        ↓

Anti-doublons Supabase

        ↓

Rédaction IA

        ↓

Score qualité

        ↓

Publication automatique
```

---

# 🛠️ Stack technique

## Frontend

- React
- TypeScript
- Vite

## Backend

- Node.js
- API IA
- automatisation du pipeline

## Intelligence artificielle

- Gemini API
- Groq API
- Qwen3-32B

## Base de données

- Supabase
- PostgreSQL

Utilisation :

- stockage articles
- sujets
- scores
- journaux système

## Automatisation

- GitHub Actions
- Cron

## Déploiement

- Vercel

---

# 🗄️ Base de données

Tables principales :

## articles

Stockage des articles :

- titre
- contenu
- catégorie
- score
- statut
- dates

## sujets

Gestion des sujets détectés :

- sujet
- source
- validation
- doublons

## journaux

Traçabilité complète :

- étapes du pipeline
- erreurs
- résultats IA

---

# 🔐 Sécurité

Le projet utilise :

- variables d'environnement
- séparation des clés API
- authentification dashboard admin
- gestion des accès Supabase

Les clés privées ne sont jamais stockées dans le code source.

---

# 📊 Objectifs du projet

- Automatiser une chaîne éditoriale complète
- Tester les capacités des agents IA
- Construire une architecture scalable
- Créer un média autonome basé sur l'intelligence artificielle

---

# 📌 Améliorations possibles

- nouveaux agents spécialisés
- nouvelles sources d'information
- analyse de tendances
- personnalisation éditoriale
- statistiques avancées
- amélioration du scoring qualité

---

# 👤 Auteur

Lucas Rajany

Projet personnel autour de l'intelligence artificielle, automatisation et développement web.

---

# 🌐 Site

https://lefildulord.vercel.app/

---

# 📜 Licence

Apache License
