"""
scrape_topics_v2.py — Scrape d'actualités CYBERSÉCURITÉ depuis des sources fiables.

Pour chaque catégorie : flux RSS (avec filtre de mots-clés optionnel) puis
DuckDuckGo en secours. Les résultats gardent leur date de publication, et le
texte réel de l'article est récupéré (tronqué) pour limiter les hallucinations
du LLM en aval.

Sortie : un fichier JSON (par défaut scraped_topics.json).
"""

import html
import json
import re
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from itertools import zip_longest

import requests

try:
    import feedparser
    FEEDPARSER_OK = True
except ImportError:
    FEEDPARSER_OK = False
    print("[AVERTISSEMENT] feedparser non installé", file=sys.stderr)

try:
    import trafilatura
    TRAFILATURA_OK = True
except ImportError:
    TRAFILATURA_OK = False
    print("[AVERTISSEMENT] trafilatura non installé : pas de texte complet", file=sys.stderr)

try:
    from ddgs import DDGS
    DDGS_OK = True
except ImportError:
    DDGS_OK = False
    print("[AVERTISSEMENT] ddgs non installé : pas de fallback DuckDuckGo", file=sys.stderr)

warnings.filterwarnings("ignore")

ANNEE = datetime.now().year

USER_AGENT = (
    "Mozilla/5.0 (compatible; LeFilDuLordBot/1.0; +https://github.com/Ikar-code/LeFilDuLord)"
)
TIMEOUT_CONNEXION = 5
TIMEOUT_LECTURE = 15
TAILLE_MAX_PAGE = 2_000_000  # octets

MAX_RESULTATS_PAR_FLUX = 15       # entrées lues par flux
MAX_RESULTATS_PAR_CATEGORIE = 12
MAX_RESULTATS_TOTAL = 150
AGE_MAX_JOURS = 7                 # les entrées plus vieilles (date connue) sont ignorées
EXTRAIT_MAX = 1000
TEXTE_SOURCE_MAX = 4000           # caractères de texte complet conservés
TEXTE_SOURCE_MIN = 400            # en dessous, on considère l'extraction ratée

# ---------------------------------------------------------------------------
# Filtres de mots-clés (regex, insensibles à la casse) pour les flux généralistes
# ---------------------------------------------------------------------------
F_VULNS = [r"vulnerab", r"zero-?day", r"\bCVE-\d", r"\bpatch", r"exploit", r"\bflaws?\b",
           r"faille", r"vuln[ée]rabilit", r"correctif"]
F_MALWARE = [r"ransomware", r"malware", r"botnet", r"trojan", r"stealer", r"backdoor",
             r"\bloader\b", r"spyware", r"rootkit", r"ran[cç]ongiciel", r"logiciel malveillant"]
F_LEAKS = [r"data breach", r"\bbreach", r"\bleak", r"exposed", r"stolen data", r"fuite",
           r"donn[ée]es personnelles", r"dark ?web"]
F_SCAMS = [r"phishing", r"\bscams?\b", r"fraud", r"smishing", r"vishing", r"social engineering",
           r"arnaque", r"hame[cç]onnage", r"escroquerie", r"sim.?swap", r"deepfake"]
F_IA = [r"\bAI\b", r"\bLLMs?\b", r"prompt injection", r"deepfake", r"agentic", r"ChatGPT",
        r"OpenAI", r"Anthropic", r"Gemini", r"Copilot", r"\bClaude\b", r"machine learning",
        r"intelligence artificielle", r"\bIA\b"]
F_REGLEMENTATION = [r"regulat", r"legislat", r"\blaws?\b", r"\bfines?\b", r"\bfined\b", r"GDPR",
                    r"RGPD", r"NIS ?2", r"CNIL", r"ANSSI", r"compliance", r"sanction",
                    r"Cyber Resilience Act", r"\bFTC\b", r"\bSEC\b", r"lawsuit", r"amende",
                    r"r[ée]glementation", r"conformit"]
