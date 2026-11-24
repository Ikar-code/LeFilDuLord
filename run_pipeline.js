/**
 * Copyright (c) 2026 Lucas Rajany
 * Licensed under the MIT License.
 * See LICENSE file for details.
 */

// Orchestrateur de la pipeline Le Fil du Lord :
// scraping (Python, lancé avant) -> findTopics -> doublons -> vérification -> rédaction -> score -> publication.
// Code de sortie 1 si la pipeline plante, pour que le job GitHub Actions soit en échec.

import { findTopics } from './src/step1_findTopics.js';
import { verifyTopics } from './src/step1b_verifyTopics.js';
import {
  filterNewTopics,
  getNextPendingTopic,
  insertSujets,
  enregistrerEchecSujet
} from './src/step2_checkDuplicates.js';
import { writeArticle } from './src/step3_writeArticle.js';
import { scoreArticle } from './src/step4_scoreArticle.js';
import { publishArticle } from './src/step5_publishArticle.js';
import { log, RUN_ID } from './src/logger.js';

async function main() {
  console.log(`=== Pipeline Le Fil du Lord — run ${RUN_ID} ===`);

  // 1. On regarde d'abord s'il reste un sujet déjà validé et en attente en base.
  // Si oui, on l'utilise directement et on évite tout nouvel appel à Gemini pour la recherche.
  let sujet = await getNextPendingTopic();

  if (sujet) {
    console.log(`--- Sujet en attente trouvé en base, pas de nouvel appel findTopics ---`);
    console.log('Titre:', sujet.titre);
  } else {
    console.log('--- Aucun sujet en attente, on lance une nouvelle recherche ---');

    const topics = await findTopics();
    console.log(`--- ${topics.length} sujets proposés ---`);

    const newTopics = await filterNewTopics(topics);
    console.log(`--- ${newTopics.length} nouveaux sujets (non doublons) ---`);

    if (newTopics.length === 0) {
      console.log('Aucun nouveau sujet à traiter (tous étaient des doublons).');
      return;
    }

    // Pause pour éviter de dépasser le RPM entre findTopics et les appels verifyTopics
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const verifiedTopics = await verifyTopics(newTopics);
    console.log(`--- ${verifiedTopics.length} sujets confirmés réels sur ${newTopics.length} ---`);

    if (verifiedTopics.length === 0) {
      console.log('Aucun sujet confirmé réel par la vérification, rien à enregistrer.');
      return;
    }

    const sujetsInseres = await insertSujets(verifiedTopics);
    sujet = sujetsInseres[0];
  }

  // 2. Rédaction de l'article à partir du sujet choisi.
  const { article, evaluation, sujetUtilise, sujetsEssayes, rejeté } = await writeArticle(
    sujet,
    scoreArticle,
    getNextPendingTopic
  );

  // Aucun article exploitable (échecs de génération ou de scoring sur tous les essais) :
  // on enregistre l'échec de chaque sujet essayé et on fait échouer le job.
  if (!article || !evaluation) {
    console.error('--- AUCUN ARTICLE GÉNÉRÉ après toutes les tentatives ---');
    for (const s of sujetsEssayes) {
      await enregistrerEchecSujet(s.id);
    }
    await log('pipeline', 'Aucun article exploitable généré', 'error', { sujets: sujetsEssayes.map((s) => s.titre) });
    process.exitCode = 1;
    return;
  }

  console.log('--- ARTICLE GÉNÉRÉ ---');
  console.log('Titre:', article.titre);
  console.log('Sujet réellement utilisé:', sujetUtilise.titre);
  console.log('--- ÉVALUATION ---');
  console.log(JSON.stringify(evaluation, null, 2));

  if (rejeté) {
    console.log('--- ARTICLE REJETÉ après toutes les tentatives ---');

    // On garde une trace du meilleur article refusé (statut 'rejected') pour analyser les refus.
    await publishArticle(article, evaluation, sujetUtilise, { rejete: true });

    // Tous les sujets essayés dans ce run ont échoué : on enregistre l'échec de chacun.
    // Au 2e échec total, un sujet est automatiquement supprimé (voir enregistrerEchecSujet).
    for (const s of sujetsEssayes) {
      await enregistrerEchecSujet(s.id);
    }
  } else {
    // Le sujet utilisé a réussi : on enregistre l'échec uniquement des AUTRES sujets essayés
    // avant de trouver le bon (s'il y en a eu).
    for (const s of sujetsEssayes) {
      if (s.id !== sujetUtilise.id) {
        await enregistrerEchecSujet(s.id);
      }
    }

    const statut = await publishArticle(article, evaluation, sujetUtilise);
    console.log(`--- RÉSULTAT FINAL: statut = ${statut} ---`);
  }
}

main().catch(async (e) => {
  console.error('Échec:', e.message);
  try {
    await log('pipeline', `Échec de la pipeline: ${e.message}`, 'error', { stack: e.stack?.split('\n').slice(0, 5) });
  } catch {
    // le log lui-même a échoué : rien de plus à faire
  }
  process.exitCode = 1;
});
