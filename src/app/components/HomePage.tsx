import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../../utils/supabase/client";

interface Article {
  id: string;
  titre: string;
  contenu: string;
  date_publication: string;
  statut: string;
  score: number;
  categorie?: string;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function getCategoryColor(cat?: string) {
  const map: Record<string, string> = {
    Politique: "text-blue-700 bg-blue-50",
    Économie: "text-amber-700 bg-amber-50",
    Technologie: "text-violet-700 bg-violet-50",
    Société: "text-teal-700 bg-teal-50",
    Environnement: "text-green-700 bg-green-50",
    Sport: "text-orange-700 bg-orange-50",
  };
  return map[cat || ""] || "text-muted-foreground bg-muted";
}

function getResume(contenu: string) {
  const clean = contenu.replace(/\n/g, " ");
  return clean.length > 180 ? clean.slice(0, 180) + "…" : clean;
}

export function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("articles")
          .select("*")
          .eq("statut", "published")
          .order("date_publication", { ascending: false });

        if (error) throw new Error(error.message);
        setArticles(data || []);
      } catch (e: any) {
        console.error("Error loading articles:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
            Chargement des articles…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-accent text-sm" style={{ fontFamily: "var(--font-body)" }}>
          Impossible de charger les articles : {error}
        </p>
      </div>
    );
  }

  const [featured, ...rest] = articles;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {featured && (
        <article className="mb-10 pb-10 border-b border-border">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10">
            <div className="md:col-span-3">
              {featured.categorie && (
                <span
                  className={`inline-block text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-sm mb-3 ${getCategoryColor(featured.categorie)}`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {featured.categorie}
                </span>
              )}
              <Link to={`/article/${featured.id}`} className="group block">
                <h2
                  className="text-3xl sm:text-4xl font-bold leading-tight text-foreground group-hover:text-accent transition-colors duration-200 mb-3"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {featured.titre}
                </h2>
              </Link>
              <p
                className="text-muted-foreground leading-relaxed mb-4 text-base"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {getResume(featured.contenu)}
              </p>
              <div className="flex items-center gap-4">
                <time
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {formatDate(featured.date_publication)}
                </time>
                <Link
                  to={`/article/${featured.id}`}
                  className="text-xs font-semibold text-accent hover:underline underline-offset-2"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Lire la suite →
                </Link>
              </div>
            </div>
            <div className="md:col-span-2 flex items-center justify-center">
              <div
                className="w-full aspect-[4/3] rounded-sm flex items-end p-4"
                style={{
                  background: "linear-gradient(135deg, #1A1209 0%, #3D2B1F 100%)",
                }}
              >
                <span
                  className="text-white/60 text-xs leading-snug"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  À la une · {formatDate(featured.date_publication)}
                </span>
              </div>
            </div>
          </div>
        </article>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
        {rest.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {articles.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm" style={{ fontFamily: "var(--font-body)" }}>
            Aucun article publié pour le moment.
          </p>
        </div>
      )}
    </main>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="bg-card p-5 flex flex-col gap-3 hover:bg-secondary/40 transition-colors duration-150">
      {article.categorie && (
        <span
          className={`inline-block self-start text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-sm ${getCategoryColor(article.categorie)}`}
          style={{ fontFamily: "var(--font-body)" }}
        >
          {article.categorie}
        </span>
      )}
      <Link to={`/article/${article.id}`} className="group flex-1">
        <h3
          className="text-lg font-bold leading-snug text-foreground group-hover:text-accent transition-colors duration-200 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {article.titre}
        </h3>
        <p
          className="text-sm text-muted-foreground leading-relaxed line-clamp-3"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {getResume(article.contenu)}
        </p>
      </Link>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <time className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
          {formatDate(article.date_publication)}
        </time>
        <Link
          to={`/article/${article.id}`}
          className="text-xs font-semibold text-accent hover:underline underline-offset-2"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Lire →
        </Link>
      </div>
    </article>
  );
}
