import { supabase } from './clients.js';
import { log } from './logger.js';

// Filtre uniquement : retourne les sujets qui n'existent pas déjà dans 'sujets'.
// Ne fait plus aucune insertion en base.
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

  await log('checkDuplicates', `${newTopics.length} nouveaux sujets sur ${topics.length} proposés`, 'success');
  return newTopics;
}

// Insère UN SEUL sujet (celui réellement choisi et traité) dans la table 'sujets'.
// Retourne le sujet inséré (avec son id généré) pour pouvoir le lier à l'article ensuite.
//
// Exemple d'utilisation dans l'orchestrateur principal :
//
//   const topics = await findTopics();
//   const newTopics = await filterNewTopics(topics);
//   const sujetChoisi = newTopics[0]; // ou autre critère de choix
//   const sujetInsere = await insertSujet(sujetChoisi);
//   const { article, evaluation } = await writeArticle(sujetChoisi, scoreArticle);
//   await publishArticle(article, evaluation, sujetInsere.titre, sujetInsere.categorie);
//
export async function insertSujet(topic) {
  const { data, error } = await supabase
    .from('sujets')
    .insert({
      titre: topic.titre,
      description: topic.description,
      source: topic.source,
      categorie: topic.categorie,
      statut: 'nouveau'
    })
    .select()
    .single();

  if (error) {
    await log('checkDuplicates', 'Erreur insertion sujet: ' + error.message, 'error', topic);
    throw error;
  }

  await log('checkDuplicates', `Sujet choisi enregistré: ${topic.titre}`, 'success', data);
  return data;
}