F_GEOPOLITIQUE = [r"nation-state", r"state-sponsored", r"\bAPT ?\d*", r"espionage", r"Russia",
                  r"China", r"Chinese", r"North Korea", r"\bIran", r"Ukraine", r"cyber ?war",
                  r"hacktivis", r"Lazarus", r"Sandworm", r"espionnage", r"Russie", r"Chine"]
F_REUNION = [r"cyber", r"hack", r"pirat", r"ran[cç]on", r"ransomware", r"phishing",
             r"hame[cç]onnage", r"arnaque", r"escroquerie", r"fuite de donn", r"donn[ée]es personnelles",
             r"num[ée]rique", r"informatique", r"internet", r"\bfibre\b", r"CNIL", r"ANSSI",
             r"faille", r"fraude", r"deepfake", r"intelligence artificielle", r"\bwi-?fi\b",
             r"r[ée]seaux sociaux", r"mot de passe"]
F_EVENEMENTS_REUNION = [r"cyber", r"hack", r"\bCTF\b", r"num[ée]rique", r"informatique", r"salon",
                        r"conf[ée]rence", r"forum", r"hackathon"]

BLEEPING = "https://www.bleepingcomputer.com/feed/"
HACKERNEWS = "https://feeds.feedburner.com/TheHackersNews"
SECURITYWEEK = "https://feeds.feedburner.com/securityweek"
THERECORD = "https://therecord.media/feed"
KREBS = "https://krebsonsecurity.com/feed/"
DARKREADING = "https://www.darkreading.com/rss.xml"
SECURITYAFFAIRS = "https://securityaffairs.com/feed"
ZATAZ = "https://www.zataz.com/feed/"
LEMAGIT = "https://www.lemagit.fr/rss/Securite.xml"
LEMONDEINFO = "https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml"
ARS_SECURITY = "https://arstechnica.com/security/feed/"
SOPHOS = "https://news.sophos.com/en-us/feed/"
TALOS = "https://blog.talosintelligence.com/rss/"
UNIT42 = "https://unit42.paloaltonetworks.com/feed/"
CYBERNEWS = "https://cybernews.com/feed/"
HACKREAD = "https://hackread.com/feed/"
HELPNET = "https://www.helpnetsecurity.com/feed/"
INFOSEC_MAG = "https://www.infosecurity-magazine.com/rss/news/"

