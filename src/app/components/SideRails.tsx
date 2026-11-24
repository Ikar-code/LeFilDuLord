import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { supabase } from "../../../utils/supabase/client";
import { CATEGORIES_CYBER } from "../categories";

// Bandes latérales (écrans >= 1536px) : remplacent les anciens emplacements publicitaires.
// Masquées en dessous, la mise en page mobile / tablette / laptop ne change pas.
// Pour remettre de la pub plus tard : remplacer le contenu de <LeftRail /> ou <RightRail />.
// Les colonnes défilent avec la page (pas de sticky : la colonne de droite est plus haute que l'écran).

interface RailArticle {
  id: string;
  titre: string;
  categorie?: string | null;
  date_publication: string;
  score?: number | null;
}

const CATEGORIES_MENACES = ["vulnerabilites", "cyberattaques", "ransomware-malwares", "fuites-donnees", "arnaques-phishing"];

const CONSEILS = [
  "Activez la double authentification sur vos comptes importants, de préférence avec une application ou une clé physique plutôt que par SMS.",
  "Utilisez un gestionnaire de mots de passe : un mot de passe long et unique pour chaque site limite les dégâts d'une fuite.",
  "Installez les mises à jour dès qu'elles sortent : la plupart des attaques exploitent des failles déjà corrigées.",
  "Un message qui joue sur l'urgence (colis, banque, impôts) doit vous alerter. Ne cliquez pas : allez directement sur le site officiel.",
  "Gardez une sauvegarde hors ligne de vos fichiers importants : c'est la meilleure parade face à un ransomware.",
  "Vérifiez si vos adresses e-mail ont fuité sur haveibeenpwned.com et changez les mots de passe concernés.",
  "Évitez les opérations sensibles (banque, achats) sur un Wi-Fi public, ou passez par un VPN de confiance.",
  "Désactivez les macros des documents Office reçus par e-mail, sauf si vous connaissez parfaitement l'expéditeur.",
  "Survolez un lien avant de cliquer : vérifiez que le domaine est bien le vrai, et pas une imitation à une lettre près.",
  "Ne réutilisez jamais le mot de passe de votre messagerie : elle permet de réinitialiser tous vos autres comptes.",
];

function conseilDuJour() {
  const jour = Math.floor(Date.now() / 86_400_000);
  return CONSEILS[jour % CONSEILS.length];
}

function formatCourt(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));
}

// Une seule requête partagée entre toutes les pages (évite de recharger à chaque navigation).
interface RailData {
  items: RailArticle[];
  total: number;
}
let cache: Promise<RailData> | null = null;

function chargerRail(): Promise<RailData> {
  if (!cache) {
    cache = Promise.resolve(
      supabase
        .from("articles")
        .select("id,titre,categorie,date_publication,score", { count: "exact" })
        .eq("statut", "published")
        .order("date_publication", { ascending: false })
        .limit(200)
    )
      .then(({ data, error, count }) => {
        if (error || !data) throw error ?? new Error("vide");
        return { items: data as RailArticle[], total: count ?? data.length };
      })
      .catch(() => {
        cache = null; // permet de réessayer plus tard
        return { items: [], total: 0 };
      });
  }
  return cache;
}

function useRailArticles(): RailData {
  const [data, setData] = useState<RailData>({ items: [], total: 0 });

  useEffect(() => {
    let annule = false;
    chargerRail().then((d) => {
      if (!annule) setData(d);
    });
    return () => {
      annule = true;
    };
  }, []);

  return data;
}

