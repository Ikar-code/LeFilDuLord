import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-faf3bff8/health", (c) => {
  return c.json({ status: "ok" });
});

// ── ARTICLES ──────────────────────────────────────────────────────────────────

app.get("/make-server-faf3bff8/articles", async (c) => {
  try {
    const statut = c.req.query("statut");
    const items = await kv.getByPrefix("article:");
    let articles = items.map((v: any) => (typeof v === "string" ? JSON.parse(v) : v));
    if (statut) articles = articles.filter((a: any) => a.statut === statut);
    articles.sort((a: any, b: any) => new Date(b.date_publication || b.date_creation).getTime() - new Date(a.date_publication || a.date_creation).getTime());
    return c.json(articles);
  } catch (e) {
    console.log("Error listing articles:", e);
    return c.json({ error: `Error listing articles: ${e}` }, 500);
  }
});

app.get("/make-server-faf3bff8/articles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const raw = await kv.get(`article:${id}`);
    if (!raw) return c.json({ error: "Article not found" }, 404);
    const article = typeof raw === "string" ? JSON.parse(raw) : raw;
    return c.json(article);
  } catch (e) {
    console.log("Error fetching article:", e);
    return c.json({ error: `Error fetching article: ${e}` }, 500);
  }
});

app.post("/make-server-faf3bff8/articles", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const article = { ...body, id, date_creation: body.date_creation || new Date().toISOString() };
    await kv.set(`article:${id}`, JSON.stringify(article));
    return c.json(article, 201);
  } catch (e) {
    console.log("Error creating article:", e);
    return c.json({ error: `Error creating article: ${e}` }, 500);
  }
});

app.put("/make-server-faf3bff8/articles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const raw = await kv.get(`article:${id}`);
    const existing = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    const updated = { ...existing, ...body, id };
    await kv.set(`article:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) {
    console.log("Error updating article:", e);
    return c.json({ error: `Error updating article: ${e}` }, 500);
  }
});

// ── SUJETS ────────────────────────────────────────────────────────────────────

app.get("/make-server-faf3bff8/sujets", async (c) => {
  try {
    const items = await kv.getByPrefix("sujet:");
    const sujets = items.map((v: any) => (typeof v === "string" ? JSON.parse(v) : v));
    sujets.sort((a: any, b: any) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
    return c.json(sujets);
  } catch (e) {
    console.log("Error listing sujets:", e);
    return c.json({ error: `Error listing sujets: ${e}` }, 500);
  }
});

app.post("/make-server-faf3bff8/sujets", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const sujet = { ...body, id, date_creation: body.date_creation || new Date().toISOString() };
    await kv.set(`sujet:${id}`, JSON.stringify(sujet));
    return c.json(sujet, 201);
  } catch (e) {
    console.log("Error creating sujet:", e);
    return c.json({ error: `Error creating sujet: ${e}` }, 500);
  }
});

app.put("/make-server-faf3bff8/sujets/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const raw = await kv.get(`sujet:${id}`);
    const existing = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    const updated = { ...existing, ...body, id };
    await kv.set(`sujet:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) {
    console.log("Error updating sujet:", e);
    return c.json({ error: `Error updating sujet: ${e}` }, 500);
  }
});

// ── JOURNAUX ──────────────────────────────────────────────────────────────────

app.get("/make-server-faf3bff8/journaux", async (c) => {
  try {
    const items = await kv.getByPrefix("journal:");
    const logs = items.map((v: any) => (typeof v === "string" ? JSON.parse(v) : v));
    logs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return c.json(logs);
  } catch (e) {
    console.log("Error listing journaux:", e);
    return c.json({ error: `Error listing journaux: ${e}` }, 500);
  }
});

app.post("/make-server-faf3bff8/journaux", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const entry = { ...body, id, date: body.date || new Date().toISOString() };
    await kv.set(`journal:${id}`, JSON.stringify(entry));
    return c.json(entry, 201);
  } catch (e) {
    console.log("Error creating journal entry:", e);
    return c.json({ error: `Error creating journal entry: ${e}` }, 500);
  }
});

// ── SEED ──────────────────────────────────────────────────────────────────────