# Chaque flux est soit une URL (str), soit {"url": ..., "filtre": [regex, ...]} :
# avec un filtre, une entrée n'est gardée que si son titre ou résumé le contient.
SOURCES = {
    "vulnerabilites": {
        "rss": [
            "https://www.cert.ssi.gouv.fr/alerte/feed/",
            "https://www.cisa.gov/cybersecurity-advisories/all.xml",
            "https://googleprojectzero.blogspot.com/feeds/posts/default",
            "https://isc.sans.edu/rssfeed.xml",
            {"url": BLEEPING, "filtre": F_VULNS},
            {"url": SECURITYWEEK, "filtre": F_VULNS},
            {"url": HACKERNEWS, "filtre": F_VULNS},
        ],
        "ddg_fallback": [
            f"zero-day vulnerability CVE {ANNEE} site:bleepingcomputer.com OR site:thehackernews.com",
            f"faille de sécurité critique {ANNEE} site:zataz.com OR site:cert.ssi.gouv.fr",
        ],
    },
    "cyberattaques": {
        "rss": [THERECORD, KREBS, DARKREADING, SECURITYAFFAIRS, ZATAZ, LEMAGIT, INFOSEC_MAG],
        "ddg_fallback": [
            f"cyberattaque {ANNEE} site:zataz.com OR site:lemagit.fr OR site:therecord.media",
            f"cyberattack incident {ANNEE} site:bleepingcomputer.com OR site:darkreading.com",
        ],
    },
    "ransomware-malwares": {
        "rss": [
            TALOS, UNIT42, SOPHOS,
            {"url": BLEEPING, "filtre": F_MALWARE},
            {"url": HACKERNEWS, "filtre": F_MALWARE},
            {"url": SECURITYWEEK, "filtre": F_MALWARE},
        ],
        "ddg_fallback": [
            f"ransomware attack {ANNEE} site:bleepingcomputer.com OR site:therecord.media",
            f"nouveau malware campagne {ANNEE} site:zataz.com OR site:lemagit.fr",
        ],
    },
    "fuites-donnees": {
        "rss": [
            "https://www.troyhunt.com/rss/",
            {"url": BLEEPING, "filtre": F_LEAKS},
            {"url": THERECORD, "filtre": F_LEAKS},
            {"url": ZATAZ, "filtre": F_LEAKS},
            {"url": CYBERNEWS, "filtre": F_LEAKS},
            {"url": HACKREAD, "filtre": F_LEAKS},
        ],
        "ddg_fallback": [
            f"data breach {ANNEE} site:bleepingcomputer.com OR site:therecord.media",
            f"fuite de données {ANNEE} site:zataz.com OR site:lemagit.fr",
        ],
    },
    "arnaques-phishing": {
        "rss": [
            {"url": BLEEPING, "filtre": F_SCAMS},
            {"url": KREBS, "filtre": F_SCAMS},
            {"url": ZATAZ, "filtre": F_SCAMS},
            {"url": SOPHOS, "filtre": F_SCAMS},
            {"url": HACKREAD, "filtre": F_SCAMS},
            {"url": HELPNET, "filtre": F_SCAMS},
        ],
        "ddg_fallback": [
            f"phishing campagne arnaque {ANNEE} site:cybermalveillance.gouv.fr OR site:zataz.com",
            f"phishing scam campaign {ANNEE} site:bleepingcomputer.com OR site:krebsonsecurity.com",
        ],
    },
    "ia-securite": {
        "rss": [
            {"url": BLEEPING, "filtre": F_IA},
            {"url": HACKERNEWS, "filtre": F_IA},
            {"url": SECURITYWEEK, "filtre": F_IA},
            {"url": DARKREADING, "filtre": F_IA},
            {"url": THERECORD, "filtre": F_IA},
            {"url": ARS_SECURITY, "filtre": F_IA},
        ],
        "ddg_fallback": [
            f"AI security prompt injection LLM attack {ANNEE} site:darkreading.com OR site:securityweek.com",
            f"intelligence artificielle cybersécurité deepfake {ANNEE} site:lemagit.fr OR site:zataz.com",
        ],
    },
    "reglementation": {
        "rss": [
            LEMONDEINFO,
            {"url": THERECORD, "filtre": F_REGLEMENTATION},
            {"url": LEMAGIT, "filtre": F_REGLEMENTATION},
            {"url": SECURITYWEEK, "filtre": F_REGLEMENTATION},
            {"url": INFOSEC_MAG, "filtre": F_REGLEMENTATION},
        ],
        "ddg_fallback": [
            f"NIS2 RGPD CNIL ANSSI sanction cybersécurité {ANNEE}",
            f"cybersecurity regulation law fine {ANNEE} site:therecord.media OR site:infosecurity-magazine.com",
        ],
    },
    "geopolitique-cyber": {
        "rss": [
            {"url": THERECORD, "filtre": F_GEOPOLITIQUE},
            {"url": DARKREADING, "filtre": F_GEOPOLITIQUE},
            {"url": SECURITYWEEK, "filtre": F_GEOPOLITIQUE},
            {"url": KREBS, "filtre": F_GEOPOLITIQUE},
            {"url": ARS_SECURITY, "filtre": F_GEOPOLITIQUE},
            {"url": LEMAGIT, "filtre": F_GEOPOLITIQUE},
        ],
        "ddg_fallback": [
            f"state-sponsored hackers APT campaign {ANNEE} site:therecord.media OR site:securityweek.com",
            f"cyberespionnage cyberguerre {ANNEE} site:lemagit.fr OR site:zataz.com",
        ],
    },
    "outils-bonnes-pratiques": {
        "rss": [
            "https://www.schneier.com/feed/atom/",
            HELPNET,
            "https://www.microsoft.com/en-us/security/blog/feed/",
            SOPHOS,
        ],
        "ddg_fallback": [
            f"bonnes pratiques cybersécurité mot de passe MFA {ANNEE} site:cybermalveillance.gouv.fr OR site:cyber.gouv.fr",
            f"security best practices guide {ANNEE} site:helpnetsecurity.com OR site:schneier.com",
        ],
    },
    "evenements": {
        "rss": [
            {"url": "https://www.zinfos974.com/feed/", "filtre": F_EVENEMENTS_REUNION},
        ],
        "ddg_fallback": [
            f"conférence cybersécurité {ANNEE} FIC Black Hat DEF CON SSTIC",
            f"CTF hackathon cybersécurité La Réunion 974 {ANNEE}",
            f"événement cybersécurité Réunion océan Indien {ANNEE}",
        ],
    },
    "reunion": {
        "rss": [
            {"url": "https://www.zinfos974.com/feed/", "filtre": F_REUNION},
            {"url": "https://www.ipreunion.com/rss.xml", "filtre": F_REUNION},
            {"url": "https://www.lequotidien.re/feed/", "filtre": F_REUNION},
        ],
        "ddg_fallback": [
            f"cyberattaque La Réunion {ANNEE} site:zinfos974.com OR site:ipreunion.com OR site:clicanoo.re",
            f"piratage arnaque numérique Réunion 974 {ANNEE}",
            f"cybersécurité Réunion collectivité hôpital entreprise {ANNEE}",
        ],
    },
}

