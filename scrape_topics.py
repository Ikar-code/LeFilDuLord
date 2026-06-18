"""
scrape_topics.py — Scrape des actualités via DuckDuckGo pour les thèmes
de "Le Fil du Lord" (gaming, anime, manga, webtoon, culture internet,
streaming, cinéma/séries, technologie/IA, réseaux sociaux, esport).

Adapté de la fonction rechercher() du projet veille_tech, simplifié :
pas de WordPress, pas de FTP, pas de domaines "privilégiés" — on filtre
juste le bruit évident (DOMAINES_FAIBLE_QUALITE) sans favoriser de sites.

Ajoute un scoring par mots-clés spécifiques à chaque catégorie (comme
scorer_resultat() dans veille_tech) pour ne garder que les résultats
réellement pertinents par thème, sans se baser sur les domaines.

Écrit le résultat dans un fichier JSON (par défaut scraped_topics.json)
que le pipeline Node.js (step1_findTopics.js) lira ensuite.
"""

import json
import re
import sys
import unicodedata
import warnings
from datetime import datetime
from urllib.parse import urlparse

from ddgs import DDGS

try:
    import feedparser
    FEEDPARSER_OK = True
except ImportError:
    FEEDPARSER_OK = False

warnings.filterwarnings("ignore")

# ============================================================
# CONFIGURATION
# ============================================================

CATEGORIES = [
    "gaming",
    "anime",
    "manga",
    "webtoon",
    "culture internet",
    "streaming",
    "cinema series",
    "technologie intelligence artificielle",
    "reseaux sociaux",
    "esport",
]

# Mots-clés spécifiques par catégorie, utilisés pour scorer la pertinence
# d'un résultat par rapport à son thème (présence dans titre/extrait).
# Liste de départ à ajuster/compléter selon les résultats observés.
MOTS_CLES_CATEGORIE = {
    "gaming": [
        "playstation", "ps5", "xbox", "nintendo", "switch", "steam",
        "jeu video", "sortie", "studio", "epic games", "ubisoft",
        "activision", "rockstar", "dlc", "patch", "mise a jour",
        "console", "pc gaming", "early access",
    ],
    "anime": [
        "anime", "saison", "studio ghibli", "crunchyroll", "mal",
        "adaptation", "opening", "doublage", "vf", "vostfr",
        "shonen", "seinen", "diffusion", "episode",
    ],
    "manga": [
        "manga", "tankobon", "scan", "chapitre", "mangaka",
        "shonen jump", "weekly", "tome", "edition", "licence",
        "kodansha", "shueisha",
    ],
    "webtoon": [
        "webtoon", "naver", "tapas", "delitoon", "comic",
        "scan", "webcomic", "novelisation", "adaptation",
    ],
    "culture internet": [
        "youtube", "tiktok", "twitch", "viral", "meme", "tendance",
        "influenceur", "createur de contenu", "communaute", "buzz",
        "algorithme",
    ],
    "streaming": [
        "netflix", "disney+", "prime video", "crunchyroll", "twitch",
        "abonnement", "catalogue", "plateforme", "diffusion",
        "exclusivite",
    ],
    "cinema series": [
        "film", "serie", "saison", "bande annonce", "sortie cinema",
        "box office", "realisateur", "casting", "premiere",
        "studio", "marvel", "netflix",
    ],
    "technologie intelligence artificielle": [
        "intelligence artificielle", " ia ", "chatgpt", "gemini",
        "modele", "application", "outil", "lancement", "startup",
        "algorithme", "machine learning", "openai", "google",
    ],
    "reseaux sociaux": [
        "instagram", "tiktok", "x ", "twitter", "snapchat",
        "fonctionnalite", "mise a jour", "algorithme", "moderation",
        "influenceur", "application",
    ],
    "esport": [
        "esport", "tournoi", "league of legends", "valorant",
        "championnat", "equipe", "joueur pro", "prize pool",
        "competition", "twitch", "lan",
    ],
}

# Domaines clairement de mauvaise qualité, à exclure (pas de favoritisme,
# juste un filtre anti-bruit — pas de liste de domaines "privilégiés").
DOMAINES_FAIBLE_QUALITE = [
    "pinterest", "reddit", "quora", "yahoo", "forum", "amazon",
    "ebay", "alibaba", "wix.com", "squarespace", "canva",
    "typeform", "surveymonkey", "mailchimp", "jotform",
]

