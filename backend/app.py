"""
VolleyTrack - Team Roster API Server (Flask)
All image uploads go to Supabase Storage. Only URLs are stored in PostgreSQL.
"""

from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
from functools import wraps
import os
import re
import hmac
import secrets
import logging
import config
import supabase_storage

logger = logging.getLogger(__name__)

# ─── Flask App ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB max upload

CORS(app, origins=config.CORS_ORIGINS)

# Keep local upload dirs as fallback for serving legacy files
os.makedirs(config.MOMENTS_UPLOAD_FOLDER, exist_ok=True)
os.makedirs(config.PROFILES_UPLOAD_FOLDER, exist_ok=True)

# ─── Database Init ─────────────────────────────────────────────────────────────
try:
    from db import init_db
    init_db()
except Exception as e:
    logger.warning(f"db init failed - {e}")

from flask import Blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

from db import query_db


# ==================== SECURITY HELPERS ====================

ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
MAX_FIELD_LENGTH = 100

def generate_player_id():
    """Generate unique player ID using cryptographically secure random."""
    return secrets.token_hex(4)

def sanitize_string(value, max_len=MAX_FIELD_LENGTH):
    """Strip and truncate string input. Returns None if empty."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:max_len]

def validate_image_extension(filename):
    """Return True only if the file extension is an allowed image type."""
    if not filename:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS

def safe_error(message="An error occurred", status=500):
    """Return a generic error without leaking internals."""
    return jsonify({"error": message}), status

def require_admin(f):
    """Decorator: check for admin token in request header or form data."""
    @wraps(f)
    def decorated(*args, **kwargs):
        admin_token = request.headers.get('X-Admin-Token', '')
        if not admin_token:
            if request.is_json:
                admin_token = (request.get_json(silent=True) or {}).get('admin_token', '')
            else:
                admin_token = request.form.get('admin_token', '')
        expected = config.ADMIN_PASSWORD
        if not admin_token or not hmac.compare_digest(admin_token, expected):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


def _use_supabase():
    """Check if Supabase Storage is configured."""
    return bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_KEY)


# ==================== AUTH ROUTES ====================

@api_bp.route('/admin-login', methods=['POST'])
def admin_login():
    """Validate admin credentials and return a session token."""
    try:
        data = request.get_json()
        if not data:
            return safe_error("Invalid request", 400)

        username = sanitize_string(data.get('username', ''))
        password = data.get('password', '')

        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400

        if (hmac.compare_digest(username, config.ADMIN_USERNAME) and
            hmac.compare_digest(password, config.ADMIN_PASSWORD)):
            return jsonify({
                "success": True,
                "admin_token": config.ADMIN_PASSWORD
            }), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception:
        logger.exception("admin_login error")
        return safe_error()


# ==================== CORE API ROUTES ====================

@api_bp.route('/join', methods=['POST'])
def join_team():
    """Add or update a player in the roster."""
    try:
        data = request.get_json()
        if not data:
            return safe_error("Invalid request body", 400)

        name = sanitize_string(data.get('name', ''))
        if not name or len(name) < 2:
            return jsonify({"error": "Name must be at least 2 characters"}), 400

        player_id = sanitize_string(data.get('player_id', ''), max_len=36)
        role = sanitize_string(data.get('role', '')) or 'Player'
        team = sanitize_string(data.get('team', '')) or ''

        try:
            jersey = int(data.get('jersey', 0))
            jersey = max(0, min(jersey, 99))
        except (ValueError, TypeError):
            jersey = 0

        if player_id and not re.match(r'^[a-zA-Z0-9_-]+$', player_id):
            return jsonify({"error": "Invalid player ID format"}), 400

        if player_id:
            existing = query_db("SELECT id FROM players WHERE id = %s", (player_id,), one=True)
            if existing:
                query_db("""
                    UPDATE players 
                    SET name = %s, role = %s, team = %s, jersey = %s
                    WHERE id = %s
                """, (name, role, team, jersey, player_id))
            else:
                query_db("""
                    INSERT INTO players (id, name, role, team, jersey)
                    VALUES (%s, %s, %s, %s, %s)
                """, (player_id, name, role, team, jersey))
        else:
            player_id = generate_player_id()
            query_db("""
                INSERT INTO players (id, name, role, team, jersey)
                VALUES (%s, %s, %s, %s, %s)
            """, (player_id, name, role, team, jersey))

        return jsonify({
            "success": True,
            "player_id": player_id,
            "name": name,
            "role": role,
            "team": team,
            "jersey": jersey
        }), 200
    except Exception:
        logger.exception("join_team error")
        return safe_error()


@api_bp.route('/players', methods=['GET'])
def get_players():
    """Get all players in the roster."""
    try:
        db_players = query_db("SELECT * FROM players ORDER BY name")
        players_list = []
        for p in (db_players or []):
            players_list.append({
                "id": p["id"],
                "name": p["name"],
                "role": p.get("role") or "Player",
                "team": p.get("team") or "",
                "jersey": p.get("jersey") or 0,
                "img": p.get("profile_picture"),
                "picture_label": p.get("picture_label")
            })

        return jsonify({
            "success": True,
            "count": len(players_list),
            "players": players_list
        }), 200
    except Exception:
        logger.exception("get_players error")
        return safe_error()


@api_bp.route('/player/<player_id>', methods=['GET'])
def get_player_details(player_id):
    """Get detailed information about a specific player."""
    try:
        if not re.match(r'^[a-zA-Z0-9_-]+$', player_id):
            return jsonify({"error": "Invalid player ID"}), 400

        player = query_db("SELECT * FROM players WHERE id = %s", (player_id,), one=True)
        if not player:
            return jsonify({"error": "Player not found"}), 404

        return jsonify({
            "success": True,
            "player": {
                "id": player['id'],
                "name": player['name'],
                "role": player.get('role') or "Player",
                "team": player.get('team') or "",
                "jersey": player.get('jersey') or 0,
                "img": player.get('profile_picture')
            }
        }), 200
    except Exception:
        logger.exception("get_player_details error")
        return safe_error()


# ==================== UPLOAD ROUTES (SUPABASE STORAGE) ====================

@api_bp.route('/upload-profile-picture', methods=['POST'])
def upload_profile_picture():
    """Upload or update a player's profile picture to Supabase Storage."""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image in request"}), 400

        file = request.files['image']
        player_id = sanitize_string(request.form.get('player_id', ''), max_len=36)
        picture_name = sanitize_string(request.form.get('picture_name', ''))

        if not file or file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        if not player_id:
            return jsonify({"error": "Player ID is required"}), 400
        if not validate_image_extension(file.filename):
            return jsonify({"error": "Only image files (png, jpg, jpeg, gif, webp) are allowed"}), 400
        if not re.match(r'^[a-zA-Z0-9_-]+$', player_id):
            return jsonify({"error": "Invalid player ID format"}), 400

        if _use_supabase():
            # ── Upload to Supabase Storage ──
            # Delete old profile picture from storage if it exists
            old_player = query_db("SELECT profile_picture FROM players WHERE id = %s", (player_id,), one=True)
            if old_player and old_player.get('profile_picture'):
                old_url = old_player['profile_picture']
                # Extract storage_path from the Supabase URL
                bucket = config.SUPABASE_BUCKET
                marker = f'/storage/v1/object/public/{bucket}/'
                if marker in old_url:
                    old_path = old_url.split(marker, 1)[1]
                    supabase_storage.delete_image(bucket, old_path)

            result = supabase_storage.upload_image(
                bucket=config.SUPABASE_BUCKET,
                folder='profiles',
                file_stream=file.stream,
                original_filename=file.filename,
                content_type=file.content_type,
            )

            if not result['success']:
                return jsonify({"error": result['error']}), 400

            pic_url = result['url']
        else:
            # ── Fallback: save locally ──
            ext = os.path.splitext(secure_filename(file.filename))[1].lower()
            filename = f"player_{secure_filename(player_id)}{ext}"
            file.save(os.path.join(config.PROFILES_UPLOAD_FOLDER, filename))
            pic_url = f"/api/uploads/profiles/{filename}"

        # Update database
        if picture_name:
            query_db("""
                UPDATE players 
                SET profile_picture = %s, picture_label = %s, name = %s
                WHERE id = %s
            """, (pic_url, picture_name, picture_name, player_id))
        else:
            query_db("""
                UPDATE players 
                SET profile_picture = %s
                WHERE id = %s
            """, (pic_url, player_id))

        return jsonify({
            "success": True,
            "message": "Profile picture updated",
            "filename": pic_url
        }), 200

    except Exception:
        logger.exception("upload_profile_picture error")
        return safe_error()


