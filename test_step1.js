import { findTopics } from './src/step1_findTopics.js';
import { verifyTopics } from './src/step1b_verifyTopics.js';
import { filterNewTopics, getNextPendingTopic, insertSujets } from './src/step2_checkDuplicates.js';
import { writeArticle } from './src/step3_writeArticle.js';
import { scoreArticle } from './src/step4_scoreArticle.js';
import { publishArticle } from './src/step5_publishArticle.js';

(async () => {
  try {
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
    // getNextPendingTopic est passé en 3e argument : si le score est insuffisant,
    // writeArticle pioche un AUTRE sujet déjà vérifié et en attente en base,
    // plutôt que de rappeler findTopics (ce qui contournerait verifyTopics).
    const { article, evaluation, sujetUtilise, rejeté } = await writeArticle(
      sujet,
      scoreArticle,
      getNextPendingTopic
    );

    console.log('--- ARTICLE GÉNÉRÉ ---');
    console.log('Titre:', article.titre);
    console.log('Sujet réellement utilisé:', sujetUtilise.titre);
    console.log('--- ÉVALUATION ---');
    console.log(JSON.stringify(evaluation, null, 2));

    if (rejeté) {
      console.log("--- ARTICLE REJETÉ après 3 tentatives, les sujets essayés restent 'nouveau' pour être retentés plus tard ---");
    } else {
      const statut = await publishArticle(article, evaluation, sujetUtilise.titre, sujetUtilise.categorie);
      console.log(`--- RÉSULTAT FINAL: statut = ${statut} ---`);
    }
  } catch (e) {
    console.error('Échec:', e.message);
  }
})();
