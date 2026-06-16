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
- Ne pas donner d'opinion personnelle
- Ne pas inventer d'informations
- Utiliser uniquement les éléments disponibles dans le sujet et la source
- Écrire comme un article publié sur un média en ligne

Longueur :
- Entre 800 et 1200 mots environ
- L'article doit être suffisamment développé pour informer complètement le lecteur

Structure obligatoire :

1. TITRE
- Doit être accrocheur mais rester journalistique
- Doit annoncer clairement l'événement
- Peut différer du titre proposé

2. ANGLE ÉDITORIAL
- Une phrase expliquant l'approche choisie pour traiter le sujet

3. CONTENU
L'article doit contenir :

Introduction :
- Présenter immédiatement le fait d'actualité
- Répondre rapidement à :
  Qui ?
  Quoi ?
  Quand ?
  Où ?

Développement :
- Expliquer le contexte
- Présenter les acteurs concernés
- Ajouter les informations importantes
- Détailler les conséquences possibles
- Donner les éléments nécessaires pour comprendre l'événement

Conclusion :
- Résumer l'importance de l'événement
- Donner une ouverture sur la suite possible

Style :
- Paragraphes courts et lisibles
- Pas de liste sauf si nécessaire
- Pas de formulation vague
- Éviter les phrases artificielles d'IA
- Écrire comme un journaliste humain

Réponds UNIQUEMENT en JSON valide, sans markdown :

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
