# BirdLog deployment and social features

## Why Like / Comment / Report were not working
The social buttons call Flask endpoints such as `/api/community/posts/<id>/like`, `/comments`, and `/report`.
Those endpoints require the BirdLog Flask backend and a logged-in session. Opening the HTML directly or deploying only the static files to Netlify removes the backend, so the buttons cannot save interactions.

## Recommended deployment
Deploy the **whole project** as a Python web service (Render, Railway, or another Flask host). Do not deploy only `index.html`, `app.js`, and CSS to Netlify.

### Render
This project includes `render.yaml`.
1. Push the project to a private GitHub repository.
2. Create a Render Web Service from that repository.
3. Set `SUPABASE_URL` to your Supabase project URL.
4. Set `SUPABASE_SERVICE_ROLE_KEY` to the service-role key (server-side only).
5. Set a strong `ADMIN_PASSWORD`.
6. Deploy.
7. Open the generated HTTPS URL and use the normal login.
8. Admin is available separately at `/admin`.

The same-origin API means Like, Comment, Share and Report use the Flask backend automatically.

## Local test
```bash
pip install -r requirements.txt
python app.py
```
Open `http://localhost:5000`.

## Social features
- Like toggles and stores a like per user/post.
- Comments are stored and displayed per post.
- Share uses the browser Share API or copies a link.
- Report stores a moderation report for the admin.
- Notifications are generated for likes/comments/messages.
- Admin can view reports and moderate posts/comments/users.

## Important security
Never put `SUPABASE_SERVICE_ROLE_KEY` into frontend JavaScript. Keep it in the server environment only.
