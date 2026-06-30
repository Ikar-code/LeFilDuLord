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

      <div
        className="space-y-6 text-sm text-foreground"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <p>
          Dernière mise à jour : 30 juin 2026
        </p>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            1. Éditeur du site
          </h2>
          <p>
            "Le Fil du Lord" est un média d'actualité indépendant développé par
            Lucas Rajany sous l'identité créative Fairy Lord.
          </p>
          <p>
            Pour toute question relative à cette politique de confidentialité :
            <br />
            <a
              href="mailto:lucanime0@gmail.com"
              className="text-accent hover:underline"
            >
              lucanime0@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            2. Données collectées
          </h2>
          <p>
            Le site propose uniquement la lecture d'articles.
            Aucune donnée personnelle n'est collectée via formulaire,
            inscription ou compte utilisateur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            3. Cookies et traceurs
          </h2>
          <p>
            Le site peut utiliser des cookies pour la mesure d'audience
            et l'affichage éventuel de publicités personnalisées via
            des partenaires tiers comme Google AdSense.
          </p>
          <p>
            Un système de consentement permet d'accepter ou de refuser
            les cookies non essentiels conformément au RGPD.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            4. Cookies tiers - Google AdSense
          </h2>
          <p>
            Si les cookies publicitaires sont acceptés, Google et ses partenaires
            peuvent utiliser ces technologies pour afficher des publicités adaptées.
          </p>
          <p>
            Gestion des préférences publicitaires :
            <br />
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              adssettings.google.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            5. Hébergement
          </h2>
          <p>
            Le site est hébergé par Vercel Inc.
            340 S Lemon Ave #4133,
            Walnut, CA 91789, États-Unis.
          </p>
          <p>
            Des données techniques comme l'adresse IP ou le type de navigateur
            peuvent être traitées dans le cadre de l'hébergement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            6. Vos droits
          </h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès,
            de rectification, d'effacement et d'opposition concernant
            vos données personnelles.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            7. Contenu généré par IA
          </h2>
          <p>
            Les articles publiés sur Le Fil du Lord sont générés et traités
            automatiquement par des systèmes d'intelligence artificielle.
          </p>
          <p>
            Un contrôle qualité automatisé est appliqué afin de limiter
            les erreurs, mais les informations doivent être vérifiées
            avec des sources complémentaires.
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
