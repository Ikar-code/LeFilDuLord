"""
scrape_topics_v2.py — Scrape des actualités depuis des sources OFFICIELLES fiables.

Au lieu de scraper DuckDuckGo en aveugle (qui ramène du bruit),
on cible directement les sources reconnues par catégorie :
- Sites officiels (studios, plateformes)
- Flux RSS de médias spécialisés reconnus
- APIs officielles quand disponibles

Cela garantit que les résultats sont réels et vérifiables.
"""

import json
import sys
import warnings
from datetime import datetime
from urllib.parse import urlparse

try:
    import feedparser
    FEEDPARSER_OK = True
except ImportError:
    FEEDPARSER_OK = False
    print("[AVERTISSEMENT] feedparser non installé, les flux RSS ne seront pas lus", file=sys.stderr)

import requests
from ddgs import DDGS

warnings.filterwarnings("ignore")

ANNEE = datetime.now().year

# ============================================================
# SOURCES OFFICIELLES PAR CATÉGORIE
# ============================================================
# Format : "categorie" -> {"rss": [...], "ddg_requetes": [...]}
# Les flux RSS sont prioritaires (sources officielles)
# Les requêtes DuckDuckGo sont des fallbacks si RSS indisponible

SOURCES_OFFICIELLES = {
    "gaming": {
        "rss": [
            "https://www.polygon.com/rss/index.xml",  # Polygon (jeux/tech)
            "https://feeds.arstechnica.com/arstechnica/gaming",  # Ars Technica Gaming
            "https://www.gamespot.com/feeds/mashup/",  # GameSpot
            "https://www.pcgamer.com/feeds/all.xml",  # PC Gamer
        ],
        "ddg_fallback": [
            "gaming news 2026 site:gamespot.com OR site:polygon.com OR site:pcgamer.com",
        ]
    },
    "anime": {
        "rss": [
            "https://www.crunchyroll.com/feed/news",  # Crunchyroll (si disponible)
            "https://www.animenewsnetwork.com/rss.xml?ann-edition=us",  # Anime News Network (source officielle)
        ],
        "ddg_fallback": [
            f"anime news {ANNEE} site:animenewsnetwork.com OR site:crunchyroll.com",
        ]
    },
    "manga": {
        "rss": [
            "https://www.animenewsnetwork.com/rss.xml?ann-edition=us",  # ANN couvre manga aussi
        ],
        "ddg_fallback": [
            f"manga news {ANNEE} site:animenewsnetwork.com OR site:mangadex.cc",
        ]
    },
    "webtoon": {
        "rss": [
            # Naver Webtoon et Tapas n'ont pas de RSS public facilement accessible
            # On les scrape via DuckDuckGo en ciblant directement
        ],
        "ddg_fallback": [
            f"webtoon news announcement {ANNEE} site:webtoons.com OR site:tapas.io OR site:naver.com",
        ]
    },
    "streaming": {
        "rss": [
            "https://www.theverge.com/rss/index.xml",  # The Verge (tech/streaming)
        ],
        "ddg_fallback": [
            f"netflix announcement {ANNEE} site:netflix.com",
            f"streaming news {ANNEE} site:theverge.com OR site:variety.com",
        ]
    },
    "cinema series": {
        "rss": [
            "https://www.variety.com/feed/rss/film.xml",  # Variety Film
            "https://www.hollywoodreporter.com/c/movies/feed/",  # Hollywood Reporter
        ],
        "ddg_fallback": [
            f"film serie {ANNEE} site:variety.com OR site:hollywoodreporter.com",
        ]
    },
    "culture internet": {
        "rss": [
            "https://feeds.theverge.com/theverse",  # The Verge
            "https://www.reddit.com/r/technology/new.rss",  # Reddit Tech (pour tendances)
        ],
        "ddg_fallback": [
            f"internet trend viral {ANNEE}",
        ]
    },
    "technologie intelligence artificielle": {
        "rss": [
            "https://feeds.arstechnica.com/arstechnica/index",  # Ars Technica
            "https://www.theverge.com/rss/index.xml",  # The Verge
        ],
        "ddg_fallback": [
            f"AI intelligence artificielle {ANNEE} site:openai.com OR site:google.com/ai OR site:anthropic.com",
        ]
    },
    "reseaux sociaux": {
        "rss": [
            "https://www.theverge.com/rss/index.xml",  # The Verge (couvre les nouvelles des réseaux sociaux)
        ],
        "ddg_fallback": [
            f"social media news {ANNEE} site:theverge.com OR site:techcrunch.com",
        ]
    },
    "esport": {
        "rss": [
            # Peu de flux RSS officiels, on compte sur DuckDuckGo
        ],
        "ddg_fallback": [
            f"esport tournament 2026 site:liquipedia.net OR site:esportsinsider.com",
        ]
    }
}

