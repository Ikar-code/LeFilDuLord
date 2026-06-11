import { findTopics } from './src/step1_findTopics.js';
import { filterNewTopics } from './src/step2_checkDuplicates.js';
import { writeArticle } from './src/step3_writeArticle.js';

(async () => {
  try {
    const topics = await findTopics();
    console.log('--- SUJETS PROPOSÉS ---');
    console.log(JSON.stringify(topics, null, 2));

    const newTopics = await filterNewTopics(topics);
    console.log('--- NOUVEAUX SUJETS (insérés dans Supabase) ---');
    console.log(JSON.stringify(newTopics, null, 2));

    if (newTopics.length > 0) {
      const article = await writeArticle(newTopics[0]);
      console.log('--- ARTICLE GÉNÉRÉ ---');
      console.log(JSON.stringify(article, null, 2));
    } else {
      console.log('Aucun nouveau sujet à traiter pour cette étape.');
    }
  } catch (e) {
    console.error('Échec:', e.message);
  }
})();
