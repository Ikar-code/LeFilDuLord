import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase/client";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from("articles")
        .select("categorie")
        .eq("statut", "published")
        .not("categorie", "is", null);
      if (!error && data) {
        const uniques = [...new Set(data.map((d) => d.categorie as string))].sort();
        setCategories(uniques);
      }
    }
    fetchCategories();
  }, []);

  // Sync la barre de recherche avec l'URL au chargement / navigation
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("q") || "");
  }, [location.search]);

  function handleCategoryClick(cat: string) {
    setSearch("");
    navigate(`/?categorie=${encodeURIComponent(cat)}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (q) {
      navigate(`/?q=${encodeURIComponent(q)}`);
    } else {
      navigate("/");
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    // Recherche en temps réel : met à jour l'URL à chaque frappe
    if (val.trim()) {
      navigate(`/?q=${encodeURIComponent(val.trim())}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-1 border-b border-border text-xs text-muted-foreground">
          <span style={{ fontFamily: "var(--font-body)" }}>
            Publication automatisée par IA · Groupe Fairy Lord
          </span>
          <Link
            to={isAdmin ? "/" : "/admin"}
            className="hover:text-accent transition-colors duration-150"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {isAdmin ? "← Retour au site" : "Dashboard admin"}
          </Link>
        </div>

        <div className="py-5 text-center border-b border-border">
          <Link to="/" className="inline-block" onClick={() => setSearch("")}>
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Le Fil du Lord
            </h1>
            <p
              className="text-xs tracking-[0.2em] uppercase text-muted-foreground mt-1"
              style={{ fontFamily: "var(--font-body)" }}
            >
              L'actualité par l'intelligence artificielle
            </p>
          </Link>
        </div>

        {/* Barre de recherche */}
        <div className="py-3 border-b border-border">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Rechercher un article, un mot clé…"
              className="w-full bg-background border border-border rounded-md px-4 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
              style={{ fontFamily: "var(--font-body)" }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => { setSearch(""); navigate("/"); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Effacer la recherche"
              >
                ✕
              </button>
            ) : (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                🔍
              </span>
            )}
          </form>
        </div>

        {/* Navigation par catégorie */}
        <nav className="flex items-center gap-6 py-2 overflow-x-auto">
          <button
            onClick={() => { setSearch(""); navigate("/"); }}
            className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors whitespace-nowrap"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Tout
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors whitespace-nowrap"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {cat}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