app.post("/make-server-faf3bff8/seed", async (c) => {
  try {
    const existing = await kv.getByPrefix("article:");
    if (existing.length > 0) {
      return c.json({ message: "Data already seeded", count: existing.length });
    }

    const articles = [
      {
        id: "art-001",
        titre: "La France adopte une nouvelle stratégie nationale pour l'intelligence artificielle",
        resume: "Le gouvernement français a présenté son plan IA 2026, dotant le pays d'un budget record de 5 milliards d'euros pour positionner la France comme leader européen de l'IA générative.",
        contenu: `Le Premier ministre a dévoilé mardi matin, lors d'une conférence de presse à l'Élysée, le plan national pour l'intelligence artificielle horizon 2026-2030. Doté d'un budget sans précédent de 5 milliards d'euros, ce programme ambitionne de faire de la France le premier acteur européen dans le domaine de l'IA générative.

Le dispositif repose sur trois piliers fondamentaux. D'abord, la création de dix nouveaux centres de calcul haute performance sur le territoire, dont deux dédiés exclusivement à la recherche fondamentale. Ensuite, un programme de formation massif visant à former 200 000 professionnels aux métiers de l'IA d'ici 2028. Enfin, un fonds d'amorçage de 800 millions d'euros destiné aux startups françaises travaillant sur des modèles de langage souverains.

"La souveraineté numérique n'est pas une option, c'est une nécessité stratégique", a déclaré le ministre délégué au Numérique. Cette annonce intervient dans un contexte de compétition internationale intense, avec les États-Unis et la Chine investissant massivement dans ce secteur.

Les industriels du numérique français ont salué unanimement l'initiative, tout en soulignant la nécessité d'une réglementation claire pour accompagner ce développement. Le Parlement européen devrait être consulté sur les aspects transverses du plan dès le mois prochain.`,
        date_publication: "2026-06-10T08:30:00Z",
        date_creation: "2026-06-09T14:00:00Z",
        statut: "published",
        score: 9.1,
        categorie: "Technologie",
        sujet_id: "suj-001",
      },
      {
        id: "art-002",
        titre: "Réforme des retraites : le Conseil constitutionnel rend son verdict",
        resume: "Le Conseil constitutionnel a validé l'essentiel de la réforme des retraites, ouvrant la voie à une entrée en vigueur progressive dès septembre prochain malgré une opposition syndicale persistante.",
        contenu: `Le Conseil constitutionnel a rendu ce jeudi sa décision très attendue sur la réforme des retraites. Les Sages ont validé l'essentiel du texte, censurant uniquement trois dispositions jugées contraires à la Constitution, dont celle portant sur la prise en compte des périodes de chômage partiel dans le calcul des trimestres.

Cette décision ouvre la voie à l'application de la réforme dès le 1er septembre prochain. L'âge légal de départ à la retraite passera progressivement à 64 ans, tandis que la durée de cotisation sera portée à 43 annuités à l'horizon 2030.

Les syndicats, réunis dans une intersyndicale, ont immédiatement annoncé une nouvelle journée nationale de mobilisation pour le 25 juin. "Cette décision juridique ne valide pas la légitimité sociale de cette réforme", a déclaré le secrétaire général de la principale centrale syndicale.

Du côté du gouvernement, le ministre du Travail a salué "la victoire de la responsabilité budgétaire", assurant que des mesures d'accompagnement pour les carrières longues et les métiers pénibles seraient présentées avant la rentrée. Les marchés financiers ont accueilli positivement la nouvelle, l'indice CAC 40 gagnant 1,2 % dans les heures suivant l'annonce.`,
        date_publication: "2026-06-07T10:15:00Z",
        date_creation: "2026-06-06T18:00:00Z",
        statut: "published",
        score: 8.7,
        categorie: "Politique",
        sujet_id: "suj-002",
      },
      {
        id: "art-003",
        titre: "Sécheresse : le sud de la France face à une situation hydrique critique",
        resume: "Avec des réservoirs à 38 % de leur capacité en juin, préfets et agriculteurs du Midi tirent la sonnette d'alarme face à une saison estivale qui s'annonce particulièrement difficile pour les ressources en eau.",
        contenu: `Les services météorologiques confirment ce que les habitants du Languedoc et de Provence ressentent depuis plusieurs semaines : la situation hydrique dans le sud de la France est critique. Les réservoirs affichent un remplissage de seulement 38 % pour ce début juin, un niveau historiquement bas depuis les relevés de 1976.

Météo-France anticipe un été 2026 particulièrement chaud et sec, dans la continuité du printemps le plus sec jamais enregistré dans plusieurs départements du Gard et des Pyrénées-Orientales. Les préfets de cinq départements ont d'ores et déjà activé des mesures de restriction sur les usages agricoles et récréatifs.

Pour les agriculteurs, la situation est alarmante. "Certaines cultures de maïs ne survivront pas sans irrigation, mais l'eau manque déjà", explique le président de la Chambre d'agriculture de l'Hérault. Des aides d'urgence de 120 millions d'euros ont été annoncées par le ministère de l'Agriculture, mais les professionnels jugent la mesure insuffisante face à l'ampleur des besoins.

Les collectivités locales commencent à planifier des restrictions de l'eau potable pour juillet et août. La ville de Montpellier a déjà engagé un plan de sobriété hydrique avec des objectifs de réduction de 15 % de la consommation publique.`,
        date_publication: "2026-06-04T07:45:00Z",
        date_creation: "2026-06-03T20:30:00Z",
        statut: "published",
        score: 8.3,
        categorie: "Environnement",
        sujet_id: "suj-003",
      },
      {
        id: "art-004",
        titre: "Tour de France 2026 : un parcours inédit à travers les Alpes et la Corse",
        resume: "L'édition 2026 de la Grande Boucle promet d'être historique avec l'intégration pour la première fois d'une étape en Corse et six arrivées au sommet dans les massifs alpins.",
        contenu: `ASO, l'organisateur du Tour de France, a dévoilé hier le tracé complet de l'édition 2026. Au programme : 3 420 kilomètres répartis sur 21 étapes, avec une nouveauté majeure que les amateurs de cyclisme attendaient depuis des années — une étape insulaire en Corse, au départ de Bastia pour une arrivée à Bonifacio.

Le peloton quittera Bordeaux le 4 juillet pour rejoindre Paris le 26 juillet, après un périple qui traversera successivement les Pyrénées, le Massif central et les Alpes. Avec six arrivées au sommet, dont trois inédites — le Col de la Loze version longue, la station des Menuires et le Plateau des Glières —, ce Tour s'annonce comme l'un des plus sélectifs de l'histoire moderne.

"Nous avons voulu créer un parcours digne du 113ème Tour", a déclaré le directeur de la course. "Chaque étape de montagne sera une bataille ouverte." Les favoris déjà annoncés incluent plusieurs coureurs français, nourrissant l'espoir d'une victoire tricolore à Paris pour la première fois depuis 1985.

Les villes-étapes ont commencé leurs préparatifs. Nice, qui accueillera une arrivée d'étape, prévoit un investissement de 4 millions d'euros pour l'événement, misant sur un retour sur image économique estimé à 25 millions d'euros.`,
        date_publication: "2026-06-01T09:00:00Z",
        date_creation: "2026-05-31T16:00:00Z",
        statut: "published",
        score: 7.8,
        categorie: "Sport",
        sujet_id: "suj-004",
      },
      {
        id: "art-005",
        titre: "Inflation alimentaire : la grande distribution face à ses responsabilités",
        resume: "Alors que les prix alimentaires ont bondi de 14 % en deux ans, une commission parlementaire épingle les pratiques tarifaires des grands distributeurs et réclame une loi de transparence sur les marges.",
        contenu: `Une commission d'enquête parlementaire sur les marges dans la grande distribution a rendu public mardi son rapport final, dressant un tableau sévère des pratiques du secteur en période d'inflation. Entre 2024 et 2026, les prix des produits alimentaires de grande consommation ont progressé de 14,3 % en moyenne, bien au-delà de l'inflation générale à 6,8 %.

Les parlementaires pointent un "effet de loquet" : si les prix ont monté rapidement avec l'inflation, ils tardent à baisser malgré la normalisation des coûts d'approvisionnement. "Les marges des distributeurs ont progressé de 22 % sur la période étudiée, ce qui n'est pas compatible avec un discours sur le partage équitable de la valeur", conclut le rapporteur.

Les enseignes de la grande distribution ont immédiatement contesté ces conclusions, faisant valoir leurs investissements dans la transition écologique et les hausses de salaires imposées par la loi. Leur fédération professionnelle a publié une contre-étude montrant une compression des marges nettes depuis 2023.

Le gouvernement a annoncé la prochaine création d'un observatoire public des prix et des marges alimentaires, avec obligation de publication trimestrielle. Des négociations commerciales encadrées par l'État seront organisées à l'automne. Les associations de consommateurs réclament des mesures plus contraignantes, dont un mécanisme de blocage temporaire des prix sur les produits de première nécessité.`,
        date_publication: "2026-05-28T11:30:00Z",
        date_creation: "2026-05-27T19:00:00Z",
        statut: "published",
        score: 8.9,
        categorie: "Économie",
        sujet_id: "suj-005",
      },
      {
        id: "art-006",
        titre: "Logement étudiant : la crise s'aggrave dans les métropoles universitaires",
        resume: "À l'approche de la rentrée, 40 % des étudiants n'ont toujours pas trouvé de logement dans les grandes villes universitaires selon une enquête nationale. L'UNEF demande un plan d'urgence.",
        contenu: `À quelques mois de la rentrée universitaire 2026, la crise du logement étudiant atteint des proportions inédites. Une enquête nationale publiée par l'UNEF révèle que 40 % des étudiants interrogés dans les principales métropoles universitaires françaises n'avaient pas encore de logement confirmé pour septembre, contre 28 % l'année précédente.

Les causes sont multiples et s'alimentent mutuellement : hausse des loyers dans les villes universitaires (en moyenne +18 % sur trois ans à Paris, Lyon et Bordeaux), réduction du parc de logements disponibles liée à la conversion en meublés touristiques, et saturation des résidences universitaires du CROUS dont les listes d'attente comptent parfois plusieurs milliers de dossiers.

"Des étudiants renoncent à leurs études ou vivent dans des conditions indignes dans des sous-locations clandestines", alerte la présidente de l'UNEF. Plusieurs témoignages recueillis font état de chambres partagées à cinq ou six personnes, de colocations dans des caves ou des commerces désaffectés.

Face à cette situation, le ministère de l'Enseignement supérieur a annoncé la construction de 20 000 nouvelles places en résidence universitaire d'ici 2028, mais reconnaît que cette mesure n'aura pas d'effet immédiat. Pour la rentrée 2026, une aide d'urgence à l'installation de 200 euros sera versée aux boursiers sans logement, une mesure jugée "insuffisante" par les organisations étudiantes.`,
        date_publication: "2026-05-25T08:00:00Z",
        date_creation: "2026-05-24T14:00:00Z",
        statut: "published",
        score: 8.5,
        categorie: "Société",
        sujet_id: "suj-006",
      },
      {
        id: "art-007",
        titre: "La fusion Renault-Nissan au bord de l'implosion",
        resume: "Des sources proches du dossier révèlent que l'alliance Renault-Nissan traverse sa crise la plus grave depuis l'affaire Ghosn, avec des désaccords profonds sur la stratégie électrique et la gouvernance.",
        contenu: `L'alliance Renault-Nissan, pilier de l'industrie automobile mondiale, traverse une tempête silencieuse mais potentiellement destructrice. Selon plusieurs sources concordantes proches des négociations, les deux constructeurs peinent à s'entendre sur leur stratégie commune pour les véhicules électriques et sur la répartition des droits de vote au sein de la holding commune.

Au cœur du désaccord : la plateforme CMF-EV nouvelle génération. Renault souhaite en garder le contrôle exclusif, estimant avoir fourni l'essentiel des investissements de R&D. Nissan revendique au contraire une maîtrise conjointe, faisant valoir ses apports technologiques dans le domaine de la batterie solide. Les réunions du conseil d'administration de l'alliance ont été suspendues à deux reprises ces dernières semaines.

En parallèle, des discussions discrètes ont repris entre Nissan et Honda, qui avaient déjà amorcé un rapprochement en 2024. "Nissan explore toutes les options stratégiques, c'est naturel pour une entreprise de cette taille", a déclaré prudemment un porte-parole du constructeur nippon.

Du côté de Renault, la direction se veut apaisante publiquement, mais les inquiétudes sont réelles. L'État français, actionnaire à 15 % de Renault, suit le dossier avec attention. Une dissolution partielle ou totale de l'alliance pourrait avoir des conséquences importantes sur l'emploi dans les usines françaises et la compétitivité du groupe face à Volkswagen et aux constructeurs chinois.`,
        date_publication: "2026-05-21T13:00:00Z",
        date_creation: "2026-05-20T20:00:00Z",
        statut: "draft",
        score: 6.8,
        categorie: "Économie",
        sujet_id: "suj-007",
      },
    ];

    const sujets = [
      { id: "suj-001", titre: "Stratégie nationale IA France 2026", statut: "done", date_creation: "2026-06-09T10:00:00Z", article_id: "art-001" },
      { id: "suj-002", titre: "Conseil constitutionnel et réforme retraites", statut: "done", date_creation: "2026-06-06T12:00:00Z", article_id: "art-002" },
      { id: "suj-003", titre: "Sécheresse exceptionnelle sud France été 2026", statut: "done", date_creation: "2026-06-03T16:00:00Z", article_id: "art-003" },
      { id: "suj-004", titre: "Tour de France 2026 parcours officiel", statut: "done", date_creation: "2026-05-31T10:00:00Z", article_id: "art-004" },
      { id: "suj-005", titre: "Inflation alimentaire grande distribution marges", statut: "done", date_creation: "2026-05-27T14:00:00Z", article_id: "art-005" },
      { id: "suj-006", titre: "Crise logement étudiant rentrée 2026", statut: "done", date_creation: "2026-05-24T08:00:00Z", article_id: "art-006" },
      { id: "suj-007", titre: "Alliance Renault-Nissan désaccords stratégie EV", statut: "rejected", date_creation: "2026-05-20T14:00:00Z", article_id: "art-007" },
      { id: "suj-008", titre: "Politique immigratiom reforme europeen", statut: "pending", date_creation: "2026-06-11T06:00:00Z" },
      { id: "suj-009", titre: "Crise de l'eau Barcelone et littoral méditerranéen", statut: "processing", date_creation: "2026-06-10T22:00:00Z" },
    ];

    const journaux = [
      { id: "log-001", action: "VEILLE_IA", statut: "success", details: "Gemini a proposé 12 sujets d'actualité. 4 retenus après filtrage doublons.", date: "2026-06-09T10:00:00Z", sujet_id: "suj-001" },
      { id: "log-002", action: "REDACTION", statut: "success", details: "Article rédigé par Grok (2847 mots). Angle éditorial : impact économique et souveraineté.", date: "2026-06-09T11:30:00Z", article_id: "art-001", sujet_id: "suj-001" },
      { id: "log-003", action: "SCORING", statut: "success", details: "Score qualité : 9.1/10. Cohérence : 9.5, Pertinence : 9.2, Lisibilité : 8.8.", date: "2026-06-09T12:00:00Z", article_id: "art-001" },
      { id: "log-004", action: "PUBLICATION", statut: "success", details: "Article publié automatiquement (score > seuil 7.0). Statut → published.", date: "2026-06-09T12:05:00Z", article_id: "art-001" },
      { id: "log-005", action: "VEILLE_IA", statut: "success", details: "Gemini a proposé 9 sujets. 3 retenus. 2 doublons rejetés (déjà traités).", date: "2026-06-06T12:00:00Z", sujet_id: "suj-002" },
      { id: "log-006", action: "REDACTION", statut: "success", details: "Article rédigé par Gemini (2312 mots). Sources : Journal Officiel + dépêches AFP.", date: "2026-06-06T14:00:00Z", article_id: "art-002", sujet_id: "suj-002" },
      { id: "log-007", action: "SCORING", statut: "success", details: "Score qualité : 8.7/10. Cohérence : 8.9, Pertinence : 9.0, Lisibilité : 8.4.", date: "2026-06-06T14:45:00Z", article_id: "art-002" },
      { id: "log-008", action: "PUBLICATION", statut: "success", details: "Article publié automatiquement (score > seuil 7.0). Statut → published.", date: "2026-06-06T14:50:00Z", article_id: "art-002" },
      { id: "log-009", action: "REDACTION", statut: "success", details: "Article rédigé par Grok (1985 mots). Données météo intégrées.", date: "2026-05-20T21:00:00Z", article_id: "art-007", sujet_id: "suj-007" },
      { id: "log-010", action: "SCORING", statut: "warning", details: "Score qualité : 6.8/10 (sous le seuil de 7.0). Raison : manque de sources primaires vérifiables.", date: "2026-05-20T21:45:00Z", article_id: "art-007" },
      { id: "log-011", action: "REJET", statut: "error", details: "Article rejeté (score 6.8 < seuil 7.0). Statut → draft. Sujet marqué rejected.", date: "2026-05-20T21:50:00Z", article_id: "art-007", sujet_id: "suj-007" },
      { id: "log-012", action: "VEILLE_IA", statut: "success", details: "Cycle automatique du 11/06. Gemini analyse les tendances du moment. 2 sujets en attente.", date: "2026-06-11T06:00:00Z" },
    ];

    await Promise.all([
      ...articles.map(a => kv.set(`article:${a.id}`, JSON.stringify(a))),
      ...sujets.map(s => kv.set(`sujet:${s.id}`, JSON.stringify(s))),
      ...journaux.map(j => kv.set(`journal:${j.id}`, JSON.stringify(j))),
    ]);

    return c.json({ message: "Seed completed", articles: articles.length, sujets: sujets.length, journaux: journaux.length });
  } catch (e) {
    console.log("Error seeding data:", e);
    return c.json({ error: `Error seeding: ${e}` }, 500);
  }
});

Deno.serve(app.fetch);
