# -*- coding: utf-8 -*-
"""
Bird Watching Electronic Log (BirdLogApp) - Backend Server (app.py)
Flask REST API server supporting Supabase and SQL (SQLite) backends,
dynamic DB engine switching, data synchronization, photo storage,
observation tracking, species catalog, CSV export, and analytics.
"""

import os
import sys
import csv
import base64
import binascii
import sqlite3
import uuid
import re
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify, send_from_directory, Response, session, redirect
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from functools import wraps

try:
    from supabase import create_client as create_supabase_client
except ImportError:  # pragma: no cover
    create_supabase_client = None

# Reconfigure stdout for UTF-8 on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Load .env BEFORE reading Supabase settings. This is important because
# the credentials are normally stored in the project's .env file.
try:
    from dotenv import load_dotenv  # type: ignore
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(BASE_DIR, '.env'), override=False)
except Exception:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

from database import DatabaseManager

# --------------------------------------------------------------
# App Configuration & Directories
# --------------------------------------------------------------
# Accept both the documented BIRDLOG_DATA_DIR and the common Render variable DATA_DIR.
DATA_DIR = (os.environ.get('BIRDLOG_DATA_DIR') or os.environ.get('DATA_DIR') or os.path.join(BASE_DIR, 'data')).strip()
# SQLite cannot create its parent directory automatically. Create it before any
# import-time init_users_db()/init_social_db() calls below.
os.makedirs(DATA_DIR, exist_ok=True)
PRIMARY_IMG_DIR = os.path.join(DATA_DIR, 'saved_images')
FALLBACK_IMG_DIR = os.path.join(os.path.expanduser('~'), 'birdlog_images')
# Legacy image folder used by older BirdLog builds. Keep it readable so old
# observations continue to display after upgrading/deploying this version.
LEGACY_IMG_DIR = os.path.join(BASE_DIR, 'saved_images')
METADATA_CSV = os.path.join(DATA_DIR, 'observations_log.csv')

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').strip()
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', os.environ.get('SUPABASE_KEY', '')).strip()
SUPABASE_STORAGE_BUCKET = os.environ.get('SUPABASE_STORAGE_BUCKET', 'bird-images').strip() or 'bird-images'
DEFAULT_DB_ENGINE = os.environ.get(
    'DB_TYPE',
    'supabase' if SUPABASE_URL and SUPABASE_KEY else 'sql'
).lower()

CSV_HEADERS = [
    'filename', 'saved_at', 'bird_name', 'species',
    'obs_date', 'state', 'district', 'location',
    'weather', 'notes'
]

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.secret_key = os.environ.get('SECRET_KEY', 'birdlog-local-secret-change-me')
# Keep normal-user sessions across browser refreshes and server/project restarts.
# The session is still cleared explicitly by Logout/Switch Account.
app.permanent_session_lifetime = timedelta(days=30)
FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', '').strip().rstrip('/')
SESSION_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'None' if FRONTEND_ORIGIN else 'Lax')
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE=SESSION_SAMESITE,
    SESSION_COOKIE_SECURE=os.environ.get('SESSION_COOKIE_SECURE', 'true' if FRONTEND_ORIGIN else 'false').lower() == 'true',
    SESSION_COOKIE_PATH='/'
)
CORS(app, origins=[FRONTEND_ORIGIN] if FRONTEND_ORIGIN else '*', supports_credentials=True, allow_headers=['Content-Type'], methods=['GET','POST','PUT','DELETE','OPTIONS'])

ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin').strip()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')


def upload_photo_to_supabase_storage(img_bytes: bytes, filename: str, content_type: str = 'image/jpeg'):
    """Upload a photo to the configured public Supabase Storage bucket.

    Returns the public URL on success, otherwise an empty string. The storage
    bucket is intentionally configurable but defaults to the bucket the user
    created: bird-images.
    """
    if not (SUPABASE_URL and SUPABASE_KEY and create_supabase_client):
        return ''
    try:
        project_url = SUPABASE_URL.rstrip('/')
        for suffix in ('/rest/v1', '/rest/v1/'):
            if project_url.lower().endswith(suffix):
                project_url = project_url[:-len(suffix)].rstrip('/')
                break
        client = create_supabase_client(project_url, SUPABASE_KEY)
        storage_path = f"observations/{datetime.now(timezone.utc).strftime('%Y/%m')}/{filename}"
        options = {
            'content-type': content_type,
            'upsert': 'false',
            'cache-control': '31536000'
        }
        client.storage.from_(SUPABASE_STORAGE_BUCKET).upload(storage_path, img_bytes, options)
        return client.storage.from_(SUPABASE_STORAGE_BUCKET).get_public_url(storage_path)
    except Exception as exc:
        print(f'[BirdLog] Supabase Storage upload warning: {exc}')
        return ''


# --------------------------------------------------------------
# Normal User Authentication (separate from Admin)
# --------------------------------------------------------------
USERS_DB = os.path.join(DATA_DIR, 'users.db')


def init_social_db():
    # Social/community tables live in the separate user database.
    with sqlite3.connect(USERS_DB) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS community_posts (id TEXT PRIMARY KEY, observation_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, caption TEXT DEFAULT '', hashtags TEXT DEFAULT '', created_at TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, bird_name TEXT DEFAULT '', species TEXT DEFAULT '', location TEXT DEFAULT '', state TEXT DEFAULT '', district TEXT DEFAULT '', weather TEXT DEFAULT '', photo_url TEXT DEFAULT '', saved_at TEXT DEFAULT '')""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_likes (post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (post_id, user_id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_saves (post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (post_id, user_id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_follows (follower_id TEXT NOT NULL, following_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (follower_id, following_id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_reports (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, event_type TEXT NOT NULL, post_id TEXT, text TEXT NOT NULL, created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS community_messages (id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0)""")
        conn.execute("""INSERT OR IGNORE INTO users (id, full_name, username, email, password_hash, created_at) VALUES ('system_birdlog','BirdLog Community','birdlog_community','system@birdlog.local','SYSTEM_ONLY',?)""", (datetime.now(timezone.utc).isoformat(),))
        conn.commit()


def init_users_db():
    with sqlite3.connect(USERS_DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            )
        """)
        # Upgrade older users.db files without losing existing accounts.
        cols = {row[1] for row in conn.execute('PRAGMA table_info(users)').fetchall()}
        if 'is_active' not in cols:
            conn.execute('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')
        conn.commit()


def get_user_by_email(email: str):
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            'SELECT id, full_name, username, email, created_at, is_active FROM users WHERE email = ? COLLATE NOCASE',
            (email,)
        ).fetchone()
        return dict(row) if row else None


def get_user_auth_by_email(email: str):
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            'SELECT * FROM users WHERE email = ? COLLATE NOCASE',
            (email,)
        ).fetchone()
        return dict(row) if row else None


def get_user_auth_by_id(user_id: str):
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str):
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            'SELECT id, full_name, username, email, created_at, is_active FROM users WHERE id = ?',
            (user_id,)
        ).fetchone()
        return dict(row) if row else None


def username_exists(username: str) -> bool:
    with sqlite3.connect(USERS_DB) as conn:
        return conn.execute(
            'SELECT 1 FROM users WHERE username = ? COLLATE NOCASE LIMIT 1',
            (username,)
        ).fetchone() is not None


def email_exists(email: str) -> bool:
    with sqlite3.connect(USERS_DB) as conn:
        return conn.execute(
            'SELECT 1 FROM users WHERE email = ? COLLATE NOCASE LIMIT 1',
            (email,)
        ).fetchone() is not None


def make_session_persistent():
    # Flask stores this in the signed session cookie. With a stable SECRET_KEY,
    # the cookie survives page refreshes and restarting the local server.
    session.permanent = True

def user_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'User authentication required.', 'login_required': True}), 401
        user = get_user_auth_by_id(session.get('user_id'))
        if not user or not bool(user.get('is_active', 1)):
            session.clear()
            return jsonify({'error': 'Your account has been disabled by the administrator.', 'login_required': True}), 403
        return fn(*args, **kwargs)
    return wrapped


