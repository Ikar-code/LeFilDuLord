import { findTopics } from './src/step1_findTopics.js';
import { filterNewTopics } from './src/step2_checkDuplicates.js';

(async () => {
  try {
    const topics = await findTopics();
    console.log('--- SUJETS PROPOSÉS ---');
    console.log(JSON.stringify(topics, null, 2));

    const newTopics = await filterNewTopics(topics);
    console.log('--- NOUVEAUX SUJETS (insérés dans Supabase) ---');
    console.log(JSON.stringify(newTopics, null, 2));
  } catch (e) {
    console.error('Échec:', e.message);
  }
})();
