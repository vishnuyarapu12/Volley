"""
VolleyTrack - Team Roster API Server (Flask)
"""

from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import config

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=config.CORS_ORIGINS)

# Ensure upload directories exist
os.makedirs(config.MOMENTS_UPLOAD_FOLDER, exist_ok=True)
os.makedirs(config.PROFILES_UPLOAD_FOLDER, exist_ok=True)

# Database Initialization
try:
    from db import init_db
    init_db()
except Exception as e:
    print(f"Warning: db init failed - {e}")

from flask import Blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

from db import query_db

def generate_player_id():
    """Generate unique player ID"""
    import uuid
    return str(uuid.uuid4())[:8]

# ==================== CORE API ROUTES ====================

@api_bp.route('/join', methods=['POST'])
def join_team():
    """Add or update a player in the roster"""
    try:
        data = request.get_json()
        name = data.get('name')
        
        if not name or len(name.strip()) < 2:
            return jsonify({"error": "Valid name is required"}), 400
            
        player_id = data.get('player_id')
        role = data.get('role', 'Player')
        team = data.get('team', '')
        jersey = data.get('jersey', 0)
        
        if player_id:
            # Check if exists
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/players', methods=['GET'])
def get_players():
    """Get all players in the roster"""
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/player/<player_id>', methods=['GET'])
def get_player_details(player_id):
    """Get detailed information about a specific player"""
    try:
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== UPLOADS / MEDIA ROUTES ====================

@api_bp.route('/upload-profile-picture', methods=['POST'])
def upload_profile_picture():
    """Upload or update a player's profile picture"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image part in request"}), 400
            
        file = request.files['image']
        player_id = request.form.get('player_id')
        picture_name = request.form.get('picture_name')
        
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        if not player_id:
            return jsonify({"error": "Player ID is required"}), 400
            
        if file:
            ext = os.path.splitext(file.filename)[1]
            filename = f"player_{player_id}{ext}"
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
                "message": "Profile picture updated successfully",
                "filename": pic_url
            }), 200
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/upload-moment', methods=['POST'])
def upload_moment():
    """Admin route to upload a moment to the showcase"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image part in request"}), 400
            
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        if file:
            filename = secure_filename(file.filename)
            file.save(os.path.join(config.MOMENTS_UPLOAD_FOLDER, filename))
            
            return jsonify({
                "success": True,
                "message": "Moment uploaded successfully",
                "filename": filename
            }), 200
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/moments', methods=['GET'])
def get_moments():
    """Get all moment images for the showcase"""
    try:
        files = os.listdir(config.MOMENTS_UPLOAD_FOLDER)
        images = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))]
        
        moments = []
        for img in sorted(images, reverse=True):  # Newest first based on filename
            moments.append({
                "filename": img,
                "url": f"/api/uploads/moments/{img}"
            })
            
        return jsonify({
            "success": True,
            "count": len(moments),
            "moments": moments
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/delete-moment/<filename>', methods=['DELETE'])
def delete_moment(filename):
    """Admin route to delete a moment"""
    try:
        safe_filename = secure_filename(filename)
        filepath = os.path.join(config.MOMENTS_UPLOAD_FOLDER, safe_filename)
        
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"success": True, "message": "Moment deleted"}), 200
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/uploads/<folder>/<filename>', methods=['GET'])
def get_uploaded_file(folder, filename):
    """Serve uploaded images (profiles or moments)"""
    if folder not in ['profiles', 'moments']:
        return jsonify({"error": "Invalid folder"}), 400
        
    directory = config.PROFILES_UPLOAD_FOLDER if folder == 'profiles' else config.MOMENTS_UPLOAD_FOLDER
    return send_from_directory(directory, secure_filename(filename))


@api_bp.route('/reset', methods=['POST'])
def reset_database():
    """Reset all data (for testing/demo purposes)"""
    query_db("TRUNCATE TABLE players CASCADE")
    return jsonify({"success": True, "message": "Database reset"}), 200


@app.route("/")
def home():
    return "Volley Roster API Running"

# ==================== REGISTER BLUEPRINT ====================
app.register_blueprint(api_bp)

if __name__ == '__main__':
    print("VolleyTrack API Server Starting...")
    print(f"Server running on http://{config.HOST}:{config.PORT}")
    app.run(debug=config.DEBUG, host=config.HOST, port=config.PORT)
