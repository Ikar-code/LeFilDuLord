-- Pipeline v2 — Le Fil du Lord
-- À exécuter dans Supabase (SQL Editor). Idempotent : peut être relancé sans risque.

-- Sujets : faits vérifiés, résumé de vérification, sources réelles, date de publication de la source
alter table public.sujets add column if not exists faits_verifies jsonb not null default '[]'::jsonb;
alter table public.sujets add column if not exists verification   text;
alter table public.sujets add column if not exists sources        jsonb not null default '[]'::jsonb;
alter table public.sujets add column if not exists date_source    timestamptz;

-- Articles : sources affichées sous l'article
alter table public.articles add column if not exists sources jsonb not null default '[]'::jsonb;

-- Index utiles pour les tests de doublons exacts (étape 2) et l'expiration (étape 3)
create index if not exists sujets_source_idx on public.sujets (source);
create index if not exists sujets_statut_date_idx on public.sujets (statut, date_creation);

-- Remarque : le statut 'expire' est une simple valeur de la colonne sujets.statut.
-- Si tu as une contrainte CHECK sur cette colonne, ajoute-y 'expire'.
