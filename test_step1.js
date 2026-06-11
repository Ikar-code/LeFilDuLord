import { findTopics } from './src/step1_findTopics.js';
import { filterNewTopics } from './src/step2_checkDuplicates.js';
import { writeArticle } from './src/step3_writeArticle.js';
import { scoreArticle } from './src/step4_scoreArticle.js';
import { publishArticle } from './src/step5_publishArticle.js';

(async () => {
  try {
    const topics = await findTopics();
    console.log(`--- ${topics.length} sujets proposés ---`);

    const newTopics = await filterNewTopics(topics);
    console.log(`--- ${newTopics.length} nouveaux sujets ---`);

    if (newTopics.length > 0) {
      const topic = newTopics[0];

      const { article, evaluation, rejeté } = await writeArticle(topic, scoreArticle);

      console.log('--- ARTICLE GÉNÉRÉ ---');
      console.log('Titre:', article.titre);
      console.log('--- ÉVALUATION ---');
      console.log(JSON.stringify(evaluation, null, 2));

      if (rejeté) {
        console.log('--- ARTICLE REJETÉ après 3 tentatives ---');
      } else {
        const statut = await publishArticle(article, evaluation, topic.titre);
        console.log(`--- RÉSULTAT FINAL: statut = ${statut} ---`);
      }
    } else {
      console.log('Aucun nouveau sujet à traiter.');
    }
  } catch (e) {
    console.error('Échec:', e.message);
  }
})();
