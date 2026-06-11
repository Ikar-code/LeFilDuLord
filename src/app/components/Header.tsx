import { Link, useLocation } from "react-router";

export function Header() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-1 border-b border-border text-xs text-muted-foreground">
          <span style={{ fontFamily: "var(--font-body)" }}>
            Publication automatisée par IA · Groupe Fairy Lord
          </span>
          <Link
            to="/admin"
            className="hover:text-accent transition-colors duration-150"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {isAdmin ? "← Retour au site" : "Dashboard admin"}
          </Link>
        </div>

        {/* Masthead */}
        <div className="py-5 text-center border-b border-border">
          <Link to="/" className="inline-block">
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

        {/* Nav */}
        <nav className="flex items-center gap-6 py-2 overflow-x-auto">
          {["Politique", "Économie", "Technologie", "Société", "Environnement", "Sport"].map((cat) => (
            <button
              key={cat}
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
