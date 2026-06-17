import { supabase } from './clients.js';
import { log } from './logger.js';

export async function filterNewTopics(topics) {
  const newTopics = [];

  for (const topic of topics) {
    const { data, error } = await supabase
      .from('sujets')
      .select('id')
      .eq('titre', topic.titre)
      .limit(1);

    if (error) {
      await log('checkDuplicates', 'Erreur vérification: ' + error.message, 'error', topic);
      continue;
    }

    if (data.length === 0) {
      newTopics.push(topic);
    } else {
      await log('checkDuplicates', `Sujet déjà existant, ignoré: ${topic.titre}`, 'info');
    }
  }

  // Suppression de la boucle d'insertion ici
  return newTopics;
}
