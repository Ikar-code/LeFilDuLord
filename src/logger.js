import { supabase } from './clients.js';

// Identifiant de run : celui du run GitHub Actions s'il existe, sinon un id aléatoire.
// Il est préfixé à chaque message pour retrouver tous les logs d'une exécution
// (ex. dans la table journaux : message ilike '[run 123456]%').
export const RUN_ID = process.env.GITHUB_RUN_ID || Math.random().toString(36).slice(2, 10);

export async function log(etape, message, statut = 'info', details = null) {
  const messageAvecRun = `[run ${RUN_ID}] ${message}`;
  console.log(`[${etape}] ${statut.toUpperCase()}: ${messageAvecRun}`);
  const { error } = await supabase.from('journaux').insert({
    etape, message: messageAvecRun, statut, details
  });
  if (error) console.error('Erreur log Supabase:', error.message);
}
