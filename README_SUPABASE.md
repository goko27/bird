# Bird Watching Electronic Log - Supabase Setup

MongoDB has been completely removed from this version. The application now uses:

- **SQLite** for local/offline storage.
- **Supabase PostgreSQL** for hosted/cloud storage.
- Flask as the backend API.

## 1. Create the Supabase database

1. Create/open your Supabase project.
2. Open **SQL Editor**.
3. Open `supabase_schema.sql` from this project.
4. Run the complete SQL script.

## 2. Configure backend credentials

Copy `.env.example` to `.env` and set:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
DB_TYPE=sql
```

The service-role key must remain on the Flask server. Do **not** put it into `index.html` or `app.js` and do not commit `.env` to GitHub.

## 3. Install Python packages

```bash
pip install -r requirements.txt
```

## 4. Start the application

```bash
python app.py
```

Then open:

```text
http://localhost:5000
```

## 5. Initialize Supabase

Open the database settings inside the application and click:

**Initialize Supabase from SQLite**

This copies the existing local SQLite observations/species into Supabase if the Supabase tables are empty.

You can then select **Supabase** as the active database engine.

## 6. Synchronization

The application provides:

**SQLite ↔ Supabase**

synchronization. Existing records are merged using `saved_at` as a simple last-write-wins timestamp when the same observation ID exists in both databases.

## 7. MongoDB removal

The following MongoDB components were removed:

- PyMongo dependency
- MongoDB adapter
- MongoDB URI configuration
- MongoDB UI controls
- MongoDB switching logic
- MongoDB synchronization logic
- `birdlog_mongo_store.json` fallback

## Important: `.env` must be beside `app.py`

The Flask server automatically loads a file named `.env` from the same folder as `app.py`. Create it by copying `.env.example` and replace the placeholders with the values from **Supabase Dashboard → Project Settings → API**:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_REAL_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=bird-images
DB_TYPE=supabase
```

The `bird-images` bucket must exist in Supabase Storage. It can be public for image viewing; uploads are performed by the Flask backend using the server-only service-role key.

Restart `python app.py` after changing `.env`. The database panel should then show **Connected (Supabase PostgreSQL)**. If the credentials are missing or invalid, the Supabase buttons remain disabled instead of producing repeated error notifications.


## Important credential check
The `.env` file is pre-filled with the Supabase URL and service-role API key supplied for this project. Keep `.env` private and never place the service-role key in frontend files or commit it to a public repository. The backend automatically converts a URL ending in `/rest/v1/` to the project URL expected by `supabase-py`.