init_users_db()
init_social_db()

def community_action_required(fn):
    """Require an active normal-user session for community interactions.

    This guard is intentionally separate from admin_required: normal users are
    allowed to Like, Comment, Share (client-side), and Report posts, while
    administrative moderation remains protected by admin_required.
    """
    return user_required(fn)


def admin_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'error': 'Admin authentication required.'}), 401
        return fn(*args, **kwargs)
    return wrapped


def ensure_dir(path: str) -> bool:
    """Create directory if it doesn't exist."""
    try:
        os.makedirs(path, exist_ok=True)
        return True
    except OSError as exc:
        print(f"[BirdLog] Cannot create directory {path}: {exc}")
        return False

# Ensure persistent application directories exist. On Render, BIRDLOG_DATA_DIR
# points to the persistent disk rather than the source-code directory.
ensure_dir(DATA_DIR)
ensure_dir(PRIMARY_IMG_DIR)
# Migrate bundled/legacy photos into the persistent image directory once.
# Existing files are never overwritten. This keeps old uploaded pictures
# visible after moving from the old folder layout to Render's persistent disk.
try:
    if os.path.isdir(LEGACY_IMG_DIR) and os.path.abspath(LEGACY_IMG_DIR) != os.path.abspath(PRIMARY_IMG_DIR):
        for _name in os.listdir(LEGACY_IMG_DIR):
            _src = os.path.join(LEGACY_IMG_DIR, _name)
            _dst = os.path.join(PRIMARY_IMG_DIR, _name)
            if os.path.isfile(_src) and not os.path.exists(_dst):
                try:
                    import shutil
                    shutil.copy2(_src, _dst)
                except OSError as _exc:
                    print(f'[BirdLog] Legacy image migration warning: {_exc}')
except OSError as _exc:
    print(f'[BirdLog] Legacy image folder warning: {_exc}')

# Initialize Database Manager (SQLite + Supabase)
db_manager = DatabaseManager(
    db_dir=DATA_DIR,
    supabase_url=SUPABASE_URL,
    supabase_key=SUPABASE_KEY,
    default_engine=DEFAULT_DB_ENGINE
)

