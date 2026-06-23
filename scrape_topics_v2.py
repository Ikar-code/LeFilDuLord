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
            # Médias gaming
            "https://www.polygon.com/rss/index.xml",
            "https://feeds.arstechnica.com/arstechnica/gaming",
            "https://www.gamespot.com/feeds/mashup/",
            "https://www.pcgamer.com/feeds/all.xml",
            "https://www.eurogamer.net/feed",
            "https://www.ign.com/rss/articles/feed?tags=games",
            "https://kotaku.com/rss",
            "https://www.rockpapershotgun.com/feed",
            "https://www.nintendolife.com/feeds/news",
            "https://www.pushsquare.com/feeds/news",

            # Officiels constructeurs / studios
            "https://blog.playstation.com/feed/",
            "https://news.xbox.com/en-us/feed/",
            "https://www.nintendo.com/us/gaming-news/rss/",
            "https://www.rockstargames.com/newswire/rss",
            "https://www.ubisoft.com/en-us/rss/news",
            "https://www.ea.com/news/rss.xml",
        ],
        "ddg_fallback": [
            f"gaming news {ANNEE} site:gamespot.com OR site:polygon.com OR site:pcgamer.com",
            f"gaming announcement {ANNEE} site:playstation.com OR site:xbox.com OR site:nintendo.com",
        ]
    },


    "anime": {
        "rss": [
            "https://www.crunchyroll.com/newsrss",
            "https://www.animenewsnetwork.com/rss.xml?ann-edition=us",
            "https://www.animenewsnetwork.com/all/rss.xml",
            "https://otakuusamagazine.com/feed/",

            # Officiels studios/distributeurs
            "https://www.toei-animation.com/en/feed/",
            "https://www.aniplex.co.jp/rss/",
        ],
        "ddg_fallback": [
            f"anime news {ANNEE} site:animenewsnetwork.com OR site:crunchyroll.com",
            f"anime announcement {ANNEE} site:toei-animation.com OR site:aniplex.co.jp",
        ]
    },


    "manga": {
        "rss": [
            "https://www.animenewsnetwork.com/rss.xml?ann-edition=us",
            "https://www.shonenjump.com/rss",
            "https://www.viz.com/rss/news",

            # Editeurs
            "https://www.shueisha.co.jp/rss/",
            "https://www.kodansha.co.jp/rss/",
        ],
        "ddg_fallback": [
            f"manga news {ANNEE} site:animenewsnetwork.com OR site:mangadex.org",
            f"manga announcement {ANNEE} site:viz.com OR site:shonenjump.com",
        ]
    },


    "webtoon": {
        "rss": [
            "https://www.webtoons.com/en/notice/rss",
            "https://www.tappytoon.com/en/rss",
        ],
        "ddg_fallback": [
            f"webtoon news announcement {ANNEE} site:webtoons.com OR site:tapas.io OR site:naver.com",
            f"webtoon news {ANNEE} site:animenewsnetwork.com OR site:bookriot.com",
        ]
    },


    "streaming": {
        "rss": [
            "https://www.theverge.com/rss/index.xml",
            "https://variety.com/v/digital/feed/",
            "https://deadline.com/feed/",
            "https://www.whats-on-netflix.com/feed/",

            # Officiels plateformes
            "https://about.netflix.com/en/newsroom/rss",
            "https://press.disney.com/rss",
            "https://press.wbd.com/rss",
        ],
        "ddg_fallback": [
            f"netflix announcement {ANNEE} site:netflix.com",
            f"streaming news {ANNEE} site:theverge.com OR site:variety.com",
            f"streaming release {ANNEE} site:disney.com OR site:max.com",
        ]
    },


    "cinema series": {
        "rss": [
            "https://www.variety.com/feed/rss/film.xml",
            "https://www.hollywoodreporter.com/c/movies/feed/",
            "https://deadline.com/v/film/feed/",
            "https://www.hollywoodreporter.com/c/tv/feed/",
            "https://www.indiewire.com/feed/",
            "https://collider.com/feed/",

            # Officiels
            "https://www.marvel.com/rss",
            "https://www.starwars.com/rss",
        ],
        "ddg_fallback": [
            f"film serie {ANNEE} site:variety.com OR site:hollywoodreporter.com",
            f"movie announcement {ANNEE} site:marvel.com OR site:starwars.com",
        ]
    },


    "culture internet": {
        "rss": [
            "https://feeds.theverge.com/theverse",
            "https://www.reddit.com/r/technology/new.rss",
            "https://knowyourmeme.com/newsfeed.rss",
            "https://www.dexerto.com/feed/",
        ],
        "ddg_fallback": [
            f"internet trend viral {ANNEE}",
            f"viral internet culture {ANNEE} site:knowyourmeme.com",
        ]
    },


    "technologie intelligence artificielle": {
        "rss": [
            "https://feeds.arstechnica.com/arstechnica/index",
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/feed/",
            "https://www.technologyreview.com/feed/",
            "https://venturebeat.com/category/ai/feed/",
            "https://www.wired.com/feed/category/business/latest/rss",

            # Officiels IA
            "https://openai.com/news/rss.xml",
            "https://www.anthropic.com/news/rss.xml",
            "https://deepmind.google/discover/blog/rss.xml",
        ],
        "ddg_fallback": [
            f"AI intelligence artificielle {ANNEE} site:openai.com OR site:google.com/ai OR site:anthropic.com",
            f"AI research breakthrough {ANNEE} site:arxiv.org OR site:nature.com",
        ]
    },


    "reseaux sociaux": {
        "rss": [
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/tag/social/feed/",
            "https://www.socialmediatoday.com/feeds/news/",

            # Officiels
            "https://about.fb.com/news/feed/",
            "https://blog.youtube/rss/",
            "https://newsroom.tiktok.com/rss",
        ],
        "ddg_fallback": [
            f"social media news {ANNEE} site:theverge.com OR site:techcrunch.com",
            f"social media update {ANNEE} site:facebook.com OR site:tiktok.com OR site:youtube.com",
        ]
    },


    "esport": {
        "rss": [
            "https://www.dexerto.com/feed/",
            "https://dotesports.com/feed",
            "https://esportsinsider.com/feed",

            # Officiels jeux esport
            "https://www.leagueoflegends.com/en-us/news/rss/",
            "https://playvalorant.com/en-us/news/feed/",
        ],
        "ddg_fallback": [
            f"esport tournament {ANNEE} site:liquipedia.net OR site:esportsinsider.com",
            f"esport news {ANNEE} site:riotgames.com OR site:blizzard.com",
        ]
    }
}

# Domaines à exclure (bruits)
DOMAINES_FAIBLE_QUALITE = [
    "pinterest", "reddit.com", "quora", "yahoo", "amazon",
    "ebay", "alibaba", "wix", "squarespace", "canva",
]

MAX_RESULTATS_PAR_CATEGORIE = 10
MAX_RESULTATS_TOTAL = 100
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
                "extrait": entry.get("summary", "")[:1000],
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
                    "extrait": (r.get("body", "") or "")[:1000],
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
