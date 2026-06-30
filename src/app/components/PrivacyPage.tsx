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
            Le site "Le Fil du Lord" propose uniquement la lecture d'articles. Nous ne collectons
            aucune donnée personnelle via formulaire, inscription ou compte utilisateur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Cookies et traceurs</h2>
          <p>
            Ce site peut utiliser des cookies à des fins de mesure d'audience et, le cas échéant,
            pour l'affichage de publicités personnalisées via des partenaires tiers (par exemple Google AdSense).
          </p>
          <p className="mt-2">
            Conformément au Règlement Général sur la Protection des Données (RGPD), un bandeau de
            consentement vous permet d'accepter ou de refuser ces cookies non essentiels lors de
            votre première visite. Vous pouvez modifier votre choix à tout moment en effaçant les
            cookies de votre navigateur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Cookies tiers - Google AdSense</h2>
          <p>
            Si vous acceptez les cookies publicitaires, Google et ses partenaires peuvent utiliser
            des cookies pour diffuser des annonces personnalisées en fonction de votre navigation.
            Vous pouvez gérer vos préférences publicitaires directement sur{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              adssettings.google.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Hébergement</h2>
          <p>
            Ce site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
            Les données techniques (adresse IP, type de navigateur) peuvent être traitées par
            Vercel dans le cadre de l'hébergement du site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement
            et d'opposition concernant vos données personnelles. Étant donné que nous ne collectons
            pas de données via le site, ces droits s'appliquent principalement aux données traitées
            par les cookies tiers (publicité, mesure d'audience), gérables via vos paramètres
            navigateur ou les liens fournis ci-dessus.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Contenu généré par IA</h2>
          <p>
            Les articles publiés sur ce site sont générés et traités automatiquement
            par des systèmes d'intelligence artificielle. Un contrôle qualité automatisé
            est appliqué afin de limiter les erreurs, mais nous recommandons de vérifier
            les informations auprès de sources complémentaires.
          </p>
        </section>

        <section>
          <p>
            © 2026 Le Fil du Lord · Développé par Lucas Rajany
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link to="/" className="text-accent hover:underline text-sm" style={{ fontFamily: "var(--font-body)" }}>
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
