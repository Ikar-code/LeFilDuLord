import { GROQ_API_KEY } from './clients.js';
import { log } from './logger.js';


const MODELES_GROQ_FALLBACK = ['qwen/qwen3-32b', 'llama-3.3-70b-versatile'];

async function callGroq(prompt, maxTentativesParModele = 3) {
  let derniereErreur;

  for (const modele of MODELES_GROQ_FALLBACK) {
    for (let tentative = 1; tentative <= maxTentativesParModele; tentative++) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: modele,
          reasoning_effort: 'none',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }

      const errorText = await response.text();
      derniereErreur = new Error(`Groq (${modele}): statut HTTP ${response.status} — ${errorText}`);

      if (response.status === 429) {
        const estLimiteJournaliere = /requests per day|RPD|daily/i.test(errorText);

        // Limite journalière (RPD) : ce modèle est mort pour aujourd'hui, on passe direct au suivant
        if (estLimiteJournaliere) {
          await log('writeArticle', `Limite journalière atteinte sur ${modele}, passage au modèle de secours`, 'warning');
          break;
        }

        // Limite par minute (TPM) : on retente après le délai suggéré, sur le même modèle
        if (tentative < maxTentativesParModele) {
          const match = errorText.match(/try again in ([\d.]+)s/);
          const delaiMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 3000;
          await log('writeArticle', `Rate limit TPM sur ${modele}, retry dans ${Math.round(delaiMs / 1000)}s`, 'info');
          await new Promise((resolve) => setTimeout(resolve, delaiMs));
          continue;
        }

        // Plus de tentatives sur ce modèle pour du TPM répété : on passe au modèle de secours
        await log('writeArticle', `${modele} abandonné après ${maxTentativesParModele} essais (TPM), passage au modèle de secours`, 'warning');
        break;
      }

      // Erreur non-429 : pas la peine de retenter sur ce modèle, on passe au suivant
      break;
    }
  }

  throw derniereErreur || new Error('Groq: tous les modèles de secours ont échoué');
}



