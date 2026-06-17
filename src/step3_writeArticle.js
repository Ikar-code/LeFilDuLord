import { GROQ_API_KEY } from './clients.js';
import { log } from './logger.js';

async function callGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3-32b',
      reasoning_effort: 'none', // pas besoin du mode raisonnement pour de la rédaction
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq: statut HTTP ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function generateArticle(topic) {
  const prompt = `
Tu es journaliste pour "Le Fil du Lord", un média d'actualité numérique francophone
destiné principalement aux jeunes générations.

Ta mission est de rédiger un véritable article journalistique complet
uniquement à partir du dossier fourni.

Tu n'effectues aucune recherche.
Toutes les informations nécessaires sont déjà présentes dans le sujet.

Sujet :
Titre proposé : ${topic.titre}

Dossier journalistique :
${topic.description}

Source :
${topic.source}


RÈGLE ABSOLUE :

Tu dois utiliser uniquement les informations fournies.

Ne jamais inventer :
- date
- chiffre
- citation
- réaction
- acteur
- événement
- conséquence
- information technique

Si une information n'est pas présente dans le dossier,
ne pas la compléter avec tes connaissances.

Ne jamais ajouter de source externe.

Ton rôle est uniquement de transformer ce dossier
en article journalistique clair et agréable à lire.


Consignes journalistiques :

- Ton professionnel, neutre, informatif et accessible
- Écrire comme un journaliste d'un média numérique moderne
- Ne jamais donner d'opinion personnelle
- Ne jamais exagérer un événement
- Ne jamais transformer une annonce en révolution sans preuve
- Ne jamais présenter une hypothèse comme un fait confirmé

Le lecteur doit comprendre :

- ce qui s'est passé
- quand cela s'est passé
- qui est concerné
- où cela se passe
- pourquoi cet événement est important
- quel impact cela peut avoir


PUBLIC CIBLE :

Le média s'adresse principalement aux jeunes.

Adapter l'écriture selon le sujet :

Gaming :
- expliquer l'intérêt pour les joueurs
- parler de la communauté, des studios, des sorties ou de l'industrie

Anime / manga / webtoon :
- expliquer l'impact sur les fans
- présenter la licence ou le projet clairement

Technologie / IA :
- expliquer simplement le fonctionnement
- éviter le vocabulaire marketing
- expliquer les limites

Culture internet :
- expliquer pourquoi la communauté en parle
- donner le contexte numérique

Streaming / cinéma / séries :
- expliquer l'impact sur les spectateurs et plateformes


Longueur :

- Entre 1000 et 1200 mots environ
- L'article doit ressembler à un vrai article publié


Structure obligatoire :

1. TITRE

- Accrocheur mais journalistique
- Clair et précis
- Doit annoncer l'événement
- Peut différer du titre proposé
- Aucun sensationnalisme

Interdit :
"révolution totale"
"change tout"
"nouvelle ère"
"sans précédent"
sauf si le dossier le prouve réellement


2. ANGLE ÉDITORIAL

- Une seule phrase
- Explique pourquoi cet événement mérite un article
- Doit correspondre aux informations du dossier


3. CONTENU


Introduction :

Présenter immédiatement l'événement.

Répondre rapidement à :

Qui ?
Quoi ?
Quand ?
Où ?


Développement :

Présenter :

- le contexte
- les acteurs concernés
- les informations importantes
- les détails de l'événement
- les conséquences possibles
- l'impact pour la communauté concernée


Pour les sujets technologie, IA ou innovation :

- expliquer le fonctionnement réel
- rester précis
- éviter les promesses non prouvées
- mentionner les limites présentes dans le dossier


Conclusion :

- Résumer les informations principales
- Donner une ouverture uniquement si elle est logique
- Ne pas inventer de futurs événements


Style rédactionnel :

- Paragraphes courts
- Lecture fluide
- Style humain
- Pas de répétitions
- Pas de phrases vagues
- Pas de remplissage
- Pas de ton publicitaire
- Pas de formulation typique d'une IA

Si le sujet semble être une annonce future, une rumeur ou une information non confirmée,
ne rédige pas l'article comme un fait établi.


Format obligatoire :

Réponds UNIQUEMENT en JSON valide.


INTERDICTIONS ABSOLUES :

- Aucun Markdown
- Aucun symbole **
- Aucun symbole #
- Aucune liste Markdown
- Aucun texte avant ou après le JSON
- Aucun formatage spécial


Les titres de sections dans le contenu doivent être écrits simplement.

Exemple interdit :
**Les conséquences pour les joueurs**

Exemple interdit :
### Les conséquences pour les joueurs

Exemple accepté :
Les conséquences pour les joueurs


Réponds exactement dans ce format :

{
  "titre": "...",
  "angle": "...",
  "contenu": "..."
}
`;
  const text = await callGroq(prompt);
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function writeArticle(topic, scoreArticleFn, findTopicsFn) {
  const MAX_TENTATIVES = 3;
  const SEUIL = 7;

  let tentative = 0;
  let article = null;
  let evaluation = null;
  let currentTopic = topic;

  while (tentative < MAX_TENTATIVES) {
    tentative++;

    try {
      article = await generateArticle(currentTopic);

      await log(
        'writeArticle',
        `Tentative ${tentative} — Article rédigé: "${article.titre}"`,
        'success'
      );

    } catch (e) {

      await log(
        'writeArticle',
        `Tentative ${tentative} — Erreur génération: ${e.message}`,
        'error'
      );

      continue;
    }


    evaluation = await scoreArticleFn(article);


    if (evaluation.score >= SEUIL) {

      await log(
        'writeArticle',
        `Tentative ${tentative} — Score suffisant: ${evaluation.score}/10`,
        'success'
      );

      return {
        article,
        evaluation
      };
    }


    await log(
      'writeArticle',
      `Tentative ${tentative} — Sujet refusé (${evaluation.score}/10), nouveau sujet demandé`,
      'info'
    );


    // CHANGER DE SUJET
    try {

      const newTopics = await findTopicsFn();


      if (newTopics && newTopics.length > 0) {

        currentTopic =
          newTopics[Math.floor(Math.random() * newTopics.length)];


        await log(
          'writeArticle',
          `Nouveau sujet sélectionné : "${currentTopic.titre}"`,
          'info'
        );

      }

    } catch (e) {

      await log(
        'writeArticle',
        `Impossible de récupérer un nouveau sujet : ${e.message}`,
        'error'
      );

    }

  }


  await log(
    'writeArticle',
    `Échec après ${MAX_TENTATIVES} tentatives — meilleur score: ${evaluation?.score}/10`,
    'error'
  );


  return {
    article,
    evaluation,
    rejeté: true
  };
}
