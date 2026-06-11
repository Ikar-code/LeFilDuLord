import { supabase } from './clients.js';

export async function log(etape, message, statut = 'info', details = null) {
  console.log(`[${etape}] ${statut.toUpperCase()}: ${message}`);
  const { error } = await supabase.from('journaux').insert({
    etape, message, statut, details
  });
  if (error) console.error('Erreur log Supabase:', error.message);
}