def get_iso_now() -> str:
    """Get current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()

def detect_image_format(data_url: str) -> tuple:
    if data_url.startswith('data:image/'):
        header = data_url.split(';')[0]
        mime = header.split(':')[1]
        ext = mime.split('/')[1]
        ext = 'jpg' if ext == 'jpeg' else ext
        return mime, ext
    return 'image/jpeg', 'jpg'

def decode_image(data_url: str) -> bytes:
    if ',' in data_url:
        _, encoded = data_url.split(',', 1)
    else:
        encoded = data_url
    return base64.b64decode(encoded)

def write_metadata_csv(row: dict):
    """Append observation metadata to CSV file."""
    file_exists = os.path.isfile(METADATA_CSV)
    try:
        with open(METADATA_CSV, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
            if not file_exists:
                writer.writeheader()
            writer.writerow({k: row.get(k, '') for k in CSV_HEADERS})
    except OSError as exc:
        print(f"[BirdLog] CSV write error: {exc}")


# --------------------------------------------------------------
# Bird Community helpers
# --------------------------------------------------------------
def make_hashtags(bird_name: str, species: str, location: str = '') -> str:
    raw = [bird_name, species, location]
    tags = []
    for value in raw:
        words = re.findall(r'[A-Za-z0-9]+', value or '')
        if words:
            tags.append('#' + ''.join(words[:4]))
    tags.extend(['#BirdWatching', '#BirdLog'])
    return ' '.join(dict.fromkeys(tags))


def community_user(user_id):
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute('SELECT id, full_name, username, email, created_at, is_active FROM users WHERE id = ?', (user_id,)).fetchone()
        return dict(row) if row else {'id': user_id, 'full_name': 'Bird Watcher', 'username': 'birdwatcher'}


def ensure_community_posts_for_observations():
    # Create social posts for existing observations that predate the community feature.
    records = db_manager.get_observations()
    with sqlite3.connect(USERS_DB) as conn:
        existing = {r[0] for r in conn.execute('SELECT observation_id FROM community_posts').fetchall()}
        for obs in records:
            if obs.get('id') in existing:
                continue
            photo = str(obs.get('photo_url') or '').strip()
            # Community posts must come from an actual saved camera capture.
            # Never create posts from demo/default external images.
            if not photo.startswith('/saved_images/'):
                continue
            post_id = f'post_{uuid.uuid4().hex[:12]}'
            caption = obs.get('notes') or f"Spotted {obs.get('bird_name', 'a bird')} at {obs.get('location') or 'the field'}."
            tags = make_hashtags(obs.get('bird_name',''), obs.get('species',''), obs.get('location',''))
            conn.execute('INSERT OR IGNORE INTO community_posts (id, observation_id, user_id, caption, hashtags, created_at, bird_name, species, location, state, district, weather, photo_url, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (post_id, obs.get('id'), 'system_birdlog', caption, tags, obs.get('saved_at') or get_iso_now(), obs.get('bird_name',''), obs.get('species',''), obs.get('location',''), obs.get('state',''), obs.get('district',''), obs.get('weather',''), obs.get('photo_url',''), obs.get('saved_at','')))
        conn.commit()


def normalize_photo_url(photo_url: str) -> str:
    """Return a browser-safe photo URL. Local files become absolute backend URLs
    so they still load when the frontend is hosted on a different domain."""
    value = str(photo_url or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://', 'data:image/')):
        return value
    if value.startswith('/saved_images/') or value.startswith('/static/'):
        path = value
    else:
        # Old records may contain a filesystem path or just a filename.
        base = os.path.basename(value.replace('\\', '/'))
        if base and os.path.exists(os.path.join(PRIMARY_IMG_DIR, base)):
            path = f'/saved_images/{base}'
        elif base and os.path.exists(os.path.join(FALLBACK_IMG_DIR, base)):
            path = f'/saved_images/{base}'
        elif base and os.path.exists(os.path.join(LEGACY_IMG_DIR, base)):
            path = f'/saved_images/{base}'
        else:
            # Keep an already absolute URL/path intact. For an unknown local
            # path, returning it would produce a broken browser URL, so use an
            # empty value and let the frontend's image fallback handle it.
            return value if value.startswith(('http://', 'https://', 'data:image/')) else ''
    # request.host_url is the Flask backend origin, not the Netlify frontend.
    try:
        return request.host_url.rstrip('/') + path
    except RuntimeError:
        return path


def community_post_row(row, current_user_id):
    post_id = row['post_id']
    author = {'id': row['author_id'], 'full_name': row['full_name'] or 'Bird Watcher', 'username': row['username'] or 'birdwatcher'}
    with sqlite3.connect(USERS_DB) as conn:
        likes = conn.execute('SELECT COUNT(*) FROM community_likes WHERE post_id = ?', (post_id,)).fetchone()[0]
        comments = conn.execute('SELECT COUNT(*) FROM community_comments WHERE post_id = ?', (post_id,)).fetchone()[0]
        liked = conn.execute('SELECT 1 FROM community_likes WHERE post_id = ? AND user_id = ?', (post_id, current_user_id)).fetchone() is not None
    return {
        'id': post_id,
        'observation_id': row['observation_id'],
        'bird_name': row['bird_name'], 'species': row['species'], 'location': row['location'],
        'state': row['state'], 'district': row['district'], 'weather': row['weather'],
        'photo_url': normalize_photo_url(row['photo_url']), 'caption': row['caption'], 'hashtags': row['hashtags'],
        'created_at': row['created_at'], 'saved_at': row['saved_at'],
        'author': author, 'like_count': likes, 'comment_count': comments,
        'liked': liked,
    }

# --------------------------------------------------------------
# Normal User Authentication & User Pages
# --------------------------------------------------------------

@app.route('/login')
def login_page():
    if session.get('user_id'):
        return redirect('/app')
    return send_from_directory(BASE_DIR, 'login.html')


@app.route('/signup')
def signup_page():
    if session.get('user_id'):
        return redirect('/app')
    return send_from_directory(BASE_DIR, 'signup.html')


@app.route('/app')
@user_required
def user_app_page():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/api/user/signup', methods=['POST'])
def user_signup():
    data = request.get_json(silent=True) or {}
    full_name = str(data.get('full_name', '')).strip()
    username = str(data.get('username', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    confirm = str(data.get('confirm_password', ''))

    if not full_name or not username or not email or not password or not confirm:
        return jsonify({'error': 'Please fill in all required fields.'}), 400
    if len(full_name) < 2:
        return jsonify({'error': 'Full name is too short.'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must contain at least 3 characters.'}), 400
    if '@' not in email or '.' not in email.split('@')[-1]:
        return jsonify({'error': 'Enter a valid email address.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must contain at least 6 characters.'}), 400
    if password != confirm:
        return jsonify({'error': 'Passwords do not match.'}), 400
    if username_exists(username):
        return jsonify({'error': 'Username is already in use.'}), 409
    if email_exists(email):
        return jsonify({'error': 'An account already exists for this email.'}), 409

    user_id = f'user_{uuid.uuid4().hex[:12]}'
    created_at = get_iso_now()
    with sqlite3.connect(USERS_DB) as conn:
        conn.execute(
            'INSERT INTO users (id, full_name, username, email, password_hash, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
            (user_id, full_name, username, email, generate_password_hash(password), created_at)
        )
        conn.commit()

    session.clear()
    session['user_id'] = user_id
    session['username'] = username
    make_session_persistent()
    return jsonify({'message': 'Account created successfully.', 'user': get_user_by_id(user_id)}), 201


def make_auto_username(email: str) -> str:
    """Create a unique username for a first-time login account."""
    local_part = email.split('@', 1)[0].strip().lower()
    base = re.sub(r'[^a-z0-9_]+', '', local_part) or 'birdwatcher'
    base = base[:24]
    username = base
    counter = 1
    while username_exists(username):
        suffix = str(counter)
        username = f"{base[:24-len(suffix)]}{suffix}"
        counter += 1
    return username


@app.route('/api/user/login', methods=['POST'])
def user_login():
    """Normal-user login.

    On the first login, an account is automatically created from the supplied
    email and password. On later logins, the same email must be paired with
    the original password. Admin authentication remains completely separate
    under /api/admin/* and /admin.
    """
    data = request.get_json(silent=True) or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400
    if '@' not in email or '.' not in email.rsplit('@', 1)[-1]:
        return jsonify({'error': 'Enter a valid email address.'}), 400

    row = get_user_auth_by_email(email)

    # First-time normal user: create an account automatically.
    # IMPORTANT: there is no fixed/default normal-user email or password.
    # Whatever valid email + non-empty password the user chooses becomes
    # that user's credentials. On later logins, the same password is required.
    if not row:
        user_id = f'user_{uuid.uuid4().hex[:12]}'
        username = make_auto_username(email)
        full_name = email.split('@', 1)[0].strip() or 'Bird Watcher'
        created_at = get_iso_now()
        with sqlite3.connect(USERS_DB) as conn:
            conn.execute(
                'INSERT INTO users (id, full_name, username, email, password_hash, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
                (user_id, full_name, username, email, generate_password_hash(password), created_at)
            )
            conn.commit()
        session.clear()
        session['user_id'] = user_id
        session['username'] = username
        make_session_persistent()
        return jsonify({
            'message': 'Account created and login successful.',
            'created': True,
            'user': get_user_by_id(user_id)
        }), 201

    # Blocked/deactivated users cannot sign in.
    if not bool(row.get('is_active', 1)):
        return jsonify({'error': 'This account has been disabled by the administrator.'}), 403

    # Existing user: only the original password is accepted.
    if not check_password_hash(row['password_hash'], password):
        return jsonify({'error': 'Incorrect password for this email.'}), 401

    session.clear()
    session['user_id'] = row['id']
    session['username'] = row['username']
    make_session_persistent()
    return jsonify({
        'message': 'Login successful.',
        'created': False,
        'user': get_user_by_id(row['id'])
    }), 200


@app.route('/api/user/me', methods=['GET'])
def user_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False}), 401
    user = get_user_by_id(user_id)
    if not user:
        session.clear()
        return jsonify({'authenticated': False}), 401
    # Refresh the persistent expiry whenever the account is successfully
    # restored after a page reload.
    make_session_persistent()
    session['username'] = user.get('username', '')
    return jsonify({'authenticated': True, 'user': user}), 200


@app.route('/api/user/logout', methods=['POST'])
def user_logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully.'}), 200


@app.route('/api/user/switch', methods=['POST'])
def user_switch_account():
    session.clear()
    return jsonify({'message': 'Account switched. Please sign in again.'}), 200



# Protect the normal application/API without affecting Admin, login, or public assets.
@app.before_request
def require_user_for_normal_app():
    path = request.path
    public_exact = {
        '/', '/login', '/signup', '/health', '/admin', '/admin/', '/admin.html', '/admin-login', '/admin-login.html', '/administrator',
        '/manifest.json', '/sw.js', '/offline.html', '/favicon.ico',
        '/login.css', '/login.js', '/signup.html', '/index.html'
    }
    if path in public_exact:
        if path in {'/', '/index.html'} and session.get('user_id'):
            return redirect('/app')
        if path == '/index.html' and not session.get('user_id'):
            return redirect('/login')
        return None
    if path.startswith('/api/user/') or path.startswith('/api/admin/'):
        return None
    if path.startswith('/saved_images/') or path.startswith('/icons/'):
        return None
    if path in {'/admin.css', '/admin.js'}:
        return None
    # Login assets and normal app files are public; browser access is still useful after login.
    if path in {'/style.css', '/app.js', '/user-session.js'}:
        return None
    if path.startswith('/api/') or path == '/save-image':
        if not session.get('user_id'):
            return jsonify({'error': 'Please sign in first.', 'login_required': True}), 401
    return None

# --------------------------------------------------------------
# Admin Authentication & Administration API
# --------------------------------------------------------------

@app.route('/admin')
@app.route('/admin/')
def admin_page():
    # Explicit admin page route. The /admin/ alias also handles browsers
    # or reverse proxies that normalize the URL with a trailing slash.
    admin_file = os.path.join(BASE_DIR, 'admin.html')
    if not os.path.isfile(admin_file):
        return jsonify({'error': 'admin.html is missing from the application folder.', 'base_dir': BASE_DIR}), 500
    return send_from_directory(BASE_DIR, 'admin.html')

@app.route('/admin.html')
def admin_html_page():
    return send_from_directory(BASE_DIR, 'admin.html')

@app.route('/admin-login')
@app.route('/admin-login/')
def admin_login_page():
    # Dedicated administrator entry point. This page is independent of normal-user login.
    return send_from_directory(BASE_DIR, 'admin.html')

@app.route('/admin-login.html')
def admin_login_html_page():
    return send_from_directory(BASE_DIR, 'admin.html')

@app.route('/administrator')
def administrator_page():
    return send_from_directory(BASE_DIR, 'admin.html')

@app.route('/health')
def health_check():
    return jsonify({'ok': True, 'admin_route': '/admin', 'base_dir': BASE_DIR}), 200

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return jsonify({'error': 'Invalid admin username or password.'}), 401
    # Keep a normal-user session intact: administrator access is a separate
    # role/page and must not log the normal user out of the same browser.
    session['is_admin'] = True
    session['admin_username'] = ADMIN_USERNAME
    return jsonify({'message': 'Admin login successful.', 'username': ADMIN_USERNAME}), 200

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    # Only end administrator mode; do not destroy the normal-user session.
    session.pop('is_admin', None)
    session.pop('admin_username', None)
    return jsonify({'message': 'Admin logged out.'}), 200

@app.route('/api/admin/me', methods=['GET'])
def admin_me():
    if not session.get('is_admin'):
        return jsonify({'authenticated': False}), 401
    return jsonify({'authenticated': True, 'username': session.get('admin_username', ADMIN_USERNAME)}), 200

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    return jsonify(db_manager.get_stats()), 200

@app.route('/api/admin/observations', methods=['GET'])
@admin_required
def admin_observations():
    return jsonify({'observations': db_manager.get_observations()}), 200

@app.route('/api/admin/observations/<obs_id>', methods=['PUT'])
@admin_required
def admin_update_observation(obs_id):
    data = request.get_json(silent=True) or {}
    obs = db_manager.get_observation(obs_id)
    if not obs:
        return jsonify({'error': 'Observation record not found.'}), 404
    current_user_id = session.get('user_id')
    # Keep the response safe even if this route is reached without a user session.
    normalized_bird = normalize_bird_name(bird_name)
    existing_user_ids = set()
    if current_user_id:
        with sqlite3.connect(USERS_DB) as conn:
            owned = conn.execute(
                'SELECT 1 FROM community_posts WHERE observation_id = ? AND user_id = ?',
                (obs_id, current_user_id)
            ).fetchone()
        if not owned:
            return jsonify({'error': 'You can only edit your own sightings.'}), 403

    fields = ['bird_name', 'species', 'obs_date', 'state', 'district', 'location', 'weather', 'notes', 'photo_url']
    for key in fields:
        if key in data and data[key] is not None:
            obs[key] = data[key]
    db_manager.save_observation(obs)
    return jsonify({'message': 'Observation updated by admin.', 'observation': obs}), 200

@app.route('/api/admin/observations/<obs_id>', methods=['DELETE'])
@admin_required
def admin_delete_observation(obs_id):
    obs = db_manager.get_observation(obs_id)
    if not obs:
        return jsonify({'error':'Observation record not found.'}),404
    db_manager.delete_observation(obs_id)
    # Also remove the corresponding community post and its interactions so
    # an admin deletion cannot leave a stale post in the public feed.
    with sqlite3.connect(USERS_DB) as conn:
        post_rows = conn.execute('SELECT id FROM community_posts WHERE observation_id=?',(obs_id,)).fetchall()
        for row in post_rows:
            pid=row[0]
            conn.execute('DELETE FROM community_likes WHERE post_id=?',(pid,))
            conn.execute('DELETE FROM community_saves WHERE post_id=?',(pid,))
            conn.execute('DELETE FROM community_comments WHERE post_id=?',(pid,))
            conn.execute('DELETE FROM community_reports WHERE post_id=?',(pid,))
            conn.execute('DELETE FROM community_notifications WHERE post_id=?',(pid,))
            conn.execute('DELETE FROM community_posts WHERE id=?',(pid,))
        conn.commit()
    return jsonify({'message': 'Observation and linked community post deleted by admin.'}), 200

@app.route('/api/admin/species', methods=['GET'])
@admin_required
def admin_species():
    return jsonify({'species': db_manager.get_species()}), 200

@app.route('/api/admin/species', methods=['POST'])
@admin_required
def admin_add_species():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()
    category = str(data.get('category', 'General')).strip() or 'General'
    if not name:
        return jsonify({'error': 'Species name is required.'}), 400
    import uuid
    sp = {'id': data.get('id') or f'sp_{uuid.uuid4().hex[:10]}', 'name': name, 'category': category}
    db_manager.add_species(sp)
    return jsonify({'message': 'Species added by admin.', 'species': sp}), 201

@app.route('/api/admin/species/<species_id>', methods=['DELETE'])
@admin_required
def admin_delete_species(species_id):
    try:
        db_manager.delete_species(species_id)
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'message': 'Species deleted by admin.'}), 200

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_users():
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT u.id, u.full_name, u.username, u.email, u.created_at, u.is_active,
                   (SELECT COUNT(*) FROM community_posts p WHERE p.user_id=u.id) AS post_count,
                   (SELECT COUNT(*) FROM community_reports r WHERE r.user_id=u.id) AS report_count
            FROM users u
            WHERE u.id <> 'system_birdlog'
            ORDER BY u.created_at DESC
        ''').fetchall()
    return jsonify({'users':[dict(r) for r in rows]}), 200


@app.route('/api/admin/users/<user_id>/status', methods=['POST'])
@admin_required
def admin_user_status(user_id):
    if user_id == 'system_birdlog':
        return jsonify({'error':'The system account cannot be changed.'}), 400
    data = request.get_json(silent=True) or {}
    active = bool(data.get('active', True))
    with sqlite3.connect(USERS_DB) as conn:
        exists = conn.execute('SELECT 1 FROM users WHERE id=?', (user_id,)).fetchone()
        if not exists:
            return jsonify({'error':'User not found.'}), 404
        conn.execute('UPDATE users SET is_active=? WHERE id=?', (1 if active else 0, user_id))
        conn.commit()
    return jsonify({'message':'User enabled.' if active else 'User disabled.', 'active':active}), 200


@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    if user_id == 'system_birdlog':
        return jsonify({'error':'The system account cannot be deleted.'}), 400
    with sqlite3.connect(USERS_DB) as conn:
        exists = conn.execute('SELECT 1 FROM users WHERE id=?', (user_id,)).fetchone()
        if not exists:
            return jsonify({'error':'User not found.'}), 404
        # Remove social activity owned by the account first.
        post_rows = conn.execute('SELECT id FROM community_posts WHERE user_id=?', (user_id,)).fetchall()
        post_ids = [r[0] for r in post_rows]
        for pid in post_ids:
            conn.execute('DELETE FROM community_likes WHERE post_id=?', (pid,))
            conn.execute('DELETE FROM community_saves WHERE post_id=?', (pid,))
            conn.execute('DELETE FROM community_comments WHERE post_id=?', (pid,))
            conn.execute('DELETE FROM community_reports WHERE post_id=?', (pid,))
            conn.execute('DELETE FROM community_notifications WHERE post_id=?', (pid,))
        conn.execute('DELETE FROM community_posts WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM community_comments WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM community_likes WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM community_saves WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM community_follows WHERE follower_id=? OR following_id=?', (user_id, user_id))
        conn.execute('DELETE FROM community_reports WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM community_notifications WHERE user_id=? OR actor_user_id=?', (user_id, user_id))
        conn.execute('DELETE FROM community_messages WHERE sender_id=? OR recipient_id=?', (user_id, user_id))
        conn.execute('DELETE FROM users WHERE id=?', (user_id,))
        conn.commit()
    return jsonify({'message':'User and community data deleted.'}), 200


@app.route('/api/admin/reports', methods=['GET'])
@admin_required
def admin_reports():
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT r.id, r.post_id, r.user_id, r.reason, r.created_at,
                   reporter.username AS reporter_username,
                   p.bird_name, p.species, p.photo_url, p.hidden,
                   owner.username AS owner_username
            FROM community_reports r
            LEFT JOIN users reporter ON reporter.id=r.user_id
            LEFT JOIN community_posts p ON p.id=r.post_id
            LEFT JOIN users owner ON owner.id=p.user_id
            ORDER BY r.created_at DESC
        ''').fetchall()
    return jsonify({'reports':[dict(r) for r in rows]}), 200


@app.route('/api/admin/reports/<report_id>', methods=['DELETE'])
@admin_required
def admin_delete_report(report_id):
    with sqlite3.connect(USERS_DB) as conn:
        conn.execute('DELETE FROM community_reports WHERE id=?', (report_id,))
        conn.commit()
    return jsonify({'message':'Report dismissed.'}), 200


@app.route('/api/admin/posts', methods=['GET'])
@admin_required
def admin_posts():
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT p.id, p.bird_name, p.species, p.location, p.state, p.district, p.created_at, p.hidden, p.photo_url,
                   u.username, u.full_name,
                   (SELECT COUNT(*) FROM community_reports r WHERE r.post_id=p.id) AS report_count,
                   (SELECT COUNT(*) FROM community_comments c WHERE c.post_id=p.id) AS comment_count
            FROM community_posts p LEFT JOIN users u ON u.id=p.user_id
            ORDER BY p.created_at DESC
            LIMIT 200
        ''').fetchall()
    return jsonify({'posts':[dict(r) for r in rows]}), 200


@app.route('/api/admin/posts/<post_id>/visibility', methods=['POST'])
@admin_required
def admin_post_visibility(post_id):
    data=request.get_json(silent=True) or {}
    hidden=bool(data.get('hidden', True))
    with sqlite3.connect(USERS_DB) as conn:
        exists=conn.execute('SELECT 1 FROM community_posts WHERE id=?',(post_id,)).fetchone()
        if not exists:
            return jsonify({'error':'Post not found.'}),404
        conn.execute('UPDATE community_posts SET hidden=? WHERE id=?',(1 if hidden else 0,post_id))
        conn.commit()
    return jsonify({'message':'Post hidden.' if hidden else 'Post restored.','hidden':hidden}),200


@app.route('/api/admin/posts/<post_id>', methods=['DELETE'])
@admin_required
def admin_delete_post(post_id):
    with sqlite3.connect(USERS_DB) as conn:
        exists=conn.execute('SELECT 1 FROM community_posts WHERE id=?',(post_id,)).fetchone()
        if not exists:
            return jsonify({'error':'Post not found.'}),404
        conn.execute('DELETE FROM community_likes WHERE post_id=?',(post_id,))
        conn.execute('DELETE FROM community_saves WHERE post_id=?',(post_id,))
        conn.execute('DELETE FROM community_comments WHERE post_id=?',(post_id,))
        conn.execute('DELETE FROM community_reports WHERE post_id=?',(post_id,))
        conn.execute('DELETE FROM community_notifications WHERE post_id=?',(post_id,))
        conn.execute('DELETE FROM community_posts WHERE id=?',(post_id,))
        conn.commit()
    return jsonify({'message':'Post deleted permanently.'}),200


@app.route('/api/admin/comments/<comment_id>', methods=['DELETE'])
@admin_required
def admin_delete_comment(comment_id):
    with sqlite3.connect(USERS_DB) as conn:
        conn.execute('DELETE FROM community_comments WHERE id=?',(comment_id,))
        conn.commit()
    return jsonify({'message':'Comment deleted.'}),200


@app.route('/api/admin/db/status', methods=['GET'])
@admin_required
def admin_db_status():
    return jsonify(db_manager.get_status()), 200

@app.route('/api/admin/db/switch', methods=['POST'])
@admin_required
def admin_switch_db():
    data = request.get_json(silent=True) or {}
    success, message = db_manager.switch_engine(data.get('engine', ''))
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'message': message, 'status': db_manager.get_status()}), 200

@app.route('/api/admin/db/sync', methods=['POST'])
@admin_required
def admin_sync_db():
    success, message = db_manager.sync_databases()
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'message': message, 'status': db_manager.get_status()}), 200

@app.route('/api/admin/db/supabase-init', methods=['POST'])
@admin_required
def admin_supabase_init():
    success, message = db_manager.seed_supabase_if_empty()
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'message': message, 'status': db_manager.get_status()}), 200

# --------------------------------------------------------------
# Database Management API Endpoints
# --------------------------------------------------------------

@app.route('/api/db/status', methods=['GET'])
def get_db_status():
    """Return health status for SQLite and Supabase."""
    return jsonify(db_manager.get_status()), 200


@app.route('/api/db/switch', methods=['POST'])
def switch_db_engine():
    """Switch active database engine between SQLite and Supabase."""
    data = request.get_json(silent=True) or {}
    engine = data.get('engine', '').lower()
    success, message = db_manager.switch_engine(engine)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'message': message, 'status': db_manager.get_status()}), 200


@app.route('/api/db/sync', methods=['POST'])
def sync_databases():
    """Synchronize observations and species between SQLite and Supabase."""
    success, message = db_manager.sync_databases()
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'message': message, 'status': db_manager.get_status()}), 200


@app.route('/api/db/supabase-init', methods=['POST'])
def initialize_supabase():
    """Seed Supabase from local SQLite when the hosted database is empty."""
    success, message = db_manager.seed_supabase_if_empty()
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'message': message, 'status': db_manager.get_status()}), 200

# --------------------------------------------------------------
# Bird Community API
# --------------------------------------------------------------
@app.route('/api/community/posts', methods=['GET'])
@user_required
def community_posts():
    ensure_community_posts_for_observations()
    q = request.args.get('search', '').strip().lower()
    current_user_id = session.get('user_id')
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT p.id AS post_id, p.observation_id, p.user_id AS author_id, p.caption, p.hashtags,
                   p.created_at, p.saved_at, p.bird_name, p.species, p.location, p.state, p.district,
                   p.weather, p.photo_url, u.full_name, u.username
            FROM community_posts p
            LEFT JOIN users u ON u.id = p.user_id
            WHERE p.hidden = 0
              AND TRIM(COALESCE(p.photo_url, '')) <> ''
              AND (
                    p.photo_url LIKE '/saved_images/%'
                    OR p.photo_url LIKE 'http://%'
                    OR p.photo_url LIKE 'https://%'
                    OR p.photo_url LIKE 'data:image/%'
                  )
            ORDER BY p.created_at DESC
        ''').fetchall()
    posts = []
    for row in rows:
        r = dict(row)
        hay = ' '.join(str(r.get(k) or '') for k in ['bird_name','species','location','state','district','caption','hashtags','full_name','username']).lower()
        if q and q not in hay:
            continue
        posts.append(community_post_row(r, current_user_id))
    return jsonify({'posts': posts, 'current_user_id': current_user_id}), 200


@app.route('/api/community/posts/<post_id>/like', methods=['POST'])
@community_action_required
def community_like(post_id):
    uid = session['user_id']
    with sqlite3.connect(USERS_DB) as conn:
        exists = conn.execute('SELECT 1 FROM community_likes WHERE post_id = ? AND user_id = ?', (post_id, uid)).fetchone()
        if exists:
            conn.execute('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?', (post_id, uid))
            liked = False
        else:
            post_exists = conn.execute('SELECT 1 FROM community_posts WHERE id = ? AND hidden = 0', (post_id,)).fetchone()
            if not post_exists:
                return jsonify({'error': 'Post not found.'}), 404
            conn.execute('INSERT INTO community_likes (post_id, user_id, created_at) VALUES (?, ?, ?)', (post_id, uid, get_iso_now()))
            liked = True
            row = conn.execute('SELECT user_id FROM community_posts WHERE id = ?', (post_id,)).fetchone()
            if row and row[0] != uid:
                conn.execute('INSERT INTO community_notifications (id,user_id,actor_user_id,event_type,post_id,text,created_at) VALUES (?,?,?,?,?,?,?)',
                             (f'nt_{uuid.uuid4().hex[:10]}', row[0], uid, 'like', post_id, 'liked your bird post', get_iso_now()))
        count = conn.execute('SELECT COUNT(*) FROM community_likes WHERE post_id = ?', (post_id,)).fetchone()[0]
        conn.commit()
    return jsonify({'liked': liked, 'like_count': count}), 200


@app.route('/api/community/posts/<post_id>/comments', methods=['GET', 'POST'])
@community_action_required
def community_comments(post_id):
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        if request.method == 'POST':
            post_exists = conn.execute('SELECT 1 FROM community_posts WHERE id = ? AND hidden = 0', (post_id,)).fetchone()
            if not post_exists:
                return jsonify({'error': 'Post not found.'}), 404
            data = request.get_json(silent=True) or {}
            comment = str(data.get('comment','')).strip()[:500]
            if not comment:
                return jsonify({'error':'Comment cannot be empty.'}), 400
            cid = f'c_{uuid.uuid4().hex[:12]}'
            conn.execute('INSERT INTO community_comments (id,post_id,user_id,comment,created_at) VALUES (?,?,?,?,?)',
                         (cid, post_id, session['user_id'], comment, get_iso_now()))
            row = conn.execute('SELECT user_id FROM community_posts WHERE id = ?', (post_id,)).fetchone()
            if row and row[0] != session['user_id']:
                conn.execute('INSERT INTO community_notifications (id,user_id,actor_user_id,event_type,post_id,text,created_at) VALUES (?,?,?,?,?,?,?)',
                             (f'nt_{uuid.uuid4().hex[:10]}', row[0], session['user_id'], 'comment', post_id, 'commented on your bird post', get_iso_now()))
            conn.commit()
            return jsonify({'message':'Comment added.'}), 201
        rows = conn.execute('''
            SELECT c.comment, c.created_at, u.id AS user_id, u.full_name, u.username
            FROM community_comments c LEFT JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ? ORDER BY c.created_at ASC
        ''', (post_id,)).fetchall()
    return jsonify({'comments':[dict(r) for r in rows]}), 200


@app.route('/api/community/posts/<post_id>/save', methods=['POST'])
@user_required
def community_save(post_id):
    uid=session['user_id']
    with sqlite3.connect(USERS_DB) as conn:
        exists=conn.execute('SELECT 1 FROM community_saves WHERE post_id=? AND user_id=?',(post_id,uid)).fetchone()
        if exists:
            conn.execute('DELETE FROM community_saves WHERE post_id=? AND user_id=?',(post_id,uid)); saved=False
        else:
            conn.execute('INSERT INTO community_saves (post_id,user_id,created_at) VALUES (?,?,?)',(post_id,uid,get_iso_now())); saved=True
        conn.commit()
    return jsonify({'saved':saved}),200


@app.route('/api/community/users/<user_id>/follow', methods=['POST'])
@user_required
def community_follow(user_id):
    uid=session['user_id']
    if uid == user_id:
        return jsonify({'error':'You cannot follow your own profile.'}),400
    with sqlite3.connect(USERS_DB) as conn:
        exists=conn.execute('SELECT 1 FROM community_follows WHERE follower_id=? AND following_id=?',(uid,user_id)).fetchone()
        if exists:
            conn.execute('DELETE FROM community_follows WHERE follower_id=? AND following_id=?',(uid,user_id)); following=False
        else:
            conn.execute('INSERT INTO community_follows (follower_id,following_id,created_at) VALUES (?,?,?)',(uid,user_id,get_iso_now())); following=True
            conn.execute('INSERT INTO community_notifications (id,user_id,actor_user_id,event_type,post_id,text,created_at) VALUES (?,?,?,?,?,?,?)',
                         (f'nt_{uuid.uuid4().hex[:10]}', user_id, uid, 'follow', None, 'started following you', get_iso_now()))
        conn.commit()
    return jsonify({'following':following}),200


@app.route('/api/community/users/<user_id>', methods=['GET'])
@user_required
def community_profile(user_id):
    user = community_user(user_id)
    with sqlite3.connect(USERS_DB) as conn:
        post_count=conn.execute('SELECT COUNT(*) FROM community_posts WHERE user_id=? AND hidden=0',(user_id,)).fetchone()[0]
    user.update({'post_count':post_count})
    return jsonify({'user':user}),200


@app.route('/api/community/search/users', methods=['GET'])
@user_required
def community_search_users():
    q=request.args.get('q','').strip().lower()
    if not q: return jsonify({'users':[]}),200
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory=sqlite3.Row
        rows=conn.execute('SELECT id,full_name,username FROM users WHERE lower(username) LIKE ? OR lower(full_name) LIKE ? ORDER BY username LIMIT 20',(f'%{q}%',f'%{q}%')).fetchall()
    return jsonify({'users':[dict(r) for r in rows]}),200


@app.route('/api/community/posts/<post_id>/report', methods=['POST'])
@community_action_required
def community_report(post_id):
    with sqlite3.connect(USERS_DB) as check_conn:
        if not check_conn.execute('SELECT 1 FROM community_posts WHERE id = ? AND hidden = 0', (post_id,)).fetchone():
            return jsonify({'error':'Post not found.'}),404
    data=request.get_json(silent=True) or {}
    reason=str(data.get('reason','Inappropriate content')).strip()[:200] or 'Inappropriate content'
    with sqlite3.connect(USERS_DB) as conn:
        conn.execute('INSERT INTO community_reports (id,post_id,user_id,reason,created_at) VALUES (?,?,?,?,?)',
                     (f'rep_{uuid.uuid4().hex[:12]}',post_id,session['user_id'],reason,get_iso_now()))
        conn.commit()
    return jsonify({'message':'Report submitted to BirdLog moderation.'}),201


@app.route('/api/community/users/<user_id>/messages', methods=['GET', 'POST'])
@user_required
def community_messages_with_user(user_id):
    uid = session['user_id']
    if user_id == uid:
        return jsonify({'error': 'You cannot message yourself.'}), 400
    target = community_user(user_id)
    if not target or target.get('id') == 'system_birdlog':
        return jsonify({'error': 'That profile is unavailable for messages.'}), 404

    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        if request.method == 'POST':
            data = request.get_json(silent=True) or {}
            message = str(data.get('message', '')).strip()[:1000]
            if not message:
                return jsonify({'error': 'Message cannot be empty.'}), 400
            mid = f'msg_{uuid.uuid4().hex[:12]}'
            created = get_iso_now()
            conn.execute(
                'INSERT INTO community_messages (id,sender_id,recipient_id,message,created_at,is_read) VALUES (?,?,?,?,?,0)',
                (mid, uid, user_id, message, created)
            )
            conn.execute(
                'INSERT INTO community_notifications (id,user_id,actor_user_id,event_type,post_id,text,created_at) VALUES (?,?,?,?,?,?,?)',
                (f'nt_{uuid.uuid4().hex[:10]}', user_id, uid, 'message', None, 'sent you a message', created)
            )
            conn.commit()
            return jsonify({'message': 'Message sent.', 'sent_at': created}), 201

        rows = conn.execute("""
            SELECT m.id, m.sender_id, m.recipient_id, m.message, m.created_at, m.is_read,
                   su.username AS sender_username, ru.username AS recipient_username
            FROM community_messages m
            LEFT JOIN users su ON su.id = m.sender_id
            LEFT JOIN users ru ON ru.id = m.recipient_id
            WHERE (m.sender_id = ? AND m.recipient_id = ?)
               OR (m.sender_id = ? AND m.recipient_id = ?)
            ORDER BY m.created_at ASC
        """, (uid, user_id, user_id, uid)).fetchall()
        conn.execute('UPDATE community_messages SET is_read=1 WHERE sender_id=? AND recipient_id=?', (user_id, uid))
        conn.execute('UPDATE community_notifications SET is_read=1 WHERE user_id=? AND actor_user_id=? AND event_type=?', (uid, user_id, 'message'))
        conn.commit()
    return jsonify({'user': target, 'messages': [dict(r) for r in rows]}), 200


@app.route('/api/community/messages', methods=['GET'])
@user_required
def community_message_inbox():
    uid = session['user_id']
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT m.sender_id, m.recipient_id, m.message, m.created_at, m.is_read,
                   CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END AS other_user_id
            FROM community_messages m
            WHERE m.sender_id=? OR m.recipient_id=?
            ORDER BY m.created_at DESC
        """, (uid, uid, uid)).fetchall()
    latest = {}
    for row in rows:
        r = dict(row)
        latest.setdefault(r['other_user_id'], r)
    conversations = []
    for other_id, r in latest.items():
        u = community_user(other_id)
        conversations.append({
            'user': u,
            'message': r['message'],
            'created_at': r['created_at'],
            'unread': bool(r['is_read'] == 0 and r['recipient_id'] == uid),
        })
    return jsonify({'conversations': conversations}), 200


@app.route('/api/community/notifications', methods=['GET'])
@user_required
def community_notifications():
    uid=session['user_id']
    with sqlite3.connect(USERS_DB) as conn:
        conn.row_factory=sqlite3.Row
        rows=conn.execute('''SELECT n.*, u.username, u.full_name FROM community_notifications n
                             LEFT JOIN users u ON u.id=n.actor_user_id
                             WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50''',(uid,)).fetchall()
        unread=conn.execute('SELECT COUNT(*) FROM community_notifications WHERE user_id=? AND is_read=0',(uid,)).fetchone()[0]
        # Only mark notifications as read when the user explicitly opens the
        # notification panel. Background polling must NOT clear the unread badge.
        mark_read = request.args.get('mark_read', '').strip().lower() in {'1', 'true', 'yes'}
        if mark_read:
            conn.execute('UPDATE community_notifications SET is_read=1 WHERE user_id=?',(uid,))
            conn.commit()
    return jsonify({'notifications':[dict(r) for r in rows], 'unread':unread}),200

# --------------------------------------------------------------
# Bird Observations API Endpoints (CRUD + Search)
# --------------------------------------------------------------

def normalize_bird_name(value):
    """Normalize a bird name for same-bird community matching."""
    text = str(value or '').strip().casefold()
    text = re.sub(r'\s+', ' ', text)
    return text


@app.route('/save-image', methods=['POST'])
@app.route('/api/observations', methods=['POST'])
def create_observation():
    """
    Accepts bird sighting details + a required live-camera base64 photo.
    Saves the captured photo locally and, when Supabase is configured, uploads
    it to the public Supabase Storage bucket so deployed posts keep their images.
    """
    data = request.get_json(silent=True) or {}
    bird_name = data.get('birdName') or data.get('bird_name', '').strip()
    species = data.get('species', 'Songbird / Passerine').strip()
    obs_date = data.get('obsDate') or data.get('obs_date', datetime.now().strftime('%Y-%m-%d'))
    state_name = data.get('state', '').strip()
    district = data.get('district', '').strip()
    location = data.get('location', '').strip()
    weather = data.get('weather', 'Clear').strip()
    notes = (data.get('notes', '') or '')[:1000]
    image_data = (data.get('imageData') or data.get('photo_url', '')).strip()

    if not bird_name:
        return jsonify({'error': 'Bird Name is required.'}), 400
    if not image_data.startswith('data:image/'):
        return jsonify({'error': 'A live camera photo is required. Please open the camera and capture the bird.'}), 400

    filename = ''
    photo_url = ''

    if image_data and image_data.startswith('data:image/'):
        _, ext = detect_image_format(image_data)
        try:
            img_bytes = decode_image(image_data)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            filename = f"bird_{timestamp}.{ext}"

            save_dir = PRIMARY_IMG_DIR if ensure_dir(PRIMARY_IMG_DIR) else FALLBACK_IMG_DIR
            ensure_dir(save_dir)
            save_path = os.path.join(save_dir, filename)

            with open(save_path, 'wb') as f:
                f.write(img_bytes)

            # Supabase Storage is the permanent source for deployed/community
            # photos. Keep the local file as a temporary/offline fallback.
            content_type = 'image/jpeg' if ext in ('jpg', 'jpeg') else f'image/{ext}'
            storage_url = upload_photo_to_supabase_storage(img_bytes, filename, content_type)
            photo_url = storage_url or f"/saved_images/{filename}"
        except (binascii.Error, ValueError, OSError) as exc:
            print(f"[BirdLog] Image save warning: {exc}")

    if not photo_url:
        return jsonify({'error': 'The camera photo could not be saved. Please capture the bird again.'}), 400

    saved_at = get_iso_now()
    obs_id = f"obs_{int(datetime.now().timestamp() * 1000)}"

    obs_record = {
        "id": obs_id,
        "filename": filename,
        "photo_url": photo_url,
        "saved_at": saved_at,
        "bird_name": bird_name,
        "species": species,
        "obs_date": obs_date,
        "state": state_name,
        "district": district,
        "location": location,
        "weather": weather,
        "notes": notes
    }

    db_manager.save_observation(obs_record)
    write_metadata_csv(obs_record)

    current_user_id = session.get('user_id')
    # Initialize these for safe response generation even without a session.
    normalized_bird = normalize_bird_name(bird_name)
    existing_user_ids = set()
    if current_user_id:
        caption = notes or f"Spotted {bird_name} at {location or 'the field'}."
        hashtags = make_hashtags(bird_name, species, location)
        with sqlite3.connect(USERS_DB) as conn:
            post_id = f'post_{uuid.uuid4().hex[:12]}'
            conn.execute('INSERT OR IGNORE INTO community_posts (id, observation_id, user_id, caption, hashtags, created_at, bird_name, species, location, state, district, weather, photo_url, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (post_id, obs_id, current_user_id, caption, hashtags, saved_at, bird_name, species, location, state_name, district, weather, photo_url, saved_at))

            # Same-bird community notification:
            # A new post is allowed even when the bird already exists. After the
            # post is created, notify each distinct user who had previously
            # posted the same bird. The uploader is excluded from notifications.
            if normalized_bird:
                candidate_rows = conn.execute(
                    '''SELECT DISTINCT cp.user_id, cp.bird_name
                       FROM community_posts cp
                       WHERE cp.user_id != ?
                         AND cp.hidden = 0''',
                    (current_user_id,)
                ).fetchall()
                existing_user_ids = {
                    row[0] for row in candidate_rows
                    if normalize_bird_name(row[1]) == normalized_bird
                }

                # Notify the people who previously posted this bird.
                for previous_user_id in existing_user_ids:
                    conn.execute(
                        '''INSERT INTO community_notifications
                           (id, user_id, actor_user_id, event_type, post_id, text, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?)''',
                        (
                            f'nt_{uuid.uuid4().hex[:10]}',
                            previous_user_id,
                            current_user_id,
                            'same_bird',
                            post_id,
                            f'also posted {bird_name}',
                            saved_at
                        )
                    )

                # Also notify the NEW uploader when somebody else had already
                # posted the exact same bird. This is intentionally separate
                # from the previous-user notifications so both sides get an
                # account-specific notification.
                if existing_user_ids:
                    # Pick one previous poster for the actor shown in the
                    # notification. Additional previous posters still remain
                    # represented in their own notifications to the uploader.
                    for previous_user_id in sorted(existing_user_ids):
                        conn.execute(
                            '''INSERT INTO community_notifications
                               (id, user_id, actor_user_id, event_type, post_id, text, created_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?)''',
                            (
                                f'nt_{uuid.uuid4().hex[:10]}',
                                current_user_id,
                                previous_user_id,
                                'same_bird_existing',
                                post_id,
                                f'{bird_name} was already posted by another bird watcher',
                                saved_at
                            )
                        )

            conn.commit()

    return jsonify({
        'message': 'Observation recorded successfully.',
        'observation': obs_record,
        'same_bird_notifications_sent': len(existing_user_ids) if current_user_id and normalized_bird else 0,
        'active_db': db_manager.active_engine
    }), 201


@app.route('/api/observations', methods=['GET'])
def get_observations():
    """Fetch bird observation records from active DB with multi-criteria search and filtering."""
    search = request.args.get('search', '').strip()
    species = request.args.get('species', '').strip()
    weather = request.args.get('weather', '').strip()
    location = request.args.get('location', '').strip()
    mine_only = request.args.get('mine', '').strip().lower() in {'1', 'true', 'yes'}

    records = db_manager.get_observations(
        search=search,
        species=species,
        weather=weather,
        location=location
    )

    if mine_only:
        current_user_id = session.get('user_id')
        if not current_user_id:
            return jsonify({'error': 'Please sign in first.', 'login_required': True}), 401
        with sqlite3.connect(USERS_DB) as conn:
            owned_ids = {str(row[0]) for row in conn.execute(
                'SELECT observation_id FROM community_posts WHERE user_id = ?',
                (current_user_id,)
            ).fetchall()}
        records = [r for r in records if str(r.get('id')) in owned_ids]

    for record in records:
        record['photo_url'] = normalize_photo_url(record.get('photo_url', ''))
    return jsonify({
        'count': len(records),
        'observations': records,
        'active_db': db_manager.active_engine
    }), 200


@app.route('/api/observations/<obs_id>', methods=['GET'])
def get_observation_by_id(obs_id):
    """Fetch single observation record by ID."""
    obs = db_manager.get_observation(obs_id)
    if not obs:
        return jsonify({'error': 'Observation record not found.'}), 404
    obs['photo_url'] = normalize_photo_url(obs.get('photo_url', ''))
    return jsonify({'observation': obs}), 200


@app.route('/api/observations/<obs_id>', methods=['PUT'])
def update_observation(obs_id):
    """Update an existing bird observation record."""
    data = request.get_json(silent=True) or {}
    obs = db_manager.get_observation(obs_id)
    if not obs:
        return jsonify({'error': 'Observation record not found.'}), 404

    fields = ['bird_name', 'species', 'obs_date', 'state', 'district', 'location', 'weather', 'notes', 'photo_url']
    for key in fields:
        if key in data and data[key] is not None:
            obs[key] = data[key]

    db_manager.save_observation(obs)
    obs['photo_url'] = normalize_photo_url(obs.get('photo_url', ''))
    return jsonify({'message': 'Observation updated successfully.', 'observation': obs}), 200


@app.route('/api/observations/<obs_id>', methods=['DELETE'])
def delete_observation(obs_id):
    """Delete a normal user's own observation record."""
    current_user_id = session.get('user_id')
    if current_user_id:
        with sqlite3.connect(USERS_DB) as conn:
            owned = conn.execute(
                'SELECT 1 FROM community_posts WHERE observation_id = ? AND user_id = ?',
                (obs_id, current_user_id)
            ).fetchone()
        if not owned:
            return jsonify({'error': 'You can only delete your own sightings.'}), 403
    db_manager.delete_observation(obs_id)
    return jsonify({'message': 'Observation record deleted successfully.'}), 200


@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Calculate summary statistics from active DB: Total Sightings, Unique Species, Unique Locations."""
    stats = db_manager.get_stats()
    stats['active_db'] = db_manager.active_engine
    return jsonify(stats), 200


@app.route('/api/species', methods=['GET', 'POST'])
def handle_species():
    """Get species for normal users; only administrators can add species."""
    if request.method == 'POST':
        if not session.get('is_admin'):
            return jsonify({'error': 'Only an administrator can add species.'}), 403
        data = request.get_json(silent=True) or {}
        name = data.get('name', '').strip()
        category = data.get('category', 'General').strip()
        if not name:
            return jsonify({'error': 'Species name is required.'}), 400
        sp_obj = {'id': f"sp_{int(datetime.now().timestamp() * 1000)}", 'name': name, 'category': category}
        db_manager.add_species(sp_obj)
        return jsonify({'message': 'Species added.', 'species': sp_obj}), 201

    species_list = db_manager.get_species()
    return jsonify({'species': species_list}), 200


@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    """Export stored observations from active DB as CSV text download."""
    records = db_manager.get_observations()
    output = []
    output.append(','.join(CSV_HEADERS))
    for r in records:
        row = ['"' + str(r.get(h, '')).replace('"', '""') + '"' for h in CSV_HEADERS]
        output.append(','.join(row))
    csv_text = '\n'.join(output)

    return Response(
        csv_text,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=bird_observations_export.csv"}
    )


@app.route('/saved_images/<path:filename>')
def serve_saved_image(filename):
    """Serve photo files from primary or fallback directory."""
    if os.path.exists(os.path.join(PRIMARY_IMG_DIR, filename)):
        return send_from_directory(PRIMARY_IMG_DIR, filename)
    elif os.path.exists(os.path.join(FALLBACK_IMG_DIR, filename)):
        return send_from_directory(FALLBACK_IMG_DIR, filename)
    elif os.path.exists(os.path.join(LEGACY_IMG_DIR, filename)):
        return send_from_directory(LEGACY_IMG_DIR, filename)
    return jsonify({'error': 'Image not found.'}), 404


@app.route('/')
def serve_index():
    if session.get('user_id'):
        return redirect('/app')
    return send_from_directory(BASE_DIR, 'login.html')


@app.route('/index.html')
def serve_index_alias():
    return redirect('/app' if session.get('user_id') else '/login')


@app.route('/<path:filename>')
def serve_static(filename):
    # Never expose secrets, databases, Python source, or project archives.
    blocked_names = {'.env', 'birdlog.db', 'users.db', 'app.py', 'database.py', 'requirements.txt',
                     'package.json', 'capacitor.config.json', 'observations_log.csv',
                     'README_SUPABASE.md', 'supabase_schema.sql'}
    if filename in blocked_names or filename.startswith('.') or filename.startswith('.vscode/') or filename.startswith('electron/'):
        return jsonify({'error': 'Resource not available.'}), 404
    allowed_extensions = {'.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.webmanifest'}
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({'error': 'Resource not available.'}), 404
    return send_from_directory(BASE_DIR, filename)


if __name__ == '__main__':
    status = db_manager.get_status()
    print("=" * 65)
    print("  Bird Watching Electronic Log (BirdLogApp) Backend Server")
    port = int(os.environ.get('PORT', '5000'))
    print(f"  Server Address : http://0.0.0.0:{port}")
    print(f"  Active Engine  : {status['active_engine'].upper()}")
    print(f"  Effective DB   : {status['current_effective_engine'].upper()}")
    print(f"  SQL Engine     : {status['sql_status']}")
    print(f"  Supabase Engine: {status['supabase_status']}")
    print("=" * 65)
    app.run(host='0.0.0.0', port=port, debug=False)