DOMAINES_FAIBLE_QUALITE = [
    "pinterest", "reddit.com", "quora", "yahoo", "amazon", "ebay", "alibaba",
    "wix", "squarespace", "canva", "facebook.com", "tiktok.com", "youtube.com",
    "linkedin.com", "medium.com",
]

FLUX_MORTS = []   # (url, raison)
_CACHE_FLUX = {}  # url -> entrées feedparser (un flux est utilisé par plusieurs catégories)


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------
def nettoyer_html(texte):
    """Retire balises, entités et espaces superflus d'un résumé RSS."""
    if not texte:
        return ""
    texte = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", texte)
    texte = re.sub(r"(?s)<[^>]+>", " ", texte)
    texte = html.unescape(texte)
    return re.sub(r"\s+", " ", texte).strip()


def telecharger(url, max_octets=TAILLE_MAX_PAGE):
    """GET avec timeout, User-Agent et plafond de taille. Lève une exception en cas d'échec."""
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError(f"schéma d'URL non supporté: {url}")
    with requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
        timeout=(TIMEOUT_CONNEXION, TIMEOUT_LECTURE),
        stream=True,
    ) as r:
        r.raise_for_status()
        contenu = b""
        for morceau in r.iter_content(chunk_size=65536):
            contenu += morceau
            if len(contenu) >= max_octets:
                break
        return contenu, r.encoding


def date_entree(entry):
    """Date de publication ISO (UTC) d'une entrée feedparser, ou None."""
    for champ in ("published_parsed", "updated_parsed", "created_parsed"):
        t = entry.get(champ)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                continue
    return None


def correspond_filtre(texte, filtre):
    if not filtre:
        return True
    return any(re.search(motif, texte, re.IGNORECASE) for motif in filtre)


