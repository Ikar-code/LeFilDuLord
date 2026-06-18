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
// `exclureTitres` (Set ou tableau de titres) permet d'ignorer des sujets déjà essayés
// dans le run en cours (ex: un sujet qui vient d'être rejeté par le scoring).
export async function getNextPendingTopic(exclureTitres = null) {
  let query = supabase
    .from('sujets')
    .select('*')
    .eq('statut', 'nouveau')
    .order('date_creation', { ascending: true });

  const exclusions = exclureTitres ? Array.from(exclureTitres) : [];
  if (exclusions.length > 0) {
    query = query.not('titre', 'in', `(${exclusions.map((t) => `"${t}"`).join(',')})`);
  }

  const { data, error } = await query.limit(1);

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
    extrait_brut: topic.extrait_brut || null,
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

// Enregistre l'échec d'un sujet (score insuffisant après writeArticle).
// Si le sujet atteint 2 échecs au total, il est supprimé de la base
// (sinon il continuerait à boucler indéfiniment via getNextPendingTopic).
// Sinon, on incrémente simplement son compteur d'échecs pour lui laisser une 2e chance.
export async function enregistrerEchecSujet(sujetId) {
  const { data: sujetActuel, error: erreurLecture } = await supabase
    .from('sujets')
    .select('nombre_echecs, titre')
    .eq('id', sujetId)
    .single();

  if (erreurLecture) {
    await log('checkDuplicates', 'Erreur lecture sujet pour incrément échec: ' + erreurLecture.message, 'error');
    return;
  }

  const nouveauCompteur = (sujetActuel.nombre_echecs || 0) + 1;
  const SEUIL_SUPPRESSION = 2;

  if (nouveauCompteur >= SEUIL_SUPPRESSION) {
    const { error: erreurSuppression } = await supabase.from('sujets').delete().eq('id', sujetId);
    if (erreurSuppression) {
      await log('checkDuplicates', 'Erreur suppression sujet après échecs répétés: ' + erreurSuppression.message, 'error');
    } else {
      await log(
        'checkDuplicates',
        `Sujet supprimé après ${nouveauCompteur} échecs: "${sujetActuel.titre}"`,
        'info'
      );
    }
    return;
  }

  const { error: erreurMaj } = await supabase
    .from('sujets')
    .update({ nombre_echecs: nouveauCompteur })
    .eq('id', sujetId);

  if (erreurMaj) {
    await log('checkDuplicates', 'Erreur mise à jour compteur échec: ' + erreurMaj.message, 'error');
  } else {
    await log(
      'checkDuplicates',
      `Échec enregistré (${nouveauCompteur}/${SEUIL_SUPPRESSION}) pour "${sujetActuel.titre}", une chance restante`,
      'info'
    );
  }
}
