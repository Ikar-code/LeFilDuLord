import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router";
import { supabase } from "../../utils/supabase/client";

interface Article {
  id: string;
  titre: string;
  resume: string;
  date_publication: string;
  date_creation: string;
  statut: "published" | "draft" | "rejected";
  score: number;
  categorie?: string;
  sujet_id?: string;
}

interface Sujet {
  id: string;
  titre: string;
  statut: string;
  date_creation: string;
  article_id?: string;
}

interface Journal {
  id: string;
  action: string;
  statut: "success" | "warning" | "error" | "info";
  details: string;
  date: string;
  article_id?: string;
  sujet_id?: string;
}

function fmt(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-sm p-4">
      <p className="text-xs text-muted-foreground mb-1" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
      <p
        className="text-3xl font-bold"
        style={{ fontFamily: "var(--font-display)", color: accent ? "var(--accent)" : "var(--foreground)" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-body)" }}>{sub}</p>}
    </div>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    published: "bg-green-50 text-green-700",
    draft: "bg-amber-50 text-amber-700",
    pending: "bg-blue-50 text-blue-700",
    processing: "bg-violet-50 text-violet-700",
    done: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    success: "bg-green-50 text-green-700",
    warning: "bg-amber-50 text-amber-700",
    error: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    published: "Publié", draft: "Brouillon", pending: "En attente",
    processing: "En cours", done: "Terminé", rejected: "Rejeté",
    success: "Succès", warning: "Avertissement", error: "Erreur",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${map[statut] || "bg-muted text-muted-foreground"}`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {label[statut] || statut}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 8.5 ? "#1A7A4A" : score >= 7 ? "#E07B20" : "#C41230";
  return (
    <span
      className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-sm"
      style={{ color, background: `${color}15`, fontFamily: "var(--font-body)" }}
    >
      {score.toFixed(1)}
    </span>
  );
}

type Tab = "articles" | "sujets" | "journaux";
type SortField = "date" | "score" | "statut";

export function AdminDashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sujets, setSujets] = useState<Sujet[]>([]);
  const [journaux, setJournaux] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("articles");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      try {
        const [aRes, sRes, jRes] = await Promise.all([
          supabase.from("articles").select("*"),
          supabase.from("sujets").select("*"),
          supabase.from("journaux").select("*"),
        ]);

        if (aRes.error) throw new Error(aRes.error.message);
        if (sRes.error) throw new Error(sRes.error.message);
        if (jRes.error) throw new Error(jRes.error.message);

        setArticles(
          (aRes.data || []).map((a: any) => ({
            ...a,
            resume: a.contenu ? a.contenu.slice(0, 150) + "…" : "",
            date_publication: a.date_publication || a.date_creation,
          }))
        );
        
        setSujets((sRes.data || []) as Sujet[]);

        setJournaux(
          (jRes.data || []).map((j: any) => ({
            id: j.id,
            action: j.etape,
            statut: j.statut,
            details: j.message,
            date: j.timestamp,
          }))
        );
      } catch (e) {
        console.error("Error loading admin data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredArticles = useMemo(() => {
    let arr = filterStatut === "all" ? articles : articles.filter(a => a.statut === filterStatut);
    arr = [...arr].sort((a, b) => {
      if (sortField === "date") {
        const diff = new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime();
        return sortDir === "desc" ? diff : -diff;
      }
      if (sortField === "score") {
        const diff = b.score - a.score;
        return sortDir === "desc" ? diff : -diff;
      }
      if (sortField === "statut") {
        const diff = a.statut.localeCompare(b.statut);
        return sortDir === "desc" ? -diff : diff;
      }
      return 0;
    });
    return arr;
  }, [articles, filterStatut, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: articles.length,
    published: articles.filter(a => a.statut === "published").length,
    draft: articles.filter(a => a.statut === "draft").length,
    avgScore: articles.length ? (articles.reduce((s, a) => s + a.score, 0) / articles.length).toFixed(1) : "—",
    pendingSujets: sujets.filter(s => s.statut === "pending" || s.statut === "processing").length,
  }), [articles, sujets]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "articles", label: "Articles", count: articles.length },
    { id: "sujets", label: "Sujets", count: sujets.length },
    { id: "journaux", label: "Journaux", count: journaux.length },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Dashboard administration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-body)" }}>
            Supervision du pipeline de publication · Le Fil du Lord
          </p>
        </div>
        <Link
          to="/"
          className="text-xs border border-border px-3 py-1.5 rounded-sm hover:bg-secondary transition-colors"
          style={{ fontFamily: "var(--font-body)" }}
        >
          ← Site public
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Articles totaux" value={stats.total} />
        <StatCard label="Publiés" value={stats.published} accent />
        <StatCard label="Brouillons" value={stats.draft} sub="en attente de révision" />
        <StatCard label="Score moyen IA" value={stats.avgScore} sub={`${stats.pendingSujets} sujets en attente`} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6 flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${activeTab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted-foreground">({t.count})</span>
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>Chargement…</p>
        </div>
      ) : (
        <>
          {/* ARTICLES TAB */}
          {activeTab === "articles" && (
            <div>
              {/* Filters + Sort */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex gap-1">
                  {["all", "published", "draft"].map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatut(s)}
                      className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${filterStatut === s ? "bg-foreground text-primary-foreground border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {s === "all" ? "Tous" : s === "published" ? "Publiés" : "Brouillons"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 ml-auto">
                  {(["date", "score", "statut"] as SortField[]).map(f => (
                    <button
                      key={f}
                      onClick={() => toggleSort(f)}
                      className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${sortField === f ? "bg-secondary border-border text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {f === "date" ? "Date" : f === "score" ? "Score" : "Statut"}
                      {sortField === f ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary text-left border-b border-border">
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>Titre</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell" style={{ fontFamily: "var(--font-body)" }}>Catégorie</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>Statut</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>Score</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell" style={{ fontFamily: "var(--font-body)" }}>Date création</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.map((article, i) => (
                      <tr
                        key={article.id}
                        className={`border-b border-border last:border-0 hover:bg-secondary/40 transition-colors ${i % 2 === 0 ? "" : "bg-background/50"}`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className="font-medium text-foreground line-clamp-1"
                            style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem" }}
                          >
                            {article.titre}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                            {article.categorie || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge statut={article.statut} />
                        </td>
                        <td className="px-4 py-3">
                          <ScorePill score={article.score} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                            {fmtDate(article.date_creation)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {article.statut === "published" && (
                            <Link
                              to={`/article/${article.id}`}
                              className="text-xs text-accent hover:underline"
                              style={{ fontFamily: "var(--font-body)" }}
                            >
                              Voir →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredArticles.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                    Aucun article correspondant
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUJETS TAB */}
          {activeTab === "sujets" && (
            <div className="border border-border rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-left border-b border-border">
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>Sujet</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>Statut</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell" style={{ fontFamily: "var(--font-body)" }}>Date détection</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell" style={{ fontFamily: "var(--font-body)" }}>Article lié</th>
                  </tr>
                </thead>
                <tbody>
                  {sujets.map((sujet, i) => {
                    const linkedArticle = sujet.article_id ? articles.find(a => a.id === sujet.article_id) : null;
                    return (
                      <tr
                        key={sujet.id}
                        className={`border-b border-border last:border-0 hover:bg-secondary/40 transition-colors ${i % 2 === 0 ? "" : "bg-background/50"}`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground text-xs line-clamp-2" style={{ fontFamily: "var(--font-body)" }}>
                            {sujet.titre}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge statut={sujet.statut} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                            {fmt(sujet.date_creation)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {linkedArticle ? (
                            <Link
                              to={`/article/${linkedArticle.id}`}
                              className="text-xs text-accent hover:underline line-clamp-1"
                              style={{ fontFamily: "var(--font-body)" }}
                            >
                              {linkedArticle.titre.slice(0, 40)}…
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* JOURNAUX TAB */}
          {activeTab === "journaux" && (
            <div className="space-y-2">
              {journaux.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-card border border-border rounded-sm p-4 flex gap-4"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mt-1.5 ${entry.statut === "success" ? "bg-green-500" : entry.statut === "warning" ? "bg-amber-500" : "bg-red-500"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <code
                        className="text-xs font-mono font-semibold bg-secondary px-1.5 py-0.5 rounded-sm"
                        style={{ fontFamily: "monospace" }}
                      >
                        {entry.action}
                      </code>
                      <StatusBadge statut={entry.statut} />
                      {entry.article_id && (
                        <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                          art:{entry.article_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                      {entry.details}
                    </p>
                  </div>
                  <time
                    className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {fmt(entry.date)}
                  </time>
                </div>
              ))}
              {journaux.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
                  Aucun journal d'activité
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