function ListeArticles({ articles, vide, score }: { articles: RailArticle[]; vide: string; score?: boolean }) {
  if (articles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
        {vide}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {articles.map((a) => (
        <li key={a.id}>
          <Link to={`/article/${a.id}`} className="group block">
            <span
              className="text-sm font-semibold leading-snug text-foreground group-hover:text-accent transition-colors line-clamp-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {a.titre}
            </span>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-body)" }}>
              <time>{formatCourt(a.date_publication)}</time>
              {score && typeof a.score === "number" && <span className="tabular-nums">· {a.score.toFixed(1)}/10</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RailCard({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-sm p-4">
      <h3
        className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3 pb-2 border-b border-border"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {titre}
      </h3>
      {children}
    </section>
  );
}

function LeftRail({ articles }: { articles: RailArticle[] }) {
  const menaces = articles.filter((a) => a.categorie && CATEGORIES_MENACES.includes(a.categorie)).slice(0, 4);
  const reunion = articles.filter((a) => a.categorie === "reunion").slice(0, 3);

  return (
    <div className="space-y-6">
      <RailCard titre="Radar · menaces récentes">
        <ListeArticles articles={menaces} vide="Aucune menace signalée récemment." />
      </RailCard>

      <RailCard titre="Conseil cyber du jour">
        <p className="text-sm text-foreground leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
          {conseilDuJour()}
        </p>
      </RailCard>

      <RailCard titre="Focus La Réunion">
        <ListeArticles articles={reunion} vide="Pas encore d'article sur La Réunion." />
      </RailCard>
    </div>
  );
}

function RightRail({ articles, total }: { articles: RailArticle[]; total: number }) {
  const compte = new Map<string, number>();
  for (const a of articles) {
    if (a.categorie) compte.set(a.categorie, (compte.get(a.categorie) ?? 0) + 1);
  }
  const categories = CATEGORIES_CYBER.filter((c) => compte.has(c.slug));
  const enContinu = articles.slice(0, 5);
  const mieuxNotes = [...articles]
    .filter((a) => typeof a.score === "number")
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .slice(0, 4);

  const il30j = Date.now() - 30 * 86_400_000;
  const ceMois = articles.filter((a) => new Date(a.date_publication).getTime() >= il30j).length;
  const notes = articles.filter((a) => typeof a.score === "number");
  const moyenne = notes.length ? notes.reduce((t, a) => t + (a.score ?? 0), 0) / notes.length : null;

  return (
    <div className="space-y-6">
      <RailCard titre="En continu">
        <ListeArticles articles={enContinu} vide="Aucun article pour le moment." />
      </RailCard>

      <RailCard titre="Mieux notés">
        <ListeArticles articles={mieuxNotes} vide="Pas encore de notes." score />
      </RailCard>

      <RailCard titre="Le Fil en chiffres">
        <dl className="grid grid-cols-3 gap-2 text-center" style={{ fontFamily: "var(--font-body)" }}>
          {[
            { v: String(total), l: "articles" },
            { v: String(ceMois), l: "ce mois-ci" },
            { v: moyenne !== null ? moyenne.toFixed(1) : "–", l: "note moy." },
          ].map((s) => (
            <div key={s.l}>
              <dd className="text-xl font-bold text-foreground tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {s.v}
              </dd>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</dt>
            </div>
          ))}
        </dl>
      </RailCard>

      <RailCard titre="Rubriques">
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
            Les rubriques apparaîtront avec les premiers articles.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/?categorie=${c.slug}`}
                  className="flex items-center justify-between text-sm text-foreground hover:text-accent transition-colors"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  <span>{c.label}</span>
                  <span className="text-xs text-muted-foreground">{compte.get(c.slug)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RailCard>
    </div>
  );
}

// Enveloppe la page : rails de chaque côté sur grand écran, colonne centrale seule sinon.
export function PageWithRails({ children }: { children: ReactNode }) {
  const { items: articles, total } = useRailArticles();

  return (
    <div className="mx-auto max-w-5xl 2xl:max-w-[1600px] px-4 sm:px-6 2xl:grid 2xl:grid-cols-[240px_minmax(0,1fr)_240px] 2xl:gap-10">
      <aside className="hidden 2xl:block py-8">
        <div>
          <LeftRail articles={articles} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
      <aside className="hidden 2xl:block py-8">
        <div>
          <RightRail articles={articles} total={total} />
        </div>
      </aside>
    </div>
  );
}
