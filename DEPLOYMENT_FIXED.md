# BirdLog - Social actions fixed

## What is fixed
- Like toggles per logged-in user and updates the count.
- Comment opens a working comment dialog and stores comments.
- Share uses Web Share, Clipboard, or a copy fallback.
- Report stores a moderation report for the admin panel.
- Normal-user session cookies work for same-origin or separate frontend/backend deployments.
- Local uploaded images are returned as absolute backend URLs, so Netlify + Render does not break image paths.
- Render persistent disk stores `users.db`, `birdlog.db`, uploaded images, and CSV data.
- Admin remains a separate `/admin` page.

## Recommended deployment: Render backend
1. Create a Render Web Service from this project.
2. Build command: `pip install -r requirements.txt`
3. Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`
4. Add these environment variables:
   - `DB_TYPE=supabase`
   - `SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD`
   - `SECRET_KEY=<long random value>`
   - `SESSION_COOKIE_SECURE=true`
   - `SESSION_COOKIE_SAMESITE=None`
   - `BIRDLOG_DATA_DIR=/opt/render/project/src/data`
   - `FRONTEND_ORIGIN=https://YOUR-FRONTEND-DOMAIN`
5. Keep the persistent disk mounted at `/opt/render/project/src/data`.

## If frontend and backend are on different domains
Edit `api-config.js`:
```js
window.BIRDLOG_BACKEND_URL = 'https://YOUR-BACKEND.onrender.com';
window.BIRDLOG_FRONTEND_URL = 'https://YOUR-FRONTEND.netlify.app';
```
Do not put a Supabase service-role key in this file.

If the complete Flask project is deployed as one Render service, leave both values empty; the app automatically uses same-origin `/api` routes.

## Important
Do not deploy only `index.html` to Netlify and expect Flask `/api/community/...` endpoints to run there. The Flask backend must be running somewhere, and the frontend must point to that backend using `api-config.js` when they are separate.
