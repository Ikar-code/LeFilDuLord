import { supabase } from './clients.js';
import { log } from './logger.js';
import { findImage } from './step5b_findImage.js';

const SEUIL_PUBLICATION = 7;

function nomDeDomaine(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Enregistre l'article. Les articles refusés (score < 7, ou `rejete: true`) sont aussi stockés
// avec le statut 'rejected', pour pouvoir analyser les refus ; ils n'ont pas d'image et le
// sujet n'est alors pas marqué comme traité.
export async function publishArticle(article, evaluation, sujet, { rejete = false } = {}) {
  const statut = !rejete && evaluation.score >= SEUIL_PUBLICATION ? 'published' : 'rejected';

  // On ne cherche une image que pour les articles effectivement publiés
  let imageUrl = null;
  if (statut === 'published') {
    imageUrl = await findImage(sujet.categorie, article.titre);
  }

  // Sources affichées sous l'article : URL d'origine + sources consultées par la vérification
  const sources = Array.isArray(sujet.sources) && sujet.sources.length > 0
    ? sujet.sources
    : (sujet.source ? [{ titre: nomDeDomaine(sujet.source), url: sujet.source }] : []);

  const ligne = {
    titre: article.titre,
    contenu: article.contenu,
    angle: article.angle,
    score: evaluation.score,
    statut: statut,
    categorie: sujet.categorie,
    image_url: imageUrl
  };

  let { error } = await supabase.from('articles').insert({ ...ligne, sources });

  // Colonne `sources` pas encore créée (migration SQL non exécutée) : on publie sans.
  if (error && /column|schema cache|PGRST204/i.test(error.message)) {
    await log('publishArticle', 'Colonne articles.sources absente : exécute supabase/migrations/2026-11-24_pipeline_v2.sql. Publication sans sources.', 'warning');
    ({ error } = await supabase.from('articles').insert(ligne));
  }

  if (error) {
    await log('publishArticle', 'Erreur insertion article: ' + error.message, 'error');
    throw error;
  }

  // Un sujet n'est "traité" que si son article est publié ; un refus passe par enregistrerEchecSujet.
  if (statut === 'published') {
    const { error: erreurSujet } = await supabase
      .from('sujets')
      .update({ statut: 'traite' })
      .eq('id', sujet.id);
    if (erreurSujet) {
      await log('publishArticle', 'Erreur mise à jour du statut du sujet: ' + erreurSujet.message, 'error');
    }
  }

  await log(
    'publishArticle',
    `Article "${article.titre}" enregistré avec statut "${statut}" (score: ${evaluation.score}, image: ${imageUrl ? 'oui' : 'non'}, ${sources.length} source(s))`,
    statut === 'published' ? 'success' : 'warning'
  );
  return statut;
}
