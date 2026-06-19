import { supabase } from './clients.js';
import { log } from './logger.js';
import { callGeminiWithRetry } from './geminiRetry.js';

// Demande à Gemini si le nouveau sujet est un doublon sémantique
// (même événement reformulé) d'un des titres déjà en base.
// Retourne le titre existant correspondant si doublon, sinon null.
async function trouverDoublonSemantique(topic, titresExistants) {
  if (!titresExistants || titresExistants.length === 0) {
    return null;
  }

  const prompt = `
Tu compares un nouveau sujet d'actualité à une liste de titres déjà publiés ou en attente
dans la base de données du média "Le Fil du Lord".

Ta mission : déterminer si le nouveau sujet décrit EXACTEMENT le même événement
qu'un des titres existants, même si la formulation est différente
(ordre des mots, synonymes, reformulation).

Nouveau sujet :
Titre : ${topic.titre}
Description : ${topic.description}

Titres déjà existants en base :
${titresExistants.map((t, i) => `${i + 1}. ${t}`).join('\n')}

RÈGLE :
- Un doublon = le même événement précis (même annonce, même produit, même date, même acteur).
- Ce n'est PAS un doublon si c'est juste le même sujet général (ex: deux annonces différentes
  sur le même jeu, deux épisodes différents d'une même série) mais un événement distinct.
- En cas de doute, considère que ce n'est PAS un doublon (mieux vaut un doublon raté
  qu'un vrai sujet rejeté à tort).

Réponds UNIQUEMENT en JSON valide :
{
  "doublon": true ou false,
  "titreCorrespondant": "le titre exact de la liste qui correspond, ou null",
  "raison": "explication courte"
}

Aucun texte avant ou après.
`;

  const result = await callGeminiWithRetry(
    async (genAI, modelName) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      const r = await model.generateContent(prompt);
      const t = r.response.text().trim();
      if (!t) {
        throw new Error('REPONSE_VIDE: Gemini a renvoyé une réponse sans texte');
      }
      return r;
    },
    'checkDuplicates'
  );

  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();

  let verdict;
  try {
    verdict = JSON.parse(cleaned);
  } catch (e) {
    await log('checkDuplicates', 'Erreur parsing JSON doublon sémantique: ' + e.message, 'error', { raw: text.substring(0, 1000) });
    // En cas d'erreur de parsing, on ne bloque pas le sujet (sécurité : pas de faux positif)
    return null;
  }

  if (verdict.doublon) {
    return verdict.titreCorrespondant || titresExistants[0];
  }

  return null;
}

// Filtre uniquement : retourne les sujets qui n'existent pas déjà dans 'sujets'.
// Vérifie d'abord les doublons exacts (rapide, gratuit), puis les doublons
// reformulés via Gemini (même événement, formulation différente).
// Ne fait aucune insertion en base.
export async function filterNewTopics(topics) {
  const newTopics = [];

  // Récupère une fois tous les titres existants (sujets en attente + déjà traités récemment)
  // pour limiter les allers-retours Supabase et donner du contexte à Gemini.
  const { data: sujetsExistants, error: erreurLecture } = await supabase
    .from('sujets')
    .select('titre')
    .order('date_creation', { ascending: false })
    .limit(50);

  if (erreurLecture) {
    await log('checkDuplicates', 'Erreur lecture sujets existants: ' + erreurLecture.message, 'error');
  }

  const titresExistants = (sujetsExistants || []).map((s) => s.titre);

  for (const topic of topics) {
    // 1. Vérification exacte (rapide, gratuite)
    const { data, error } = await supabase
      .from('sujets')
      .select('id')
      .eq('titre', topic.titre)
      .limit(1);

    if (error) {
      await log('checkDuplicates', 'Erreur vérification: ' + error.message, 'error', topic);
      continue;
    }

    if (data.length > 0) {
      await log('checkDuplicates', `Sujet déjà existant (exact), ignoré: ${topic.titre}`, 'info');
      continue;
    }

    // 2. Vérification sémantique via Gemini (même événement, formulation différente)
    try {
      const titreDoublon = await trouverDoublonSemantique(topic, titresExistants);

      if (titreDoublon) {
        await log(
          'checkDuplicates',
          `Sujet déjà existant (reformulé), ignoré: "${topic.titre}" ≈ "${titreDoublon}"`,
          'info'
        );
        continue;
      }
    } catch (e) {
      // Si la vérification sémantique échoue (quota, erreur réseau, JSON cassé...), on
      // rejette le sujet par sécurité : mieux vaut perdre un sujet valide qu'enregistrer
      // un doublon non détecté.
      await log(
        'checkDuplicates',
        `Vérification sémantique échouée pour "${topic.titre}", sujet rejeté par sécurité: ${e.message}`,
        'warning'
      );
      continue;
    }

    newTopics.push(topic);
    // Évite qu'un doublon présent deux fois dans le même batch passe entre les mailles
    titresExistants.push(topic.titre);
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