@api_bp.route('/upload-moment', methods=['POST'])
def upload_moment():
    """Upload a moment image to Supabase Storage and save URL in database."""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image in request"}), 400

        file = request.files['image']
        if not file or file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        if not validate_image_extension(file.filename):
            return jsonify({"error": "Only image files (png, jpg, jpeg, gif, webp) are allowed"}), 400

        original_name = secure_filename(file.filename) or 'moment.jpg'
        moment_id = secrets.token_hex(4)

        if _use_supabase():
            # ── Upload to Supabase Storage ──
            result = supabase_storage.upload_image(
                bucket=config.SUPABASE_BUCKET,
                folder='moments',
                file_stream=file.stream,
                original_filename=file.filename,
                content_type=file.content_type,
            )

            if not result['success']:
                return jsonify({"error": result['error']}), 400

            moment_url = result['url']
            storage_path = result.get('storage_path', '')
        else:
            # ── Fallback: save locally ──
            file.save(os.path.join(config.MOMENTS_UPLOAD_FOLDER, original_name))
            moment_url = f"/api/uploads/moments/{original_name}"
            storage_path = ''

        # Insert into moments table
        query_db("""
            INSERT INTO moments (id, filename, url, storage_path)
            VALUES (%s, %s, %s, %s)
        """, (moment_id, original_name, moment_url, storage_path))

        return jsonify({
            "success": True,
            "message": "Moment uploaded",
            "moment_id": moment_id,
            "filename": original_name,
            "url": moment_url
        }), 200

    except Exception:
        logger.exception("upload_moment error")
        return safe_error()


