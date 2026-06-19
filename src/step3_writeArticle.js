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
Toutes les informations nécessaires sont présentes dans le sujet
et dans le dossier de faits vérifiés.

Le dossier de faits vérifiés est prioritaire en cas de contradiction.

Sujet :
Titre proposé : ${topic.titre}

Dossier journalistique (résumé structuré) :
${topic.description}

${topic.extrait_brut ? `Extrait brut original (source non résumée — utilise-le pour ne manquer aucun détail que le résumé ci-dessus aurait omis) :
${topic.extrait_brut}` : ''}

Source :
${topic.source}

Dossier de faits vérifiés par le vérificateur :

${topic.faitsVerifies && topic.faitsVerifies.length > 0
  ? topic.faitsVerifies.map(f => "- " + f).join("\n")
  : "Aucun fait supplémentaire vérifié."}


RÈGLE ABSOLUE :

Tu dois utiliser uniquement les informations fournies :

1. Dossier de faits vérifiés (prioritaire)
2. Dossier journalistique
3. Extrait brut original

Si l'extrait brut contient un détail absent du dossier journalistique,
tu peux l'utiliser uniquement s'il ne contredit pas les faits vérifiés.

Si une information du dossier journalistique contredit le dossier de faits vérifiés,
utilise uniquement la version vérifiée.

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

// writeArticle reçoit :
// - topic : le sujet de départ (déjà vérifié par verifyTopics, inséré en base par insertSujets)
// - scoreArticleFn : fonction de scoring (Gemini)
// - getNextPendingTopicFn : fonction optionnelle qui retourne le prochain sujet EN ATTENTE en base
//   (déjà vérifié, pas un sujet brut), utilisée pour changer de sujet si le score est insuffisant.
//   Si elle n'est pas fournie, ou si elle ne retourne rien, on retente simplement sur le même sujet.
export async function writeArticle(topic, scoreArticleFn, getNextPendingTopicFn = null) {
  const MAX_TENTATIVES = 3;
  const SEUIL = 7;

  let tentative = 0;
  let article = null;
  let evaluation = null;
  let currentTopic = topic;
  let sujetArticleActuel = topic; // le sujet qui correspond réellement à `article`/`evaluation`
  const sujetsEssayes = [topic];

  // Sujets déjà essayés (par titre) pour ne jamais repiocher le même sujet rejeté.
  const sujetsExclus = new Set([topic.titre]);

  while (tentative < MAX_TENTATIVES) {
    tentative++;

    try {
      article = await generateArticle(currentTopic);
      sujetArticleActuel = currentTopic;

      await log(
        'writeArticle',
        `Tentative ${tentative} — Article rédigé sur "${currentTopic.titre}": "${article.titre}"`,
        'success'
      );
    } catch (e) {
      await log('writeArticle', `Tentative ${tentative} — Erreur génération: ${e.message}`, 'error');
      continue;
    }

    evaluation = await scoreArticleFn(article);

    if (evaluation.score >= SEUIL) {
      await log('writeArticle', `Tentative ${tentative} — Score suffisant: ${evaluation.score}/10`, 'success');
      return { article, evaluation, sujetUtilise: sujetArticleActuel, sujetsEssayes };
    }

    await log(
      'writeArticle',
      `Tentative ${tentative} — Sujet refusé (${evaluation.score}/10), nouveau sujet demandé`,
      'info'
    );

    // CHANGER DE SUJET, uniquement parmi des sujets déjà vérifiés en base (statut 'nouveau').
    // On ne rappelle JAMAIS findTopics() ici : ça contournerait verifyTopics et consommerait
    // du quota Gemini supplémentaire pour rien.
    if (getNextPendingTopicFn && tentative < MAX_TENTATIVES) {
      try {
        const nextTopic = await getNextPendingTopicFn(sujetsExclus);

        if (nextTopic) {
          currentTopic = nextTopic;
          sujetsExclus.add(nextTopic.titre);
          sujetsEssayes.push(nextTopic);
          await log('writeArticle', `Nouveau sujet (déjà vérifié) sélectionné : "${currentTopic.titre}"`, 'info');
        } else {
          await log(
            'writeArticle',
            'Aucun autre sujet en attente disponible en base, on retente sur le même sujet',
            'info'
          );
        }
      } catch (e) {
        await log('writeArticle', `Impossible de récupérer un nouveau sujet : ${e.message}`, 'error');
      }
    }
  }

  await log('writeArticle', `Échec après ${MAX_TENTATIVES} tentatives — meilleur score: ${evaluation?.score}/10`, 'error');

  return { article, evaluation, sujetUtilise: sujetArticleActuel, sujetsEssayes, rejeté: true };
}
