import { supabase } from './clients.js';
import { log } from './logger.js';

// Filtre uniquement : retourne les sujets qui n'existent pas déjà dans 'sujets'.
// Ne fait aucune insertion en base.
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

// Vérifie s'il existe déjà un sujet en attente (statut 'nouveau') en base.
// Si oui, le retourne (le plus ancien d'abord, pour ne pas laisser de sujet de côté indéfiniment).
// Si non, retourne null.
export async function getNextPendingTopic() {
  const { data, error } = await supabase
    .from('sujets')
    .select('*')
    .eq('statut', 'nouveau')
    .order('date_creation', { ascending: true })
    .limit(1);

  if (error) {
    await log('checkDuplicates', 'Erreur récupération sujet en attente: ' + error.message, 'error');
    throw error;
  }

  if (data && data.length > 0) {
    await log('checkDuplicates', `Sujet en attente trouvé: ${data[0].titre}`, 'success', data[0]);
    return data[0];
  }

  return null;
}

// Insère plusieurs sujets validés en une fois dans la table 'sujets' (statut 'nouveau').
// Retourne les lignes insérées (avec leur id généré).
export async function insertSujets(topics) {
  if (!topics || topics.length === 0) {
    return [];
  }

  const rows = topics.map((topic) => ({
    titre: topic.titre,
    description: topic.description,
    source: topic.source,
    categorie: topic.categorie,
    statut: 'nouveau'
  }));

  const { data, error } = await supabase
    .from('sujets')
    .insert(rows)
    .select();

  if (error) {
    await log('checkDuplicates', 'Erreur insertion sujets: ' + error.message, 'error', topics);
    throw error;
  }

  await log('checkDuplicates', `${data.length} sujets validés enregistrés en base`, 'success', data);
  return data;
}
