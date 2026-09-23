"""
scrape_topics_v2.py — Scrape des actualités depuis des sources OFFICIELLES fiables.
"""

import json
import sys
import warnings
from datetime import datetime

try:
    import feedparser
    FEEDPARSER_OK = True
except ImportError:
    FEEDPARSER_OK = False
    print("[AVERTISSEMENT] feedparser non installé", file=sys.stderr)

import requests
from ddgs import DDGS

warnings.filterwarnings("ignore")

ANNEE = datetime.now().year

SOURCES_OFFICIELLES = {
    "gaming": {
        "rss": [
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
        ],
        "ddg_fallback": [
            f"gaming news {ANNEE} site:gamespot.com OR site:polygon.com OR site:pcgamer.com",
        ]
    },
    "anime": {
        "rss": [
            "https://www.animenewsnetwork.com/rss.xml?ann-edition=us",
            "https://otakuusamagazine.com/feed/",
            "https://www.animenewsnetwork.com/all/rss.xml",
        ],
        "ddg_fallback": [
            f"anime news {ANNEE} site:animenewsnetwork.com OR site:crunchyroll.com",
        ]
    },
    "manga": {
        "rss": [
            "https://www.animenewsnetwork.com/rss.xml?ann-edition=us",
        ],
        "ddg_fallback": [
            f"manga news {ANNEE} site:animenewsnetwork.com",
        ]
    },
    "webtoon": {
        "rss": [],
        "ddg_fallback": [
            f"webtoon news announcement {ANNEE} site:webtoons.com OR site:tapas.io",
            f"webtoon news {ANNEE} site:animenewsnetwork.com",
        ]
    },
    "streaming": {
        "rss": [
            "https://www.theverge.com/rss/index.xml",
            "https://variety.com/v/digital/feed/",
            "https://deadline.com/feed/",
        ],
        "ddg_fallback": [
            f"streaming news {ANNEE} site:theverge.com OR site:variety.com",
        ]
    },
    "cinema": {
        "rss": [
            "https://www.variety.com/feed/rss/film.xml",
            "https://www.hollywoodreporter.com/c/movies/feed/",
            "https://deadline.com/v/film/feed/",
            "https://www.hollywoodreporter.com/c/tv/feed/",
            "https://www.indiewire.com/feed/",
            "https://collider.com/feed/",
        ],
        "ddg_fallback": [
            f"film serie {ANNEE} site:variety.com OR site:hollywoodreporter.com",
        ]
    },
    "culture-internet": {
        "rss": [
            "https://feeds.theverge.com/theverse",
            "https://knowyourmeme.com/newsfeed.rss",
            "https://www.dexerto.com/feed/",
        ],
        "ddg_fallback": [
            f"internet trend viral {ANNEE}",
        ]
    },
    "intelligence-artificielle": {
        "rss": [
            "https://feeds.arstechnica.com/arstechnica/index",
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/feed/",
            "https://www.technologyreview.com/feed/",
            "https://venturebeat.com/category/ai/feed/",
            "https://www.wired.com/feed/category/business/latest/rss",
        ],
        "ddg_fallback": [
            f"intelligence artificielle IA {ANNEE} site:anthropic.com OR site:openai.com",
        ]
    },
    "reseaux-sociaux": {
        "rss": [
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/tag/social/feed/",
            "https://www.socialmediatoday.com/feeds/news/",
        ],
        "ddg_fallback": [
            f"social media news {ANNEE} site:theverge.com OR site:techcrunch.com",
        ]
    },
    "esport": {
        "rss": [
            "https://www.dexerto.com/feed/",
            "https://dotesports.com/feed",
            "https://esportsinsider.com/feed",
        ],
        "ddg_fallback": [
            f"esport tournament {ANNEE} site:liquipedia.net OR site:esportsinsider.com",
        ]
    },
    "reunion": {
        "rss": [
            "https://www.zinfos974.com/feed/",
            "https://www.ipreunion.com/rss.xml",
            "https://www.lequotidien.re/feed/",
        ],
        "ddg_fallback": [
            f"La Réunion actualité {ANNEE} site:zinfos974.com OR site:ipreunion.com",
            f"Réunion 974 news {ANNEE}",
        ]
    },
    "evenements": {
        "rss": [
            "https://www.zinfos974.com/feed/",
        ],
        "ddg_fallback": [
            f"événement concert festival La Réunion 974 {ANNEE}",
            f"sortie loisir Réunion {ANNEE}",
        ]
    },
}

DOMAINES_FAIBLE_QUALITE = [
    "pinterest", "reddit.com", "quora", "yahoo", "amazon",
    "ebay", "alibaba", "wix", "squarespace", "canva",
]

MAX_RESULTATS_PAR_CATEGORIE = 10
MAX_RESULTATS_TOTAL = 100

def scraper_rss(url, categorie):
    resultats = []
    try:
        feed = feedparser.parse(url)
        if not feed.entries:
            return resultats
        for entry in feed.entries[:10]:
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
                if not any(d in resultat["url"].lower() for d in DOMAINES_FAIBLE_QUALITE):
                    resultats.append(resultat)
    except Exception as e:
        print(f"[scrape] Erreur DuckDuckGo fallback ('{requete}'): {e}", file=sys.stderr)
    return resultats

def scraper_categorie(categorie):
    resultats = []
    config = SOURCES_OFFICIELLES.get(categorie, {})
    for rss_url in config.get("rss", []):
        print(f"[scrape] RSS {categorie} : {rss_url}", file=sys.stderr)
        resultats.extend(scraper_rss(rss_url, categorie))
    if len(resultats) < 3:
        for requete in config.get("ddg_fallback", []):
            print(f"[scrape] DDG fallback {categorie} : {requete}", file=sys.stderr)
            resultats.extend(scraper_ddg_fallback(requete, categorie, num_resultats=5))
    return resultats

def deduplique(liste):
    vus = set()
    uniques = []
    for r in liste:
        url = r.get("url", "")
        if url and url not in vus:
            vus.add(url)
            uniques.append(r)
    return uniques

def scraper_tout():
    tous_resultats = []
    for categorie in SOURCES_OFFICIELLES.keys():
        print(f"[scrape] === {categorie.upper()} ===", file=sys.stderr)
        resultats_cat = scraper_categorie(categorie)
        resultats_cat = deduplique(resultats_cat)
        print(f"[scrape] {categorie}: {len(resultats_cat)} résultats collectés", file=sys.stderr)
        tous_resultats.extend(resultats_cat[:MAX_RESULTATS_PAR_CATEGORIE])
    tous_resultats = deduplique(tous_resultats)[:MAX_RESULTATS_TOTAL]
    return tous_resultats

if __name__ == "__main__":
    chemin_sortie = sys.argv[1] if len(sys.argv) > 1 else "scraped_topics.json"
    if not FEEDPARSER_OK:
        print("[ERREUR] feedparser est requis. pip install feedparser", file=sys.stderr)
        sys.exit(1)
    print(f"[scrape] Scraping des sources officielles...", file=sys.stderr)
    resultats = scraper_tout()
    with open(chemin_sortie, "w", encoding="utf-8") as f:
        json.dump({
            "date_scraping": datetime.now().isoformat(),
            "nombre_resultats": len(resultats),
            "sources": "Flux RSS officiels + DuckDuckGo fallback",
            "resultats": resultats,
        }, f, ensure_ascii=False, indent=2)
    print(f"[scrape] {len(resultats)} résultats écrits dans {chemin_sortie}", file=sys.stderr)