@api_bp.route('/moments', methods=['GET'])
def get_moments():
    """Get all moments from the database."""
    try:
        db_moments = query_db("SELECT * FROM moments ORDER BY uploaded_at DESC")
        moments = []
        for m in (db_moments or []):
            moments.append({
                "id": m["id"],
                "filename": m["filename"],
                "url": m["url"],
                "src": m["url"],  # Frontend expects 'src' key
                "uploaded_at": str(m.get("uploaded_at", "")),
            })

        return jsonify({
            "success": True,
            "count": len(moments),
            "moments": moments
        }), 200
    except Exception:
        logger.exception("get_moments error")
        return safe_error()


@api_bp.route('/delete-moment/<moment_id>', methods=['DELETE'])
def delete_moment(moment_id):
    """Delete a moment from both the database and Supabase Storage."""
    try:
        if not re.match(r'^[a-zA-Z0-9_-]+$', moment_id):
            return jsonify({"error": "Invalid moment ID"}), 400

        # Fetch the moment from the database
        moment = query_db("SELECT * FROM moments WHERE id = %s", (moment_id,), one=True)
        if not moment:
            return jsonify({"error": "Moment not found"}), 404

        # Delete from Supabase Storage if we have a storage_path
        storage_path = moment.get('storage_path')
        if storage_path and _use_supabase():
            supabase_storage.delete_image(config.SUPABASE_BUCKET, storage_path)

        # Delete from the database
        query_db("DELETE FROM moments WHERE id = %s", (moment_id,))

        return jsonify({"success": True, "message": "Moment deleted"}), 200
    except Exception:
        logger.exception("delete_moment error")
        return safe_error()


# ==================== LEGACY FILE SERVING (FALLBACK) ====================

@api_bp.route('/uploads/<folder>/<filename>', methods=['GET'])
def get_uploaded_file(folder, filename):
    """Serve locally uploaded images (legacy fallback)."""
    if folder not in ('profiles', 'moments'):
        return jsonify({"error": "Invalid folder"}), 400

    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({"error": "Invalid filename"}), 400

    directory = config.PROFILES_UPLOAD_FOLDER if folder == 'profiles' else config.MOMENTS_UPLOAD_FOLDER
    return send_from_directory(directory, safe_name)


# ==================== ADMIN ROUTES ====================

@api_bp.route('/reset', methods=['POST'])
@require_admin
def reset_database():
    """Reset all data — admin only."""
    query_db("TRUNCATE TABLE players CASCADE")
    query_db("TRUNCATE TABLE moments CASCADE")
    return jsonify({"success": True, "message": "Database reset"}), 200


# ==================== HEALTH & HOME ====================

@app.route("/")
def home():
    return "Volley Roster API Running"

@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200


# ==================== ERROR HANDLERS ====================

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large. Maximum size is 10 MB."}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


# ==================== REGISTER BLUEPRINT ====================
app.register_blueprint(api_bp)

if __name__ == '__main__':
    print("VolleyTrack API Server Starting...")
    print(f"Server running on http://{config.HOST}:{config.PORT}")
    if _use_supabase():
        print(f"Supabase Storage: ENABLED (bucket: {config.SUPABASE_BUCKET})")
    else:
        print("Supabase Storage: DISABLED (using local filesystem fallback)")
    app.run(debug=config.DEBUG, host=config.HOST, port=config.PORT)
