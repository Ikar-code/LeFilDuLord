import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface Article {
  id: string;
  titre: string;
  resume: string;
  contenu: string;
  date_publication: string;
  date_creation: string;
  statut: string;
  score: number;
  categorie?: string;
  sujet_id?: string;
}

const API = `https://${projectId}.supabase.co/functions/v1/make-server-faf3bff8`;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8.5 ? "#1A7A4A" : score >= 7 ? "#E07B20" : "#C41230";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color, fontFamily: "var(--font-body)" }}
      >
        {score.toFixed(1)}/10
      </span>
    </div>
  );
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/articles/${id}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (!res.ok) throw new Error(`Article introuvable (${res.status})`);
        setArticle(await res.json());
      } catch (e: any) {
        console.error("Error loading article:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
            Chargement de l'article…
          </span>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-accent text-sm mb-4" style={{ fontFamily: "var(--font-body)" }}>
          {error || "Article introuvable."}
        </p>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground underline" style={{ fontFamily: "var(--font-body)" }}>
          ← Retour à l'accueil
        </Link>
      </div>
    );
  }

  const paragraphs = article.contenu.split("\n\n").filter(Boolean);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to="/"
        className="inline-block text-xs text-muted-foreground hover:text-accent transition-colors mb-6"
        style={{ fontFamily: "var(--font-body)" }}
      >
        ← Retour à l'accueil
      </Link>

      {/* Article header */}
      <header className="mb-8 pb-8 border-b border-border">
        {article.categorie && (
          <span
            className="inline-block text-[10px] font-semibold tracking-widest uppercase text-accent mb-3"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {article.categorie}
          </span>
        )}
        <h1
          className="text-3xl sm:text-4xl font-bold leading-tight text-foreground mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {article.titre}
        </h1>
        <p
          className="text-lg text-muted-foreground leading-relaxed mb-5 font-light italic"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {article.resume}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
              Publié le
            </span>
            <time className="text-sm font-medium text-foreground capitalize" style={{ fontFamily: "var(--font-body)" }}>
              {formatDate(article.date_publication)}
            </time>
          </div>

          <div className="sm:border-l sm:border-border sm:pl-6 flex-1 max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                Score qualité IA
              </span>
            </div>
            <ScoreBar score={article.score} />
          </div>
        </div>
      </header>

      {/* Article body */}
      <div className="prose-section">
        {paragraphs.map((para, i) => (
          <p
            key={i}
            className="mb-5 leading-loose text-foreground"
            style={{ fontFamily: "var(--font-body)", fontSize: "1.05rem" }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-10 pt-6 border-t border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
            Article généré automatiquement par IA · Le Fil du Lord
          </span>
          <span>·</span>
          <span>Score : {article.score.toFixed(1)}/10</span>
        </div>
      </footer>
    </main>
  );
}
