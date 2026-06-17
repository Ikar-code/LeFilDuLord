import { genAI } from './clients.js';
import { log } from './logger.js';

async function generateArticle(topic) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const prompt = `
Tu es journaliste pour "Le Fil du Lord", un média d'actualité numérique francophone.

Ta mission est de rédiger un véritable article journalistique complet à partir du sujet fourni.

Sujet :
Titre proposé : ${topic.titre}

Description :
${topic.description}

Source :
${topic.source}

Consignes journalistiques obligatoires :

- Ton professionnel, neutre, informatif et accessible
- Écrire comme un journaliste d'un média numérique moderne
- Ne jamais donner d'opinion personnelle
- Ne jamais inventer d'informations, chiffres, citations, réactions ou acteurs
- Utiliser uniquement les informations disponibles dans le sujet et la source
- Ne jamais présenter une hypothèse comme un fait confirmé
- Ne jamais ajouter de source externe non fournie

Fidélité au sujet :

- Respecter exactement la nature de l'événement présenté
- Ne jamais exagérer l'importance d'une annonce
- Ne jamais transformer une technologie spécialisée en technologie générale
- Ne jamais transformer un outil, une expérience ou un prototype en produit révolutionnaire sans preuve
- Toujours expliquer clairement :
  - ce que c'est réellement
  - à quoi cela sert
  - quelles sont ses limites
  - qui est concerné

Objectif :
L'article doit informer un lecteur qui découvre le sujet.

Le lecteur doit comprendre rapidement :
- ce qui s'est passé
- quand cela s'est passé
- qui est concerné
- pourquoi cet événement est important
- quelles sont les conséquences possibles

Longueur :
- Entre 1000 et 1200 mots environ
- L'article doit ressembler à un véritable article de presse

Structure obligatoire :

1. TITRE

- Doit être accrocheur mais journalistique
- Doit annoncer clairement l'événement
- Peut être différent du titre proposé
- Ne pas utiliser de sensationnalisme
- Éviter les formulations exagérées comme :
  "révolutionne totalement"
  "change tout"
  "nouvelle ère"
  sauf si elles sont prouvées et nécessaires

2. ANGLE ÉDITORIAL

- Une seule phrase expliquant l'approche choisie pour traiter le sujet
- Doit expliquer pourquoi cet événement mérite un article

3. CONTENU

Introduction :
- Présenter immédiatement le fait principal
- Donner les informations essentielles dès le début
- Répondre aux questions :
  Qui ?
  Quoi ?
  Quand ?
  Où ?

Développement :
- Ajouter le contexte nécessaire
- Présenter les acteurs concernés
- Expliquer les faits importants
- Détailler les conséquences possibles
- Donner les éléments nécessaires pour comprendre l'enjeu

Pour les sujets technologie, IA ou innovation :
- Expliquer le fonctionnement réel
- Éviter le vocabulaire marketing
- Mentionner les limites ou incertitudes si nécessaire

Conclusion :
- Résumer ce qu'il faut retenir
- Donner une ouverture sur les prochaines évolutions possibles

Style rédactionnel :

- Paragraphes courts et lisibles
- Style naturel comme un journaliste humain
- Pas de répétitions
- Pas de phrases génériques d'intelligence artificielle
- Pas de remplissage inutile
- Pas de formulation promotionnelle
- Pas de conclusion exagérée

Adapter le ton au sujet :
(gaming, technologie, politique, culture, sport, science, économie...)

Format obligatoire :

Réponds UNIQUEMENT en JSON valide.

INTERDICTIONS ABSOLUES :

- Aucun Markdown
- Aucun symbole **
- Aucun symbole #
- Aucune liste Markdown
- Aucun texte avant ou après le JSON
- Aucun formatage spécial
- Aucun titre de section avec des symboles

Les titres de sections dans le contenu doivent être écrits simplement.

Exemple interdit :
**Les conséquences pour les entreprises**

Exemple accepté :
Les conséquences pour les entreprises

Réponds exactement dans ce format :

{
  "titre": "...",
  "angle": "...",
  "contenu": "..."
}
`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function writeArticle(topic, scoreArticleFn) {
  const MAX_TENTATIVES = 3;
  const SEUIL = 7;
  let tentative = 0;
  let article = null;
  let evaluation = null;

  while (tentative < MAX_TENTATIVES) {
    tentative++;
    try {
      article = await generateArticle(topic);
      await log('writeArticle', `Tentative ${tentative} — Article rédigé: "${article.titre}"`, 'success');
    } catch (e) {
      await log('writeArticle', `Tentative ${tentative} — Erreur parsing JSON: ${e.message}`, 'error');
      continue;
    }

    evaluation = await scoreArticleFn(article);

    if (evaluation.score >= SEUIL) {
      await log('writeArticle', `Tentative ${tentative} — Score suffisant: ${evaluation.score}/10`, 'success');
      return { article, evaluation };
    }

    await log('writeArticle', `Tentative ${tentative} — Score insuffisant: ${evaluation.score}/10, on réessaie`, 'info');
  }

  await log('writeArticle', `Échec après ${MAX_TENTATIVES} tentatives — meilleur score: ${evaluation?.score}/10`, 'error');
  return { article, evaluation, rejeté: true };
}
