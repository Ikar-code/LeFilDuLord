import { GROQ_API_KEY } from './clients.js';
import { log } from './logger.js';

async function callGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3-32b',
      reasoning_effort: 'none', // pas besoin du mode raisonnement pour du scoring direct
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq: statut HTTP ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export async function scoreArticle(article) {
  const prompt = `
Tu es rédacteur en chef et responsable qualité du média "Le Fil du Lord".
Ta mission est d'évaluer la qualité journalistique de cet article avant publication.
Article :
Titre :
${article.titre}
Contenu :
${article.contenu}
Évalue l'article selon les critères suivants :
1. Pertinence du sujet
- L'article traite-t-il d'un événement réel, récent et identifiable ?
- Le sujet présente-t-il un intérêt pour les lecteurs ?
2. Fiabilité journalistique
- L'événement est-il clairement expliqué ?
- Une date ou un repère temporel est-il présent ?
- Les acteurs concernés sont-ils identifiés ?
- Les informations semblent-elles vérifiables ?
3. Qualité rédactionnelle
- Le texte ressemble-t-il à un véritable article de média ?
- L'introduction présente-t-elle rapidement le fait principal ?
- Les paragraphes sont-ils organisés et compréhensibles ?
- Le style est-il neutre et professionnel ?
4. Richesse de l'article
- Présence de contexte utile
- Explication des conséquences
- Présence d'informations concrètes
- Développement suffisant du sujet
5. Respect du format Le Fil du Lord
L'article doit :
- informer et non donner une opinion
- éviter les spéculations
- éviter les affirmations non vérifiées
- rester accessible au grand public
Pénalités importantes :
- Sujet vague ou simple tendance sans événement précis : -3 points
- Informations non vérifiables ou inventées : -5 points
- Absence totale de date ou contexte temporel : -2 points
- Absence d'acteurs ou éléments concrets : -2 points
- Article trop court ou ressemblant à un résumé : -2 points
- Article principalement composé de généralités : -3 points
- Ton trop subjectif ou promotionnel : -2 points
Score :
10/10 :
Article publiable directement, clair, précis et journalistique.
7-9/10 :
Article acceptable avec quelques améliorations possibles.
5-6/10 :
Article nécessitant une réécriture avant publication.
0-4/10 :
Article non publiable.
Avant de noter, réponds mentalement à ces questions :
- Que s'est-il passé ?
- Quand ?
- Qui est concerné ?
- Pourquoi est-ce important ?
- Quelles preuves ou éléments vérifiables existent ?
Réponds UNIQUEMENT en JSON valide :
{
  "score": <note sur 10>,
  "commentaire": "explication courte"
}
`;
  const text = await callGroq(prompt);
  const cleaned = text.replace(/```json|```/g, '').trim();

  let evaluation;
  try {
    evaluation = JSON.parse(cleaned);
  } catch (e) {
    await log('scoreArticle', 'Erreur de parsing JSON: ' + e.message, 'error', { raw: text });
    throw e;
  }

  await log('scoreArticle', `Score obtenu: ${evaluation.score}/10`, 'success', evaluation);
  return evaluation;
}