async function generateArticle(topic) {

  const faits = topic.faitsVerifies && topic.faitsVerifies.length > 0
    ? topic.faitsVerifies.map(f => "- " + f).join("\n")
    : "Aucun fait supplémentaire";


  const prompt = `

Tu es journaliste pour "Le Fil du Lord",
un média d'actualité numérique francophone destiné principalement aux jeunes générations.


Ta mission est de rédiger un véritable article journalistique
uniquement à partir du dossier vérifié fourni.


Tu ne fais aucune recherche.

Tu n'ajoutes aucune information extérieure.

Le dossier de faits vérifiés est la source de vérité.


Sujet :

Titre :
${topic.titre}


Dossier journalistique :

${topic.description}


Vérification factuelle :

${topic.verification || "Aucune"}


Faits vérifiés :

${faits}



RÈGLES ABSOLUES :

Utilise uniquement :

1. Les faits vérifiés
2. La vérification factuelle
3. Le dossier journalistique


Si une contradiction existe :

Les faits vérifiés remplacent toujours le reste.


Ne jamais inventer :

- date
- chiffre
- citation
- personne
- entreprise
- conséquence
- détail technique
- événement futur


Ne jamais ajouter une information provenant de tes connaissances.


Ton rôle est uniquement de transformer ce dossier
en article journalistique.



STYLE :

- professionnel
- neutre
- informatif
- accessible
- pas de sensationnalisme
- pas de marketing
- pas d'opinion



Le lecteur doit comprendre :

- ce qui s'est passé
- quand
- qui est concerné
- pourquoi c'est important
- quel impact cela peut avoir



ADAPTATION :

Gaming :
- expliquer l'intérêt pour les joueurs
- parler de la communauté et de l'industrie


Anime / manga / webtoon :
- expliquer l'impact pour les fans
- présenter clairement le projet


Technologie :
- expliquer simplement
- éviter les promesses non prouvées


Streaming / cinéma :
- expliquer l'impact pour les spectateurs



LONGUEUR :

L'article doit faire entre 1000 et 1200 mots. C'est une exigence stricte, pas une suggestion.

Répartition indicative :
- Introduction : 150 à 200 mots
- Développement : 650 à 800 mots (plusieurs paragraphes développés, pas un seul bloc)
- Conclusion : 150 à 200 mots

IMPORTANT : "ne jamais inventer" ne veut pas dire "rester minimaliste". Tu dois développer
en profondeur CHAQUE information déjà présente dans le dossier journalistique, la
vérification factuelle et les faits vérifiés : explique le contexte, détaille les
acteurs, développe les implications et les conséquences déjà mentionnées. Toute
information du dossier mérite d'être expliquée et mise en contexte, pas seulement
listée en une phrase.

Tu peux aussi ajouter du contexte général de connaissance publique largement établie
(ex: présenter brièvement ce qu'est un studio, une plateforme, un genre de jeu, le rôle
d'une institution) pour aider le lecteur à comprendre — à condition que ce contexte soit
clairement général et non spécifique à l'événement. Ne présente JAMAIS ce contexte général
comme un fait propre à l'événement traité, et ne lui attribue jamais de chiffres, dates,
citations ou conséquences précises qui ne viennent pas du dossier. En cas de doute sur si
une information est un fait spécifique ou une connaissance générale, traite-la comme un
fait spécifique et ne l'inclus pas.

Un article de moins de 800 mots n'est pas acceptable, même si toutes les informations
qu'il contient sont exactes.



STRUCTURE :

1. TITRE

Un titre clair et journalistique.


2. ANGLE

Une phrase expliquant pourquoi le sujet mérite un article.


3. CONTENU


Introduction :

Présenter immédiatement :

Qui ?
Quoi ?
Quand ?


Développement :

Présenter :

- contexte
- acteurs
- informations importantes
- détails vérifiés
- impact possible


Conclusion :

Résumer sans inventer.



FORMAT OBLIGATOIRE :

Réponds uniquement en JSON valide.

Aucun Markdown.

Format :

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




export async function writeArticle(
  topic,
  scoreArticleFn,
  getNextPendingTopicFn = null
) {


  const MAX_TENTATIVES = 3;
  const SEUIL = 7;


  let tentative = 0;

  let article = null;

  let evaluation = null;


  let currentTopic = topic;

  let sujetArticleActuel = topic;


  const sujetsEssayes = [topic];


  const sujetsExclus = new Set([
    topic.titre
  ]);




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


    } catch(e) {


      await log(
        'writeArticle',
        `Tentative ${tentative} — Erreur génération: ${e.message}`,
        'error'
      );


      continue;

    }





    // IMPORTANT : on donne le topic au scoreur
    evaluation = await scoreArticleFn(
      article,
      sujetArticleActuel
    );





    if (evaluation.score >= SEUIL) {


      await log(
        'writeArticle',
        `Tentative ${tentative} — Score suffisant: ${evaluation.score}/10`,
        'success'
      );


      return {
        article,
        evaluation,
        sujetUtilise: sujetArticleActuel,
        sujetsEssayes
      };


    }






    await log(
      'writeArticle',
      `Tentative ${tentative} — Sujet refusé (${evaluation.score}/10), nouveau sujet demandé`,
      'info'
    );







    if (
      getNextPendingTopicFn &&
      tentative < MAX_TENTATIVES
    ) {


      try {


        const nextTopic = await getNextPendingTopicFn(
          sujetsExclus
        );



        if (nextTopic) {


          currentTopic = nextTopic;


          sujetsExclus.add(
            nextTopic.titre
          );


          sujetsEssayes.push(
            nextTopic
          );



          await log(
            'writeArticle',
            `Nouveau sujet (déjà vérifié) sélectionné : "${currentTopic.titre}"`,
            'info'
          );



        } else {



          await log(
            'writeArticle',
            'Aucun autre sujet en attente disponible en base, on retente sur le même sujet',
            'info'
          );


        }



      } catch(e) {



        await log(
          'writeArticle',
          `Impossible de récupérer un nouveau sujet : ${e.message}`,
          'error'
        );


      }

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
    sujetUtilise: sujetArticleActuel,
    sujetsEssayes,
    rejeté: true
  };

}