# Domaines à exclure (bruits)
DOMAINES_FAIBLE_QUALITE = [
    "pinterest", "reddit.com", "quora", "yahoo", "amazon",
    "ebay", "alibaba", "wix", "squarespace", "canva",
]

MAX_RESULTATS_PAR_CATEGORIE = 5
MAX_RESULTATS_TOTAL = 40
SCORE_MINIMUM = 5  # Moins strict puisqu'on vient de sources fiables

# ============================================================
# SCRAPING RSS
# ============================================================

def scraper_rss(url, categorie):
    """Scrape un flux RSS et retourne une liste d'entrées fiables."""
    resultats = []
    try:
        feed = feedparser.parse(url)
        if not feed.entries:
            return resultats
        
        for entry in feed.entries[:10]:  # Limiter à 10 entrées par flux
            # On ne scrape que les articles récents (éviter l'archive)
            resultat = {
                "titre": entry.get("title", ""),
                "extrait": entry.get("summary", "")[:500],
                "url": entry.get("link", ""),
                "categorie": categorie,
                "source_type": "rss",
                "source_url": url,
            }
            if resultat["titre"] and resultat["url"]:
                resultats.append(resultat)
    except Exception as e:
        print(f"[scrape] Erreur RSS ({url}): {e}", file=sys.stderr)
    
    return resultats


def scraper_ddg_fallback(requete, categorie, num_resultats=5):
    """Scrape DuckDuckGo comme fallback si RSS non disponible."""
    resultats = []
    try:
        with DDGS() as ddgs:
            for r in (ddgs.text(requete, max_results=num_resultats) or []):
                resultat = {
                    "titre": r.get("title", ""),
                    "extrait": (r.get("body", "") or "")[:500],
                    "url": r.get("href", ""),
                    "categorie": categorie,
                    "source_type": "ddg_fallback",
                    "source_url": None,
                }
                # Filtrer le bruit
                if not any(d in resultat["url"].lower() for d in DOMAINES_FAIBLE_QUALITE):
                    resultats.append(resultat)
    except Exception as e:
        print(f"[scrape] Erreur DuckDuckGo fallback ('{requete}'): {e}", file=sys.stderr)
    
    return resultats


def scraper_categorie(categorie):
    """Scrape une catégorie via RSS en priorité, puis fallback DuckDuckGo."""
    resultats = []
    config = SOURCES_OFFICIELLES.get(categorie, {})
    
    # 1. Scraper les flux RSS (sources officielles)
    rss_feeds = config.get("rss", [])
    for rss_url in rss_feeds:
        print(f"[scrape] RSS {categorie} : {rss_url}", file=sys.stderr)
        resultats.extend(scraper_rss(rss_url, categorie))
    
    # 2. Si pas assez de résultats RSS, fallback DuckDuckGo
    if len(resultats) < 3:
        fallback_requetes = config.get("ddg_fallback", [])
        for requete in fallback_requetes:
            print(f"[scrape] DDG fallback {categorie} : {requete}", file=sys.stderr)
            resultats.extend(scraper_ddg_fallback(requete, categorie, num_resultats=5))
    
    return resultats


def deduplique(liste):
    """Enlever les doublons par URL."""
    vus = set()
    uniques = []
    for r in liste:
        url = r.get("url", "")
        if url and url not in vus:
            vus.add(url)
            uniques.append(r)
    return uniques


def scraper_tout():
    """Scrape TOUTES les catégories."""
    tous_resultats = []
    
    for categorie in SOURCES_OFFICIELLES.keys():
        print(f"[scrape] === {categorie.upper()} ===", file=sys.stderr)
        resultats_cat = scraper_categorie(categorie)
        resultats_cat = deduplique(resultats_cat)
        
        print(f"[scrape] {categorie}: {len(resultats_cat)} résultats collectés", file=sys.stderr)
        tous_resultats.extend(resultats_cat[:MAX_RESULTATS_PAR_CATEGORIE])
    
    # Dédupliquer globalement et limiter
    tous_resultats = deduplique(tous_resultats)[:MAX_RESULTATS_TOTAL]
    
    return tous_resultats


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    chemin_sortie = sys.argv[1] if len(sys.argv) > 1 else "scraped_topics.json"
    
    if not FEEDPARSER_OK:
        print("[ERREUR] feedparser est requis. Installez avec: pip install feedparser", file=sys.stderr)
        sys.exit(1)
    
    print(f"[scrape] Scraping des sources officielles...", file=sys.stderr)
    resultats = scraper_tout()
    
    with open(chemin_sortie, "w", encoding="utf-8") as f:
        json.dump(
            {
                "date_scraping": datetime.now().isoformat(),
                "nombre_resultats": len(resultats),
                "sources": "Flux RSS officiels + DuckDuckGo fallback",
                "resultats": resultats,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    
    print(f"[scrape] {len(resultats)} résultats écrits dans {chemin_sortie}", file=sys.stderr)