MAX_RESULTATS_PAR_CATEGORIE = 8
MAX_RESULTATS_TOTAL = 40
SCORE_MINIMUM = 10
ANNEE = datetime.now().year


def normaliser(texte):
    if not texte:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", texte.lower())
        if unicodedata.category(c) != "Mn"
    )


def est_bruit(resultat):
    url = resultat.get("href", "")
    dom = urlparse(url).netloc.lower()
    return any(d in dom for d in DOMAINES_FAIBLE_QUALITE)


def scorer_resultat(resultat, categorie):
    """Score un résultat selon la présence de mots-clés spécifiques à sa
    catégorie dans le titre et l'extrait. Pas de favoritisme de domaine."""
    titre = normaliser(resultat.get("title", ""))
    extrait = normaliser(resultat.get("body", ""))

    mots_cles = MOTS_CLES_CATEGORIE.get(categorie, [])
    score = 0

    for mot in mots_cles:
        mot_n = normaliser(mot)
        if mot_n in titre:
            score += 15
        if mot_n in extrait:
            score += 5

    # Léger bonus si l'année courante apparaît (signal de fraîcheur)
    if str(ANNEE) in titre or str(ANNEE) in extrait:
        score += 5

    return score


def deduplique(liste):
    vus = set()
    uniques = []
    for r in liste:
        href = r.get("href", "")
        if href and href not in vus:
            vus.add(href)
            uniques.append(r)
    return uniques


def scraper_categorie(categorie):
    """Scrape DuckDuckGo pour une catégorie donnée, sur les requêtes
    pertinentes pour l'année en cours."""
    resultats = []
    requetes = [
        f"{categorie} actualite {ANNEE}",
        f"{categorie} annonce {ANNEE}",
        f"{categorie} news {ANNEE}",
    ]

    try:
        with DDGS() as ddgs:
            for q in requetes:
                try:
                    for r in (ddgs.text(q, region="fr-fr", max_results=15) or []):
                        r["categorie"] = categorie
                        resultats.append(r)
                except Exception as e:
                    print(f"[scrape] Erreur requête '{q}': {e}", file=sys.stderr)
    except Exception as e:
        print(f"[scrape] Erreur DDGS pour catégorie '{categorie}': {e}", file=sys.stderr)

    return resultats


def scraper_tout():
    tous_resultats = []

    for categorie in CATEGORIES:
        print(f"[scrape] Recherche : {categorie}", file=sys.stderr)
        resultats_cat = scraper_categorie(categorie)
        resultats_cat = [r for r in resultats_cat if not est_bruit(r)]
        resultats_cat = deduplique(resultats_cat)

        # Scoring par mots-clés, ne garde que ceux au-dessus du seuil minimum
        for r in resultats_cat:
            r["score"] = scorer_resultat(r, categorie)
        resultats_cat = [r for r in resultats_cat if r["score"] >= SCORE_MINIMUM]
        resultats_cat.sort(key=lambda x: x["score"], reverse=True)

        print(
            f"[scrape] {categorie} : {len(resultats_cat)} résultats pertinents (score >= {SCORE_MINIMUM})",
            file=sys.stderr,
        )

        tous_resultats.extend(resultats_cat[:MAX_RESULTATS_PAR_CATEGORIE])

    tous_resultats = deduplique(tous_resultats)[:MAX_RESULTATS_TOTAL]

    # On ne garde que les champs utiles pour Gemini (pas besoin de tout body)
    sortie = []
    for r in tous_resultats:
        sortie.append({
            "titre": r.get("title", ""),
            "extrait": (r.get("body", "") or "")[:500],
            "url": r.get("href", ""),
            "categorie": r.get("categorie", ""),
            "score_pertinence": r.get("score", 0),
        })

    return sortie


if __name__ == "__main__":
    chemin_sortie = sys.argv[1] if len(sys.argv) > 1 else "scraped_topics.json"

    resultats = scraper_tout()

    with open(chemin_sortie, "w", encoding="utf-8") as f:
        json.dump(
            {
                "date_scraping": datetime.now().isoformat(),
                "nombre_resultats": len(resultats),
                "resultats": resultats,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"[scrape] {len(resultats)} résultats écrits dans {chemin_sortie}", file=sys.stderr)