def charger_flux(url):
    """Télécharge et parse un flux (avec cache). Retourne la liste des entrées ([] si flux mort)."""
    if url in _CACHE_FLUX:
        return _CACHE_FLUX[url]
    entrees = []
    try:
        contenu, _ = telecharger(url)
        feed = feedparser.parse(contenu)
        if not feed.entries:
            raison = "flux vide ou invalide"
            if getattr(feed, "bozo", False) and getattr(feed, "bozo_exception", None):
                raison += f" ({feed.bozo_exception})"
            FLUX_MORTS.append((url, raison))
            print(f"[scrape] FLUX MORT {url} — {raison}", file=sys.stderr)
        else:
            entrees = feed.entries
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        FLUX_MORTS.append((url, f"HTTP {code}"))
        print(f"[scrape] FLUX MORT {url} — HTTP {code}", file=sys.stderr)
    except Exception as e:
        FLUX_MORTS.append((url, str(e)[:120]))
        print(f"[scrape] FLUX MORT {url} — {e}", file=sys.stderr)
    _CACHE_FLUX[url] = entrees
    return entrees


# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------
def scraper_rss(flux, categorie):
    if isinstance(flux, dict):
        url, filtre = flux["url"], flux.get("filtre")
    else:
        url, filtre = flux, None

    limite_age = datetime.now(timezone.utc) - timedelta(days=AGE_MAX_JOURS)
    resultats = []

    for entry in charger_flux(url)[:MAX_RESULTATS_PAR_FLUX * (4 if filtre else 1)]:
        titre = nettoyer_html(entry.get("title", ""))
        lien = (entry.get("link") or "").strip()
        if not titre or not lien:
            continue

        extrait = nettoyer_html(entry.get("summary", ""))
        # Certains flux fournissent le texte complet dans <content:encoded>
        texte_flux = ""
        contenus = entry.get("content") or []
        if contenus:
            texte_flux = nettoyer_html(contenus[0].get("value", ""))

        if not correspond_filtre(f"{titre} {extrait}", filtre):
            continue

        date = date_entree(entry)
        if date and date < limite_age:
            continue

        resultats.append({
            "titre": titre,
            "extrait": extrait[:EXTRAIT_MAX],
            "texte_source": texte_flux[:TEXTE_SOURCE_MAX] if len(texte_flux) >= TEXTE_SOURCE_MIN else "",
            "url": lien,
            "date_publication": date.isoformat() if date else None,
            "categorie": categorie,
            "source_type": "rss",
            "source_url": url,
        })
        if len(resultats) >= MAX_RESULTATS_PAR_FLUX:
            break

    # Les plus récents d'abord
    resultats.sort(key=lambda r: r["date_publication"] or "", reverse=True)
    return resultats


def scraper_ddg_fallback(requete, categorie, num_resultats=5):
    resultats = []
    if not DDGS_OK:
        return resultats
    try:
        with DDGS(timeout=10) as ddgs:
            for r in (ddgs.text(requete, max_results=num_resultats) or []):
                url = r.get("href", "") or ""
                titre = nettoyer_html(r.get("title", ""))
                if not titre or not url:
                    continue
                if any(d in url.lower() for d in DOMAINES_FAIBLE_QUALITE):
                    continue
                resultats.append({
                    "titre": titre,
                    "extrait": nettoyer_html(r.get("body", "") or "")[:EXTRAIT_MAX],
                    "texte_source": "",
                    "url": url,
                    "date_publication": None,
                    "categorie": categorie,
                    "source_type": "ddg_fallback",
                    "source_url": None,
                })
    except Exception as e:
        print(f"[scrape] Erreur DuckDuckGo fallback ('{requete}'): {e}", file=sys.stderr)
    return resultats


def scraper_categorie(categorie):
    config = SOURCES.get(categorie, {})
    listes = []
    for flux in config.get("rss", []):
        url = flux["url"] if isinstance(flux, dict) else flux
        print(f"[scrape] RSS {categorie} : {url}", file=sys.stderr)
        listes.append(scraper_rss(flux, categorie))

    # Entrelace les flux (1 article de chaque tour à tour) pour qu'un flux prolifique
    # ne monopolise pas la catégorie.
    resultats = [r for groupe in zip_longest(*listes) for r in groupe if r] if listes else []

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


