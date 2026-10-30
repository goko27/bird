# -*- coding: utf-8 -*-
"""
BirdLogApp - Database Management Module

Storage engines:
1. SQLite - local/offline relational database.
2. Supabase - hosted PostgreSQL database accessed through the Supabase API.

The legacy document-store fallback has been removed.
"""

import os
import sqlite3
from datetime import datetime, timezone

try:
    from supabase import create_client
except ImportError:  # pragma: no cover
    create_client = None


INITIAL_SPECIES = [
    {"id": "sp1", "name": "House Crow", "category": "Crow / Corvid"},
    {"id": "sp2", "name": "Common Myna", "category": "Myna / Starling"},
    {"id": "sp3", "name": "Indian Peafowl", "category": "Peafowl"},
    {"id": "sp4", "name": "Rose-ringed Parakeet", "category": "Parrot"},
    {"id": "sp5", "name": "House Sparrow", "category": "Sparrow"},
    {"id": "sp6", "name": "Red-vented Bulbul", "category": "Bulbul"},
    {"id": "sp7", "name": "White-throated Kingfisher", "category": "Kingfisher"},
    {"id": "sp8", "name": "Cattle Egret", "category": "Egret"},
    {"id": "sp9", "name": "Little Egret", "category": "Egret"},
    {"id": "sp10", "name": "Indian Pond Heron", "category": "Heron"},
    {"id": "sp11", "name": "Greater Flamingo", "category": "Flamingo"},
    {"id": "sp12", "name": "Black Kite", "category": "Raptor"},
    {"id": "sp13", "name": "Brahminy Kite", "category": "Raptor"},
    {"id": "sp14", "name": "Crested Serpent Eagle", "category": "Raptor"},
    {"id": "sp15", "name": "Indian Roller", "category": "Roller"},
    {"id": "sp16", "name": "Asian Koel", "category": "Cuckoo"},
    {"id": "sp17", "name": "Greater Coucal", "category": "Cuckoo"},
    {"id": "sp18", "name": "Common Kingfisher", "category": "Kingfisher"},
    {"id": "sp19", "name": "Oriental Magpie-Robin", "category": "Flycatcher"},
    {"id": "sp20", "name": "Purple Sunbird", "category": "Sunbird"},
    {"id": "sp21", "name": "Common Tailorbird", "category": "Warbler"},
    {"id": "sp22", "name": "Jungle Babbler", "category": "Babbler"},
    {"id": "sp23", "name": "Indian Robin", "category": "Robin"},
    {"id": "sp24", "name": "Spotted Dove", "category": "Dove"},
    {"id": "sp25", "name": "Eurasian Collared Dove", "category": "Dove"},
    {"id": "sp26", "name": "Rock Pigeon", "category": "Pigeon"},
    {"id": "sp27", "name": "Asian Openbill", "category": "Stork"},
    {"id": "sp28", "name": "Painted Stork", "category": "Stork"},
    {"id": "sp29", "name": "Black-headed Ibis", "category": "Ibis"},
    {"id": "sp30", "name": "Little Cormorant", "category": "Cormorant"},
    {"id": "sp31", "name": "Indian Pond Heron", "category": "Heron"},
    {"id": "sp32", "name": "Spot-billed Duck", "category": "Duck"},
    {"id": "sp33", "name": "Lesser Whistling Duck", "category": "Duck"},
    {"id": "sp34", "name": "Common Hoopoe", "category": "Hoopoe"},
    {"id": "sp35", "name": "Coppersmith Barbet", "category": "Barbet"},
    {"id": "sp36", "name": "Black-rumped Flameback", "category": "Woodpecker"},
    {"id": "sp37", "name": "Asian Palm Swift", "category": "Swift"},
    {"id": "sp38", "name": "Barn Owl", "category": "Owl"},
    {"id": "sp39", "name": "Spotted Owlet", "category": "Owl"},
    {"id": "sp40", "name": "Grey Francolin", "category": "Gamebird"}
]

INITIAL_OBSERVATIONS = []

OBSERVATION_COLUMNS = [
    "id", "filename", "photo_url", "saved_at", "bird_name", "species",
    "obs_date", "state", "district", "location", "weather", "notes"
]
SPECIES_COLUMNS = ["id", "name", "category"]


