-- BirdLogApp Supabase database schema
-- Run this in Supabase Dashboard -> SQL Editor.

create table if not exists public.observations (
    id text primary key,
    filename text,
    photo_url text,
    saved_at timestamptz,
    bird_name text not null,
    species text,
    obs_date date,
    state text,
    district text,
    location text,
    weather text,
    notes text
);

create table if not exists public.species (
    id text primary key,
    name text unique not null,
    category text
);

create index if not exists idx_observations_species on public.observations(species);
create index if not exists idx_observations_obs_date on public.observations(obs_date desc);
create index if not exists idx_observations_location on public.observations(location);

-- The Flask backend uses SUPABASE_SERVICE_ROLE_KEY, so it can access these tables
-- without exposing the service-role key to the browser.