def recuperer_texte_complet(resultat):
    """Télécharge la page et en extrait le texte de l'article (tronqué)."""
    if resultat.get("texte_source") or not TRAFILATURA_OK:
        return
    try:
        contenu, encodage = telecharger(resultat["url"])
        page = contenu.decode(encodage or "utf-8", errors="ignore")
        texte = trafilatura.extract(page, include_comments=False, include_tables=False) or ""
        texte = re.sub(r"\s+", " ", texte).strip()
        if len(texte) >= TEXTE_SOURCE_MIN:
            resultat["texte_source"] = texte[:TEXTE_SOURCE_MAX]
    except Exception as e:
        print(f"[scrape] Texte complet indisponible ({resultat['url']}): {str(e)[:100]}", file=sys.stderr)


def scraper_tout():
    tous_resultats = []
    for categorie in SOURCES.keys():
        print(f"[scrape] === {categorie.upper()} ===", file=sys.stderr)
        resultats_cat = deduplique(scraper_categorie(categorie))
        print(f"[scrape] {categorie}: {len(resultats_cat)} résultats collectés", file=sys.stderr)
        tous_resultats.extend(resultats_cat[:MAX_RESULTATS_PAR_CATEGORIE])

    # Un même article peut sortir de plusieurs catégories : on garde la première.
    tous_resultats = deduplique(tous_resultats)[:MAX_RESULTATS_TOTAL]

    # Texte complet des articles retenus (en parallèle, hôtes variés)
    a_enrichir = [r for r in tous_resultats if not r.get("texte_source")]
    if a_enrichir and TRAFILATURA_OK:
        print(f"[scrape] Récupération du texte complet pour {len(a_enrichir)} articles...", file=sys.stderr)
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(recuperer_texte_complet, a_enrichir))

    return tous_resultats


if __name__ == "__main__":
    chemin_sortie = sys.argv[1] if len(sys.argv) > 1 else "scraped_topics.json"
    if not FEEDPARSER_OK:
        print("[ERREUR] feedparser est requis. pip install feedparser", file=sys.stderr)
        sys.exit(1)

    print("[scrape] Scraping des sources cybersécurité...", file=sys.stderr)
    resultats = scraper_tout()

    par_categorie = {}
    for r in resultats:
        par_categorie[r["categorie"]] = par_categorie.get(r["categorie"], 0) + 1
    avec_texte = sum(1 for r in resultats if r.get("texte_source"))

    with open(chemin_sortie, "w", encoding="utf-8") as f:
        json.dump({
            "date_scraping": datetime.now(timezone.utc).isoformat(),
            "nombre_resultats": len(resultats),
            "sources": "Flux RSS cybersécurité + DuckDuckGo fallback",
            "par_categorie": par_categorie,
            "flux_morts": [{"url": u, "raison": r} for u, r in FLUX_MORTS],
            "resultats": resultats,
        }, f, ensure_ascii=False, indent=2)

    print(f"[scrape] {len(resultats)} résultats écrits dans {chemin_sortie} "
          f"({avec_texte} avec texte complet)", file=sys.stderr)
    print(f"[scrape] Répartition : {par_categorie}", file=sys.stderr)
    if FLUX_MORTS:
        print(f"[scrape] {len(FLUX_MORTS)} flux morts :", file=sys.stderr)
        for u, raison in FLUX_MORTS:
            print(f"[scrape]   - {u} ({raison})", file=sys.stderr)

    # Aucun résultat = scraping cassé : on fait échouer le job.
    if not resultats:
        print("[ERREUR] Aucun résultat scrapé", file=sys.stderr)
        sys.exit(1)