class SQLDatabase:
    """Local relational database backed by SQLite."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_schema()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS observations (
                    id TEXT PRIMARY KEY,
                    filename TEXT,
                    photo_url TEXT,
                    saved_at TEXT,
                    bird_name TEXT NOT NULL,
                    species TEXT,
                    obs_date TEXT,
                    state TEXT,
                    district TEXT,
                    location TEXT,
                    weather TEXT,
                    notes TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS species (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    category TEXT
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_species ON observations(species)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_date ON observations(obs_date)")
            conn.commit()

    def get_observations(self, search: str = '', species: str = '', weather: str = '', location: str = ''):
        query = "SELECT * FROM observations WHERE 1=1"
        params = []

        if species and species.lower() != 'all':
            query += " AND species = ?"
            params.append(species)
        if weather and weather.lower() != 'all':
            query += " AND weather = ?"
            params.append(weather)
        if location and location.lower() != 'all':
            query += " AND LOWER(location) LIKE ?"
            params.append(f"%{location.lower()}%")
        if search:
            query += """ AND (
                LOWER(bird_name) LIKE ? OR LOWER(species) LIKE ? OR
                LOWER(location) LIKE ? OR LOWER(state) LIKE ? OR
                LOWER(district) LIKE ? OR LOWER(weather) LIKE ? OR
                LOWER(notes) LIKE ? OR LOWER(filename) LIKE ?
            )"""
            s = f"%{search.lower()}%"
            params.extend([s] * 8)

        query += " ORDER BY obs_date DESC, saved_at DESC"
        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_observation(self, obs_id: str):
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM observations WHERE id = ?", (obs_id,)).fetchone()
            return dict(row) if row else None

    def save_observation(self, obs: dict):
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO observations
                (id, filename, photo_url, saved_at, bird_name, species, obs_date,
                 state, district, location, weather, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    filename=excluded.filename,
                    photo_url=excluded.photo_url,
                    saved_at=excluded.saved_at,
                    bird_name=excluded.bird_name,
                    species=excluded.species,
                    obs_date=excluded.obs_date,
                    state=excluded.state,
                    district=excluded.district,
                    location=excluded.location,
                    weather=excluded.weather,
                    notes=excluded.notes
            """, tuple(obs.get(k, '') for k in OBSERVATION_COLUMNS))
            conn.commit()

    def delete_observation(self, obs_id: str):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM observations WHERE id = ?", (obs_id,))
            conn.commit()

    def get_stats(self):
        with self._get_connection() as conn:
            total = conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
            species = conn.execute("SELECT COUNT(DISTINCT species) FROM observations WHERE species IS NOT NULL AND species != ''").fetchone()[0]
            locations = conn.execute("SELECT COUNT(DISTINCT location) FROM observations WHERE location IS NOT NULL AND location != ''").fetchone()[0]
            recent = [dict(r) for r in conn.execute("SELECT * FROM observations ORDER BY obs_date DESC, saved_at DESC LIMIT 5").fetchall()]
            return {
                "total_sightings": total,
                "unique_species_count": species,
                "unique_locations_count": locations,
                "recent_sightings": recent
            }

    def get_species(self):
        with self._get_connection() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM species ORDER BY name ASC").fetchall()]

    def add_species(self, sp: dict):
        with self._get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO species (id, name, category) VALUES (?, ?, ?)",
                (sp.get('id'), sp.get('name'), sp.get('category', 'General'))
            )
            conn.commit()

    def delete_species(self, species_id: str):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM species WHERE id = ?", (species_id,))
            conn.commit()


