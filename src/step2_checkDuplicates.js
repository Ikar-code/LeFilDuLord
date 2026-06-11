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

  // Insère les nouveaux sujets dans la table 'sujets' avec statut 'nouveau'
  for (const topic of newTopics) {
    const { error } = await supabase.from('sujets').insert({
      titre: topic.titre,
      description: topic.description,
      source: topic.source,
      statut: 'nouveau'
    });
    if (error) {
      await log('checkDuplicates', 'Erreur insertion sujet: ' + error.message, 'error', topic);
    }
  }

  await log('checkDuplicates', `${newTopics.length} nouveaux sujets ajoutés sur ${topics.length} proposés`, 'success');
  return newTopics;
}
