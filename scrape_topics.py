"""
scrape_topics.py — Scrape des actualités via DuckDuckGo pour les thèmes
de "Le Fil du Lord" (gaming, anime, manga, webtoon, culture internet,
streaming, cinéma/séries, technologie/IA, réseaux sociaux, esport).

Adapté de la fonction rechercher() du projet veille_tech, simplifié :
pas de WordPress, pas de FTP, pas de domaines "privilégiés" — on filtre
juste le bruit évident (DOMAINES_FAIBLE_QUALITE) sans favoriser de sites.

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

# Domaines clairement de mauvaise qualité, à exclure (pas de favoritisme,
# juste un filtre anti-bruit — pas de liste de domaines "privilégiés").
DOMAINES_FAIBLE_QUALITE = [
    "pinterest", "reddit", "quora", "yahoo", "forum", "amazon",
    "ebay", "alibaba", "wix.com", "squarespace", "canva",
    "typeform", "surveymonkey", "mailchimp", "jotform",
]

MAX_RESULTATS_PAR_CATEGORIE = 8
MAX_RESULTATS_TOTAL = 40
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
        resultats_cat = deduplique(resultats_cat)[:MAX_RESULTATS_PAR_CATEGORIE]
        tous_resultats.extend(resultats_cat)

    tous_resultats = deduplique(tous_resultats)[:MAX_RESULTATS_TOTAL]

    # On ne garde que les champs utiles pour Gemini (pas besoin de tout body)
    sortie = []
    for r in tous_resultats:
        sortie.append({
            "titre": r.get("title", ""),
            "extrait": (r.get("body", "") or "")[:500],
            "url": r.get("href", ""),
            "categorie": r.get("categorie", ""),
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