class SupabaseDatabase:
    """Hosted PostgreSQL database accessed through Supabase."""

    def __init__(self, url: str, key: str):
        self.url = (url or '').strip().rstrip('/')
        # Users may paste the Supabase REST endpoint (…/rest/v1/).
        # supabase-py expects the project URL, so normalize it here.
        for suffix in ('/rest/v1', '/rest/v1/'):
            if self.url.lower().endswith(suffix):
                self.url = self.url[:-len(suffix)].rstrip('/')
                break
        self.key = (key or '').strip()
        self.client = None
        self.last_error = ''
        if self.url and self.key and create_client:
            try:
                self.client = create_client(self.url, self.key)
            except Exception as exc:
                self.last_error = str(exc)

    @property
    def configured(self):
        return bool(self.url and self.key and create_client)

    def check_connection(self):
        if not self.configured:
            if not create_client:
                return False, "Supabase Python package is not installed"
            return False, "Supabase URL/key are not configured"
        try:
            # A lightweight read verifies both credentials and the required table.
            self.client.table('observations').select('id').limit(1).execute()
            self.last_error = ''
            return True, "Connected (Supabase PostgreSQL)"
        except Exception as exc:
            self.last_error = str(exc)
            return False, f"Supabase connection/table check failed: {exc}"

    def get_status_summary(self):
        ok, message = self.check_connection()
        return {
            "is_live": ok,
            "description": message,
            "url": self.url
        }

    @staticmethod
    def _sort_records(records):
        return sorted(
            records,
            key=lambda r: (r.get('obs_date') or '', r.get('saved_at') or ''),
            reverse=True
        )

    def get_observations(self, search: str = '', species: str = '', weather: str = '', location: str = ''):
        if not self.configured:
            return []
        query = self.client.table('observations').select('*')
        if species and species.lower() != 'all':
            query = query.eq('species', species)
        if weather and weather.lower() != 'all':
            query = query.eq('weather', weather)
        if location and location.lower() != 'all':
            query = query.ilike('location', f'%{location}%')
        if search:
            # PostgREST OR syntax searches all text fields used by the app.
            s = search.replace(',', ' ')
            query = query.or_(
                f"bird_name.ilike.%{s}%,species.ilike.%{s}%,location.ilike.%{s}%,"
                f"state.ilike.%{s}%,district.ilike.%{s}%,weather.ilike.%{s}%,"
                f"notes.ilike.%{s}%,filename.ilike.%{s}%"
            )
        response = query.order('obs_date', desc=True).order('saved_at', desc=True).execute()
        return response.data or []

    def get_observation(self, obs_id: str):
        if not self.configured:
            return None
        response = self.client.table('observations').select('*').eq('id', obs_id).limit(1).execute()
        return response.data[0] if response.data else None

    def save_observation(self, obs: dict):
        if not self.configured:
            raise RuntimeError('Supabase is not configured.')
        payload = {k: obs.get(k, '') for k in OBSERVATION_COLUMNS}
        self.client.table('observations').upsert(payload, on_conflict='id').execute()

    def delete_observation(self, obs_id: str):
        if not self.configured:
            raise RuntimeError('Supabase is not configured.')
        self.client.table('observations').delete().eq('id', obs_id).execute()

    def get_stats(self):
        records = self.get_observations()
        return {
            "total_sightings": len(records),
            "unique_species_count": len({r.get('species') for r in records if r.get('species')}),
            "unique_locations_count": len({r.get('location') for r in records if r.get('location')}),
            "recent_sightings": records[:5]
        }

    def get_species(self):
        if not self.configured:
            return []
        response = self.client.table('species').select('*').order('name').execute()
        return response.data or []

    def add_species(self, sp: dict):
        if not self.configured:
            raise RuntimeError('Supabase is not configured.')
        payload = {k: sp.get(k, '') for k in SPECIES_COLUMNS}
        self.client.table('species').upsert(payload, on_conflict='id').execute()

    def delete_species(self, species_id: str):
        if not self.configured:
            raise RuntimeError('Supabase is not configured.')
        self.client.table('species').delete().eq('id', species_id).execute()


