import { supabase } from './clients.js';
import { log } from './logger.js';
import { findImage } from './step5b_findImage.js';

const SEUIL_PUBLICATION = 7;

export async function publishArticle(article, evaluation, sujetTitre, categorie) {
  const statut = evaluation.score >= SEUIL_PUBLICATION ? 'published' : 'rejected';

  // On ne cherche une image que pour les articles effectivement publiés
  let imageUrl = null;
  if (statut === 'published') {
    imageUrl = await findImage(categorie);
  }

  const { error } = await supabase.from('articles').insert({
    titre: article.titre,
    contenu: article.contenu,
    angle: article.angle,
    score: evaluation.score,
    statut: statut,
    categorie: categorie,
    image_url: imageUrl
  });

  if (error) {
    await log('publishArticle', 'Erreur insertion article: ' + error.message, 'error');
    throw error;
  }

  // Met à jour le statut du sujet correspondant
  await supabase
    .from('sujets')
    .update({ statut: 'traite' })
    .eq('titre', sujetTitre);

  await log('publishArticle', `Article "${article.titre}" enregistré avec statut "${statut}" (score: ${evaluation.score}, image: ${imageUrl ? 'oui' : 'non'})`, 'success');
  return statut;
}
