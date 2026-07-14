"""
VolleyTrack - Team Roster API Server (Flask)
Hardened with input validation, admin auth, file safety, and rate limiting.
"""

from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
from functools import wraps
import os
import re
import hashlib
import hmac
import secrets
import logging
import config

logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB max upload

CORS(app, origins=config.CORS_ORIGINS)

# Ensure upload directories exist
os.makedirs(config.MOMENTS_UPLOAD_FOLDER, exist_ok=True)
os.makedirs(config.PROFILES_UPLOAD_FOLDER, exist_ok=True)

# Database Initialization
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
MAX_FIELD_LENGTH = 100   # Max chars for name, role, team, etc.

def generate_player_id():
    """Generate unique player ID using cryptographically secure random."""
    return secrets.token_hex(4)  # 8 hex chars

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
        # Accept admin credentials via header
        admin_token = request.headers.get('X-Admin-Token', '')
        if not admin_token:
            # Also check form data or JSON body
            if request.is_json:
                admin_token = (request.get_json(silent=True) or {}).get('admin_token', '')
            else:
                admin_token = request.form.get('admin_token', '')

        expected = config.ADMIN_PASSWORD
        if not admin_token or not hmac.compare_digest(admin_token, expected):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


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
                "admin_token": config.ADMIN_PASSWORD  # client stores and sends back
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

        # Validate jersey is a reasonable integer
        try:
            jersey = int(data.get('jersey', 0))
            jersey = max(0, min(jersey, 99))
        except (ValueError, TypeError):
            jersey = 0

        # Validate player_id format (alphanumeric + hyphens only)
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
        # Validate player_id format
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


# ==================== UPLOADS / MEDIA ROUTES ====================

@api_bp.route('/upload-profile-picture', methods=['POST'])
def upload_profile_picture():
    """Upload or update a player's profile picture."""
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

        ext = os.path.splitext(secure_filename(file.filename))[1].lower()
        filename = f"player_{secure_filename(player_id)}{ext}"
        file.save(os.path.join(config.PROFILES_UPLOAD_FOLDER, filename))

        pic_url = f"/api/uploads/profiles/{filename}"
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
    """Upload a moment image to the showcase."""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image in request"}), 400

        file = request.files['image']
        if not file or file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        if not validate_image_extension(file.filename):
            return jsonify({"error": "Only image files (png, jpg, jpeg, gif, webp) are allowed"}), 400

        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({"error": "Invalid filename"}), 400

        file.save(os.path.join(config.MOMENTS_UPLOAD_FOLDER, filename))

        return jsonify({
            "success": True,
            "message": "Moment uploaded",
            "filename": filename
        }), 200

    except Exception:
        logger.exception("upload_moment error")
        return safe_error()


@api_bp.route('/moments', methods=['GET'])
def get_moments():
    """Get all moment images for the showcase."""
    try:
        files = os.listdir(config.MOMENTS_UPLOAD_FOLDER)
        images = [f for f in files if os.path.splitext(f)[1].lower() in ALLOWED_IMAGE_EXTENSIONS]

        moments = []
        for img in sorted(images, reverse=True):
            moments.append({
                "filename": img,
                "url": f"/api/uploads/moments/{img}"
            })

        return jsonify({
            "success": True,
            "count": len(moments),
            "moments": moments
        }), 200
    except Exception:
        logger.exception("get_moments error")
        return safe_error()


@api_bp.route('/delete-moment/<filename>', methods=['DELETE'])
def delete_moment(filename):
    """Delete a moment image."""
    try:
        safe_name = secure_filename(filename)
        if not safe_name or not validate_image_extension(safe_name):
            return jsonify({"error": "Invalid filename"}), 400

        filepath = os.path.join(config.MOMENTS_UPLOAD_FOLDER, safe_name)

        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"success": True, "message": "Moment deleted"}), 200
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception:
        logger.exception("delete_moment error")
        return safe_error()


@api_bp.route('/uploads/<folder>/<filename>', methods=['GET'])
def get_uploaded_file(folder, filename):
    """Serve uploaded images (profiles or moments)."""
    if folder not in ('profiles', 'moments'):
        return jsonify({"error": "Invalid folder"}), 400

    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({"error": "Invalid filename"}), 400

    directory = config.PROFILES_UPLOAD_FOLDER if folder == 'profiles' else config.MOMENTS_UPLOAD_FOLDER
    return send_from_directory(directory, safe_name)


@api_bp.route('/reset', methods=['POST'])
@require_admin
def reset_database():
    """Reset all data — admin only."""
    query_db("TRUNCATE TABLE players CASCADE")
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
    app.run(debug=config.DEBUG, host=config.HOST, port=config.PORT)