class DatabaseManager:
    """Unified controller for SQLite and Supabase."""

    def __init__(self, db_dir: str, supabase_url: str, supabase_key: str, default_engine: str = 'sql'):
        sqlite_path = os.path.join(db_dir, 'birdlog.db')
        self.sql_db = SQLDatabase(sqlite_path)
        self.supabase_db = SupabaseDatabase(supabase_url, supabase_key)
        self.active_engine = default_engine if default_engine in ['sql', 'supabase'] else 'sql'
        self.seed_sql_if_empty()
        if self.active_engine == 'supabase' and self.supabase_db.configured:
            try:
                self.seed_supabase_if_empty()
            except Exception as exc:
                print(f"[BirdLog DB] Supabase initialization deferred: {exc}")

    def get_active_db(self):
        if self.active_engine == 'supabase':
            return self.supabase_db
        return self.sql_db

    def get_status(self):
        supabase_info = self.supabase_db.get_status_summary()
        active_db = self.get_active_db()
        try:
            stats = active_db.get_stats()
        except Exception:
            stats = {"total_sightings": 0, "unique_species_count": 0, "unique_locations_count": 0}
        return {
            "active_engine": self.active_engine,
            "current_effective_engine": self.active_engine,
            "sql_status": "Healthy (SQLite)",
            "supabase_status": supabase_info["description"],
            "supabase_is_live": supabase_info["is_live"],
            "supabase_url": supabase_info["url"],
            "supabase_available": self.supabase_db.configured,
            "total_records": stats.get("total_sightings", 0),
            "unique_species": stats.get("unique_species_count", 0),
            "unique_locations": stats.get("unique_locations_count", 0)
        }

    def switch_engine(self, engine: str):
        engine = (engine or '').lower()
        if engine not in ['sql', 'supabase']:
            return False, "Invalid engine specified. Choose 'sql' or 'supabase'."
        if engine == 'supabase' and not self.supabase_db.configured:
            return False, "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the .env file."
        ok, msg = self.supabase_db.check_connection() if engine == 'supabase' else (True, 'SQLite is ready')
        if not ok:
            return False, msg
        self.active_engine = engine
        return True, f"Switched active database engine to {engine.upper()}."

    def seed_sql_if_empty(self):
        if not self.sql_db.get_observations():
            for obs in INITIAL_OBSERVATIONS:
                self.sql_db.save_observation(obs)
        existing = {str(sp.get("name", "")).strip().lower() for sp in self.sql_db.get_species()}
        for sp in INITIAL_SPECIES:
            if sp["name"].strip().lower() not in existing:
                self.sql_db.add_species(sp)

    def seed_supabase_if_empty(self):
        if not self.supabase_db.configured:
            return False, "Supabase is not configured."
        ok, msg = self.supabase_db.check_connection()
        if not ok:
            return False, msg
        if not self.supabase_db.get_observations():
            for obs in self.sql_db.get_observations():
                self.supabase_db.save_observation(obs)
        remote_species = self.supabase_db.get_species() or []
        existing_names = {str(sp.get("name", "")).strip().lower() for sp in remote_species}
        seed_species = self.sql_db.get_species() or INITIAL_SPECIES
        for sp in seed_species:
            if sp["name"].strip().lower() not in existing_names:
                self.supabase_db.add_species(sp)
        return True, "Supabase initialized and missing bird species were added."

    def sync_databases(self):
        """Bidirectional sync between local SQLite and hosted Supabase."""
        if not self.supabase_db.configured:
            return False, "Supabase is not configured."
        ok, msg = self.supabase_db.check_connection()
        if not ok:
            return False, msg

        sql_obs = {o['id']: o for o in self.sql_db.get_observations()}
        remote_obs = {o['id']: o for o in self.supabase_db.get_observations()}
        all_ids = set(sql_obs) | set(remote_obs)

        for obs_id in all_ids:
            local = sql_obs.get(obs_id)
            remote = remote_obs.get(obs_id)
            if local and remote:
                # saved_at is used as a simple last-write-wins timestamp.
                rec = local if (local.get('saved_at') or '') >= (remote.get('saved_at') or '') else remote
            else:
                rec = local or remote
            self.sql_db.save_observation(rec)
            self.supabase_db.save_observation(rec)

        sql_sp = {s['id']: s for s in self.sql_db.get_species()}
        remote_sp = {s['id']: s for s in self.supabase_db.get_species()}
        for sp_id in set(sql_sp) | set(remote_sp):
            sp = sql_sp.get(sp_id) or remote_sp.get(sp_id)
            self.sql_db.add_species(sp)
            self.supabase_db.add_species(sp)

        return True, f"Successfully synchronized {len(all_ids)} observation records between SQLite and Supabase."

    def get_observations(self, **kwargs):
        return self.get_active_db().get_observations(**kwargs)

    def get_observation(self, obs_id: str):
        return self.get_active_db().get_observation(obs_id)

    def save_observation(self, obs: dict):
        # Keep a local copy for offline use and persist the same record remotely.
        self.sql_db.save_observation(obs)
        if self.supabase_db.configured:
            self.supabase_db.save_observation(obs)

    def delete_observation(self, obs_id: str):
        self.sql_db.delete_observation(obs_id)
        if self.supabase_db.configured:
            self.supabase_db.delete_observation(obs_id)

    def get_stats(self):
        return self.get_active_db().get_stats()

    def get_species(self):
        return self.get_active_db().get_species()

    def add_species(self, sp: dict):
        self.sql_db.add_species(sp)
        if self.supabase_db.configured:
            self.supabase_db.add_species(sp)

    def delete_species(self, species_id: str):
        self.sql_db.delete_species(species_id)
        if self.supabase_db.configured:
            self.supabase_db.delete_species(species_id)
