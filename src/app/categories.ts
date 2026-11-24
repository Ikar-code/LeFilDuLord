// Catégories éditoriales cybersécurité (mêmes slugs que CATEGORIES_AUTORISEES dans src/step1_findTopics.js).
export const CATEGORIES_CYBER: { slug: string; label: string }[] = [
  { slug: "vulnerabilites", label: "Vulnérabilités" },
  { slug: "cyberattaques", label: "Cyberattaques" },
  { slug: "ransomware-malwares", label: "Ransomware & malwares" },
  { slug: "fuites-donnees", label: "Fuites de données" },
  { slug: "arnaques-phishing", label: "Arnaques & phishing" },
  { slug: "ia-securite", label: "IA & sécurité" },
  { slug: "reglementation", label: "Réglementation" },
  { slug: "geopolitique-cyber", label: "Géopolitique cyber" },
  { slug: "outils-bonnes-pratiques", label: "Bonnes pratiques" },
  { slug: "evenements", label: "Événements" },
  { slug: "reunion", label: "La Réunion" },
];

// Libellé affichable d'une catégorie (les anciennes catégories gardent leur slug).
export function labelCategorie(slug?: string | null): string {
  if (!slug) return "";
  return CATEGORIES_CYBER.find((c) => c.slug === slug)?.label ?? slug;
}
