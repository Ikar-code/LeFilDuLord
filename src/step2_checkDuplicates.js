import { supabase } from './clients.js';
import { log } from './logger.js';
import { GROQ_API_KEY } from './clients.js';

async function trouverDoublonSemantique(topic, titresExistants) {
  if (!titresExistants || titresExistants.length === 0) return null;

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
- Ce n'est PAS un doublon si c'est juste le même sujet général mais un événement distinct.
- En cas de doute, considère que ce n'est PAS un doublon.

Réponds UNIQUEMENT en JSON valide :
{ "doublon": true ou false, "titreCorrespondant": "le titre exact ou null", "raison": "explication courte" }
Aucun texte avant ou après.
`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq: statut HTTP ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content.trim();
  const cleaned = text.replace(/```json|```/g, '').trim();

  let verdict;
  try {
    verdict = JSON.parse(cleaned);
  } catch (e) {
    await log('checkDuplicates', 'Erreur parsing JSON doublon sémantique: ' + e.message, 'error', { raw: text.substring(0, 1000) });
    throw e;
  }

  return verdict.doublon ? (verdict.titreCorrespondant || titresExistants[0]) : null;
}

export async function filterNewTopics(topics) {
  const newTopics = [];

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
    const { data, error } = await supabase.from('sujets').select('id').eq('titre', topic.titre).limit(1);

    if (error) {
      await log('checkDuplicates', 'Erreur vérification: ' + error.message, 'error', topic);
      continue;
    }

    if (data.length > 0) {
      await log('checkDuplicates', `Sujet déjà existant (exact), ignoré: ${topic.titre}`, 'info');
      continue;
    }

    try {
      const titreDoublon = await trouverDoublonSemantique(topic, titresExistants);
      if (titreDoublon) {
        await log('checkDuplicates', `Sujet déjà existant (reformulé), ignoré: "${topic.titre}" ≈ "${titreDoublon}"`, 'info');
        continue;
      }
    } catch (e) {
      await log('checkDuplicates', `Vérification sémantique échouée pour "${topic.titre}", sujet rejeté par sécurité: ${e.message}`, 'warning');
      continue;
    }

    newTopics.push(topic);
    titresExistants.push(topic.titre);
  }

  await log('checkDuplicates', `${newTopics.length} nouveaux sujets sur ${topics.length} proposés`, 'success');
  return newTopics;
}

export async function getNextPendingTopic(exclureTitres = null) {
  let query = supabase.from('sujets').select('*').eq('statut', 'nouveau').order('date_creation', { ascending: true });

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

export async function insertSujets(topics) {
  if (!topics || topics.length === 0) return [];

  const rows = topics.map((topic) => ({
    titre: topic.titre,
    description: topic.description,
    source: topic.source,
    extrait_brut: topic.extrait_brut || null,
    categorie: topic.categorie,
    statut: 'nouveau'
  }));

  const { data, error } = await supabase.from('sujets').insert(rows).select();

  if (error) {
    await log('checkDuplicates', 'Erreur insertion sujets: ' + error.message, 'error', topics);
    throw error;
  }

  await log('checkDuplicates', `${data.length} sujets validés enregistrés en base`, 'success', data);
  return data;
}

export async function enregistrerEchecSujet(sujetId) {
  const { data: sujetActuel, error: erreurLecture } = await supabase
    .from('sujets').select('nombre_echecs, titre').eq('id', sujetId).single();

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
      await log('checkDuplicates', `Sujet supprimé après ${nouveauCompteur} échecs: "${sujetActuel.titre}"`, 'info');
    }
    return;
  }

  const { error: erreurMaj } = await supabase.from('sujets').update({ nombre_echecs: nouveauCompteur }).eq('id', sujetId);

  if (erreurMaj) {
    await log('checkDuplicates', 'Erreur mise à jour compteur échec: ' + erreurMaj.message, 'error');
  } else {
    await log('checkDuplicates', `Échec enregistré (${nouveauCompteur}/${SEUIL_SUPPRESSION}) pour "${sujetActuel.titre}", une chance restante`, 'info');
  }
}
