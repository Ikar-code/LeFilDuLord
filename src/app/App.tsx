import { BrowserRouter, Routes, Route, Link } from "react-router";
import { Header } from "./components/Header";
import { HomePage } from "./components/HomePage";
import { ArticlePage } from "./components/ArticlePage";
import { AdminDashboard } from "./components/AdminDashboard";
import { PrivacyPage } from "./components/PrivacyPage";

function Footer() {
  return (
    <footer className="border-t border-border mt-12 py-8 bg-card">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
          © 2026 Le Fil du Lord · Groupe Fairy Lord
        </p>
        <div className="flex items-center gap-4">
          <Link
            to="/politique-de-confidentialite"
            className="text-xs text-muted-foreground hover:text-accent transition-colors"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Politique de confidentialité
          </Link>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
            Contenu généré automatiquement par IA · Deux publications par semaine
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function App() { 
  {/* MARKER-MAKE-KIT-INVOKED */}
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/politique-de-confidentialite" element={<PrivacyPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
