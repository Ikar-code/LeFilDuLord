import { Link } from "react-router";

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1
        className="text-3xl font-bold text-foreground mb-6"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Politique de confidentialité
      </h1>

      <div className="space-y-6 text-sm text-foreground" style={{ fontFamily: "var(--font-body)" }}>
        <p>
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Éditeur du site</h2>
          <p>
            "Le Fil du Lord" est un média d'actualité indépendant développé par Lucas Rajany
            sous l'identité créative Fairy Lord.
            Pour toute question relative à cette politique de confidentialité, vous pouvez nous contacter à l'adresse suivante :{" "}
            <a href="mailto:lucanime0@gmail.com" className="text-accent hover:underline">
              lucanime0@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Données collectées</h2>
          <p>
            Le site "Le Fil du Lord" propose uniquement la consultation d'articles.
            Aucune donnée personnelle n'est collectée directement via formulaire,
            inscription ou compte utilisateur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Cookies et traceurs</h2>
          <p>
            Ce site peut utiliser des cookies à des fins de mesure d'audience et,
            le cas échéant, pour l'affichage de publicités personnalisées via des
            partenaires tiers (par exemple Google AdSense).
          </p>

          <p className="mt-2">
            Conformément au Règlement Général sur la Protection des Données (RGPD),
            un bandeau de consentement permet d'accepter ou de refuser les cookies
            non essentiels lors de la première visite.
            Le choix peut être modifié à tout moment via les paramètres du navigateur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Cookies tiers - Google AdSense</h2>
          <p>
            Si les cookies publicitaires sont acceptés, Google et ses partenaires
            peuvent utiliser des cookies afin de diffuser des annonces personnalisées
            selon la navigation des utilisateurs.

            Vous pouvez gérer vos préférences publicitaires directement sur{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              adssettings.google.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Hébergement</h2>
          <p>
            Ce site est hébergé par Vercel Inc., 340 S Lemon Ave #4133,
            Walnut, CA 91789, États-Unis.

            Certaines données techniques nécessaires au fonctionnement du service
            (adresse IP, type de navigateur, informations de connexion)
            peuvent être traitées par Vercel dans le cadre de l'hébergement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification,
            d'effacement et d'opposition concernant vos données personnelles.

            Le site ne collectant pas directement de données personnelles via un compte
            ou un formulaire, ces droits concernent principalement les traitements
            réalisés par les services tiers utilisés (cookies, publicité, mesure d'audience).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Contenu généré par IA</h2>
          <p>
            Les articles publiés sur "Le Fil du Lord" sont générés et traités
            automatiquement par des systèmes d'intelligence artificielle.

            Un contrôle qualité automatisé est appliqué afin de limiter les erreurs,
            mais les informations peuvent évoluer ou comporter des approximations.

            Nous recommandons aux utilisateurs de consulter plusieurs sources
            avant toute utilisation critique du contenu publié.
          </p>
        </section>

        <section>
          <p>
            © 2026 Le Fil du Lord · Développé par Lucas Rajany
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link
          to="/"
          className="text-accent hover:underline text-sm"
          style={{ fontFamily: "var(--font-body)" }}
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
