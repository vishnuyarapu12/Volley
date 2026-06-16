"""
VolleyTrack - Smart Volleyball Presence Network
Backend API Server (Flask)
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import math
import os
import config
from utils import (
    calculate_distance,
    get_player_status,
    cleanup_offline_players,
    is_valid_coordinate,
    recalculate_all_players_distances,
    player_has_map_location,
)

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=config.CORS_ORIGINS)

# All routes are registered under /api so the frontend can call
# fetch(`${VITE_API_URL}/api/...`) in production and the Vite
# dev proxy rewrites /api → / before hitting Flask locally.
from flask import Blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# In-memory storage
players_db = {}  # {player_id: {name, team, jersey, lat, lon, timestamp, stats}}
attendance_stats = {}  # {player_id: {visits, last_visit, arrival_times}}

LOCATION_VOTE_OPTIONS = (
    "At Ground",
    "On The Way",
    "Nearby",
    "Away",
    "Not Coming",
)

# ==================== UTILITY FUNCTIONS ====================

def generate_player_id():
    """Generate unique player ID"""
    import uuid
    return str(uuid.uuid4())[:8]


def apply_ground_location(latitude, longitude):
    """Set ground coordinates and refresh all player distances/statuses."""
    lat = float(latitude)
    lon = float(longitude)
    if not is_valid_coordinate(lat, lon):
        raise ValueError("Invalid latitude or longitude")
    config.GROUND_LATITUDE = lat
    config.GROUND_LONGITUDE = lon
    recalculate_all_players_distances(players_db)
    return {"latitude": lat, "longitude": lon}


def format_last_seen(player):
    """Human-readable last seen string for API responses."""
    return format_time_ago(player['timestamp'])


def format_time_ago(iso_timestamp):
    """Human-readable time ago from an ISO timestamp string."""
    if not iso_timestamp:
        return "Unknown"
    last_update = datetime.fromisoformat(iso_timestamp)
    time_ago = datetime.now() - last_update
    minutes_ago = int(time_ago.total_seconds() / 60)
    if minutes_ago <= 0:
        return "Just now"
    if minutes_ago == 1:
        return "1 minute ago"
    if minutes_ago < 60:
        return f"{minutes_ago} minutes ago"
    hours_ago = minutes_ago // 60
    if hours_ago == 1:
        return "1 hour ago"
    return f"{hours_ago} hours ago"


def build_vote_player_payload(player):
    """Serialize player for location vote listings."""
    return {
        "id": player['id'],
        "name": player['name'],
        "team": player.get('team', ''),
        "jersey": player.get('jersey', 0),
        "location_vote": player.get('location_vote'),
        "location_vote_at": player.get('location_vote_at'),
        "vote_last_seen": format_time_ago(player.get('location_vote_at')),
        "gps_status": player.get('status'),
        "profile_picture": player.get('profile_picture'),
    }


def ensure_player_record(player_id, data=None):
    """Create a minimal player record if missing (e.g. after server restart)."""
    if player_id in players_db:
        return players_db[player_id]

    data = data or {}
    players_db[player_id] = {
        "id": player_id,
        "name": data.get('name', 'Unknown Player'),
        "team": data.get('team', ''),
        "jersey": data.get('jersey', 0),
        "latitude": None,
        "longitude": None,
        "timestamp": datetime.now().isoformat(),
        "status": "Offline",
        "distance": 0,
        "is_online": True,
        "profile_picture": None,
        "picture_label": None,
        "has_gps": False,
        "location_vote": None,
        "location_vote_at": None,
    }
    get_stats_for_player(player_id)
    return players_db[player_id]


def build_map_player_payload(player):
    """Serialize player for map markers."""
    return {
        "id": player['id'],
        "name": player['name'],
        "team": player['team'],
        "jersey": player['jersey'],
        "status": player['status'],
        "distance": player['distance'],
        "latitude": float(player['latitude']),
        "longitude": float(player['longitude']),
        "last_seen": format_last_seen(player),
        "timestamp": player['timestamp'],
        "profile_picture": player.get('profile_picture'),
        "picture_label": player.get('picture_label'),
        "has_gps": player.get('has_gps', True),
    }


def get_stats_for_player(player_id):
    """Get attendance statistics for a player"""
    if player_id not in attendance_stats:
        attendance_stats[player_id] = {
            "visits": 0,
            "last_visit": None,
            "arrival_times": [],
            "consecutive_streak": 0,
            "total_attendance_percentage": 0
        }
    return attendance_stats[player_id]


# ==================== API ENDPOINTS ====================

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "VolleyTrack Backend Running"})


@api_bp.route('/join', methods=['POST'])
def join_team():
    """
    Register a new player - FAST JOIN
    
    Expected JSON:
    {
        "name": "Player Name",
        "team": "Team Name",
        "jersey": optional int,
        "latitude": optional float,
        "longitude": optional float
    }
    """
    try:
        data = request.get_json(silent=True) or {}

        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400

        try:
            jersey = int(data.get('jersey') or 0)
        except (TypeError, ValueError):
            jersey = 0

        player_id = generate_player_id()
        now = datetime.now().isoformat()

        players_db[player_id] = {
            "id": player_id,
            "name": name,
            "team": (data.get('team') or '').strip(),
            "jersey": jersey,
            "latitude": None,
            "longitude": None,
            "timestamp": now,
            "status": "Offline",
            "distance": 0,
            "is_online": True,
            "profile_picture": None,
            "picture_label": None,
            "has_gps": False,
            "location_vote": None,
            "location_vote_at": None,
        }

        get_stats_for_player(player_id)

        return jsonify({
            "success": True,
            "player_id": player_id,
            "message": f"Welcome to VolleyTrack, {name}!",
        }), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/location-update', methods=['POST'])
def location_update():
    """
    Receive location updates from client.
    Auto-registers player if not found (handles server restarts gracefully).
    
    Expected JSON:
    {
        "player_id": "string",
        "latitude": float,
        "longitude": float,
        "name": "string" (optional, used for auto-registration),
        "team": "string" (optional)
    }
    """
    try:
        data = request.get_json()
        
        player_id = data.get('player_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        # Validate required fields
        if not player_id or latitude is None or longitude is None:
            return jsonify({"error": "player_id, latitude, and longitude are required"}), 400

        if not is_valid_coordinate(latitude, longitude):
            return jsonify({"error": "Invalid latitude or longitude"}), 400
        
        # Auto-register player if not found (server may have restarted)
        if player_id not in players_db:
            players_db[player_id] = {
                "id": player_id,
                "name": data.get('name', 'Unknown Player'),
                "team": data.get('team', ''),
                "jersey": data.get('jersey', 0),
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": datetime.now().isoformat(),
                "status": "Offline",
                "distance": 0,
                "is_online": True,
                "profile_picture": None,
                "picture_label": None,
                "has_gps": False
            }
            get_stats_for_player(player_id)  # Initialize stats
        
        # Update player location
        now = datetime.now()
        players_db[player_id]['latitude'] = latitude
        players_db[player_id]['longitude'] = longitude
        players_db[player_id]['has_gps'] = True
        players_db[player_id]['timestamp'] = now.isoformat()
        players_db[player_id]['is_online'] = True
        
        # Calculate distance and status
        distance = calculate_distance(
            latitude, longitude,
            config.GROUND_LATITUDE, config.GROUND_LONGITUDE
        )
        
        status = get_player_status(distance)
        
        players_db[player_id]['distance'] = round(distance, 2)
        players_db[player_id]['status'] = status
        
        # Update attendance stats if player just arrived
        stats = get_stats_for_player(player_id)
        if status == "At Ground" and stats.get('last_status') != "At Ground":
            stats['visits'] += 1
            stats['last_visit'] = now.isoformat()
            arrival_time = now.strftime("%H:%M")
            stats['arrival_times'].append(arrival_time)
        
        stats['last_status'] = status
        
        return jsonify({
            "success": True,
            "player_id": player_id,
            "status": status,
            "distance": round(distance, 2)
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/location-vote', methods=['POST'])
def cast_location_vote():
    """
    Player self-reports where they are (like a vote/check-in).

    Expected JSON:
    {
        "player_id": "string",
        "vote": "At Ground" | "On The Way" | "Nearby" | "Away" | "Not Coming",
        "name": "string" (optional),
        "team": "string" (optional),
        "jersey": int (optional)
    }
    """
    try:
        data = request.get_json() or {}
        player_id = data.get('player_id')
        vote = data.get('vote')

        if not player_id:
            return jsonify({"error": "player_id is required"}), 400
        if vote not in LOCATION_VOTE_OPTIONS:
            return jsonify({
                "error": "Invalid vote",
                "valid_options": list(LOCATION_VOTE_OPTIONS),
            }), 400

        player = ensure_player_record(player_id, data)
        now = datetime.now()

        if data.get('name'):
            player['name'] = data['name']
        if data.get('team') is not None:
            player['team'] = data['team']
        if data.get('jersey') is not None:
            player['jersey'] = data['jersey']

        player['location_vote'] = vote
        player['location_vote_at'] = now.isoformat()
        player['timestamp'] = now.isoformat()
        player['is_online'] = True

        stats = get_stats_for_player(player_id)
        if vote == "At Ground" and stats.get('last_status') != "At Ground":
            stats['visits'] += 1
            stats['last_visit'] = now.isoformat()
            stats['arrival_times'].append(now.strftime("%H:%M"))
        stats['last_status'] = vote

        return jsonify({
            "success": True,
            "player_id": player_id,
            "vote": vote,
            "voted_at": player['location_vote_at'],
            "player": build_vote_player_payload(player),
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/location-votes', methods=['GET'])
def get_location_votes():
    """All players with their location votes and counts per option."""
    try:
        players_list = [
            build_vote_player_payload(player)
            for player in players_db.values()
        ]
        players_list.sort(
            key=lambda p: (
                p['location_vote'] is None,
                p.get('location_vote') or 'ZZZ',
                p['name'].lower(),
            )
        )

        counts = {option: 0 for option in LOCATION_VOTE_OPTIONS}
        no_vote = 0
        for player in players_list:
            vote = player.get('location_vote')
            if vote in counts:
                counts[vote] += 1
            else:
                no_vote += 1

        at_ground = counts["At Ground"]
        elsewhere = len(players_list) - at_ground - no_vote

        return jsonify({
            "success": True,
            "options": list(LOCATION_VOTE_OPTIONS),
            "counts": counts,
            "no_vote": no_vote,
            "at_ground": at_ground,
            "elsewhere": elsewhere,
            "total": len(players_list),
            "players": players_list,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/players', methods=['GET'])
def get_players():
    """Get all active players"""
    try:
        cleanup_offline_players(players_db, config.OFFLINE_THRESHOLD)
        
        # Separate players by status
        players_list = []
        for player in players_db.values():
            if player_has_map_location(player):
                players_list.append(build_map_player_payload(player))
        
        # Sort by distance from ground
        players_list.sort(key=lambda x: x['distance'])
        
        return jsonify({
            "success": True,
            "count": len(players_list),
            "players": players_list
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/map/data', methods=['GET'])
def get_map_data():
    """Single payload for the live map: ground + all players with GPS."""
    try:
        cleanup_offline_players(players_db, config.OFFLINE_THRESHOLD)

        players_list = []
        for player in players_db.values():
            if player_has_map_location(player):
                players_list.append(build_map_player_payload(player))
        players_list.sort(key=lambda x: x['distance'])

        return jsonify({
            "success": True,
            "ground_location": {
                "latitude": float(config.GROUND_LATITUDE),
                "longitude": float(config.GROUND_LONGITUDE),
            },
            "ground_radius_m": 500,
            "status_radii": {
                "at_ground": config.AT_GROUND_RADIUS,
                "nearby": config.NEARBY_RADIUS,
                "on_the_way": config.ON_THE_WAY_RADIUS,
            },
            "count": len(players_list),
            "players": players_list,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get dashboard statistics"""
    try:
        # Count players by self-reported location vote
        at_ground = 0
        nearby = 0
        on_the_way = 0
        away = 0
        not_coming = 0
        no_vote = 0

        for player in players_db.values():
            vote = player.get('location_vote')
            if vote == 'At Ground':
                at_ground += 1
            elif vote == 'Nearby':
                nearby += 1
            elif vote == 'On The Way':
                on_the_way += 1
            elif vote == 'Away':
                away += 1
            elif vote == 'Not Coming':
                not_coming += 1
            else:
                no_vote += 1

        total_players = len(players_db)
        present_players = at_ground
        
        # Match readiness — full match only (12 players)
        if present_players < config.MIN_PLAYERS_FOR_FULL_MATCH:
            match_status = "Not Enough Players"
            match_color = "red"
        else:
            match_status = "Full Match Ready"
            match_color = "green"

        readiness_percentage = min(
            100,
            int((present_players / config.MIN_PLAYERS_FOR_FULL_MATCH) * 100),
        )
        
        return jsonify({
            "success": True,
            "ground_location": {
                "latitude": config.GROUND_LATITUDE,
                "longitude": config.GROUND_LONGITUDE
            },
            "players": {
                "at_ground": at_ground,
                "nearby": nearby,
                "on_the_way": on_the_way,
                "away": away,
                "not_coming": not_coming,
                "no_vote": no_vote,
                "total": total_players,
                "present": present_players,
                "logged_in": total_players,
            },
            "match_status": {
                "status": match_status,
                "color": match_color,
                "readiness_percentage": readiness_percentage,
                "required_for_full_match": config.MIN_PLAYERS_FOR_FULL_MATCH
            }
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get attendance leaderboard"""
    try:
        leaderboard = []
        
        for player_id, player in players_db.items():
            stats = get_stats_for_player(player_id)
            total_visits = stats.get('visits', 0)
            
            if total_visits > 0:
                # Calculate attendance percentage (visits / recent days)
                attendance_pct = min(100, (total_visits / max(total_visits, 1)) * 100)
                
                leaderboard.append({
                    "rank": 0,  # Will be assigned after sorting
                    "player_id": player_id,
                    "name": player['name'],
                    "team": player['team'],
                    "jersey": player['jersey'],
                    "visits": total_visits,
                    "attendance_percentage": int(attendance_pct),
                    "last_visit": stats.get('last_visit', 'Never'),
                    "streak": stats.get('consecutive_streak', 0)
                })
        
        # Sort by attendance percentage and visits
        leaderboard.sort(key=lambda x: (-x['attendance_percentage'], -x['visits']))
        
        # Assign ranks
        for idx, entry in enumerate(leaderboard, 1):
            entry['rank'] = idx
        
        # Return top 50
        return jsonify({
            "success": True,
            "count": len(leaderboard[:50]),
            "leaderboard": leaderboard[:50]
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/ground-status', methods=['GET'])
def ground_status():
    """Get ground status and readiness"""
    try:
        cleanup_offline_players(players_db, config.OFFLINE_THRESHOLD)
        
        at_ground = sum(1 for p in players_db.values() if p['is_online'] and p['status'] == 'At Ground')
        total_online = sum(1 for p in players_db.values() if p['is_online'])
        
        if at_ground < config.MIN_PLAYERS_FOR_FULL_MATCH:
            status = "Not Enough Players"
            message = f"Need {config.MIN_PLAYERS_FOR_FULL_MATCH - at_ground} more for full match"
            icon = "alert"
            can_start_match = False
        else:
            status = "Full Match Ready"
            message = f"{at_ground} players ready for full match"
            icon = "trophy"
            can_start_match = True
        
        return jsonify({
            "success": True,
            "status": status,
            "message": message,
            "icon": icon,
            "can_start_match": can_start_match,
            "players_at_ground": at_ground,
            "players_online": total_online,
            "total_players": len(players_db)
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/player/<player_id>', methods=['GET'])
def get_player_details(player_id):
    """Get detailed information about a specific player"""
    try:
        if player_id not in players_db:
            return jsonify({"error": "Player not found"}), 404
        
        player = players_db[player_id]
        stats = get_stats_for_player(player_id)
        
        return jsonify({
            "success": True,
            "player": {
                "id": player['id'],
                "name": player['name'],
                "team": player['team'],
                "jersey": player['jersey'],
                "status": player['status'],
                "distance": player['distance'],
                "latitude": player['latitude'],
                "longitude": player['longitude'],
                "last_seen": player['timestamp']
            },
            "statistics": {
                "visits": stats.get('visits', 0),
                "attendance_percentage": int(min(100, (stats.get('visits', 0) / max(stats.get('visits', 1), 1)) * 100)),
                "last_visit": stats.get('last_visit', 'Never'),
                "consecutive_streak": stats.get('consecutive_streak', 0),
                "recent_arrivals": stats.get('arrival_times', [])[-5:]  # Last 5 arrivals
            }
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/reset', methods=['POST'])
def reset_database():
    """Reset all data (for testing/demo purposes)"""
    global players_db, attendance_stats
    players_db = {}
    attendance_stats = {}
    return jsonify({"success": True, "message": "Database reset"}), 200


@api_bp.route('/update-ground-location', methods=['POST'])
def update_ground_location():
    """
    Update ground location dynamically (runtime only, resets on restart)
    
    Expected JSON:
    {
        "latitude": float,
        "longitude": float
    }
    """
    try:
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if latitude is None or longitude is None:
            return jsonify({"error": "Latitude and longitude are required"}), 400

        try:
            new_location = apply_ground_location(latitude, longitude)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        
        return jsonify({
            "success": True,
            "message": "Ground location updated",
            "new_location": new_location,
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/save-ground-location', methods=['POST'])
def save_ground_location():
    """
    Permanently save ground location to config.py on disk
    so it persists across server restarts.

    Expected JSON:
    {
        "latitude": float,
        "longitude": float
    }
    """
    try:
        import re
        import os

        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if latitude is None or longitude is None:
            return jsonify({"error": "Latitude and longitude are required"}), 400

        try:
            new_location = apply_ground_location(latitude, longitude)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        # Persist to config.py on disk
        config_path = os.path.join(os.path.dirname(__file__), 'config.py')
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        content = re.sub(
            r'GROUND_LATITUDE\s*=\s*[\d.\-]+',
            f'GROUND_LATITUDE = {new_location["latitude"]}',
            content
        )
        content = re.sub(
            r'GROUND_LONGITUDE\s*=\s*[\d.\-]+',
            f'GROUND_LONGITUDE = {new_location["longitude"]}',
            content
        )

        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return jsonify({
            "success": True,
            "message": "Ground location saved permanently to config.py",
            "new_location": new_location,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/upload-profile-picture', methods=['POST'])
def upload_profile_picture():
    """
    Upload profile picture for a player
    
    Expected: FormData with 'player_id' and 'image' file
    """
    try:
        from werkzeug.utils import secure_filename
        import base64
        import os
        
        player_id = request.form.get('player_id')
        picture_name = (request.form.get('picture_name') or '').strip()
        
        if not player_id or player_id not in players_db:
            return jsonify({"error": "Invalid player ID"}), 400
        
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Read file and encode to base64
        file_data = file.read()
        base64_image = base64.b64encode(file_data).decode('utf-8')
        
        # Get file extension
        file_ext = os.path.splitext(secure_filename(file.filename))[1]
        mime_type = 'image/jpeg' if file_ext.lower() in ['.jpg', '.jpeg'] else 'image/png' if file_ext.lower() == '.png' else 'image/webp'
        
        # Store as data URL
        data_url = f"data:{mime_type};base64,{base64_image}"
        
        # Update player record
        players_db[player_id]['profile_picture'] = data_url
        players_db[player_id]['picture_updated_at'] = datetime.now().isoformat()
        if picture_name:
            players_db[player_id]['picture_label'] = picture_name
        
        return jsonify({
            "success": True,
            "message": "Profile picture uploaded successfully",
            "player_id": player_id,
            "picture_label": players_db[player_id].get('picture_label')
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/player/<player_id>/picture', methods=['GET'])
def get_player_picture(player_id):
    """Get profile picture for a player"""
    try:
        if player_id not in players_db:
            return jsonify({"error": "Player not found"}), 404
        
        player = players_db[player_id]
        picture = player.get('profile_picture', None)
        
        if not picture:
            return jsonify({"picture": None, "player_name": player.get('name')}), 200
        
        return jsonify({
            "picture": picture,
            "player_name": player.get('name'),
            "player_id": player_id
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/player/<player_id>/current-location', methods=['GET'])
def get_player_current_location(player_id):
    """Get current location of a player"""
    try:
        if player_id not in players_db:
            return jsonify({"error": "Player not found"}), 404
        
        player = players_db[player_id]
        
        return jsonify({
            "success": True,
            "player_id": player_id,
            "name": player.get('name'),
            "latitude": player.get('latitude'),
            "longitude": player.get('longitude'),
            "status": player.get('status'),
            "distance": player.get('distance'),
            "timestamp": player.get('timestamp')
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== MOMENTS (IMAGE GALLERY) ====================

IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'images'))
PLAYER_IMG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'player_img'))
ALLOWED_IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}


@api_bp.route('/images/list', methods=['GET'])
def list_moment_images():
    """List all images in the project ./images folder."""
    try:
        if not os.path.isdir(IMAGES_DIR):
            return jsonify({"success": True, "images": [], "count": 0}), 200

        files = sorted(
            f for f in os.listdir(IMAGES_DIR)
            if os.path.splitext(f)[1].lower() in ALLOWED_IMAGE_EXT
        )
        images = [
            {"filename": name, "url": f"/images/{name}"}
            for name in files
        ]
        return jsonify({"success": True, "images": images, "count": len(images)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/images/<path:filename>', methods=['GET'])
def serve_moment_image(filename):
    """Serve a single image from ./images."""
    try:
        safe_name = os.path.basename(filename)
        if os.path.splitext(safe_name)[1].lower() not in ALLOWED_IMAGE_EXT:
            return jsonify({"error": "Invalid image type"}), 400
        return send_from_directory(IMAGES_DIR, safe_name)
    except FileNotFoundError:
        return jsonify({"error": "Image not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== PLAYER PROFILE IMAGES ====================
@app.route("/")
def home():
    return "Volley Backend Running"

@api_bp.route('/player_img/<path:filename>', methods=['GET'])
def serve_player_image(filename):
    """Serve a player profile photo from ./player_img."""
    try:
        safe_name = os.path.basename(filename)
        if os.path.splitext(safe_name)[1].lower() not in ALLOWED_IMAGE_EXT:
            return jsonify({"error": "Invalid image type"}), 400
        if not os.path.isdir(PLAYER_IMG_DIR):
            return jsonify({"error": "Player images directory not found"}), 404
        return send_from_directory(PLAYER_IMG_DIR, safe_name)
    except FileNotFoundError:
        return jsonify({"error": "Image not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


# ==================== REGISTER BLUEPRINT ====================
app.register_blueprint(api_bp)


if __name__ == '__main__':
    print("VolleyTrack Backend Server Starting...")
    print(f"Ground Location: ({config.GROUND_LATITUDE}, {config.GROUND_LONGITUDE})")
    print(f"Server running on http://{config.HOST}:{config.PORT}")
    app.run(debug=config.DEBUG, host=config.HOST, port=config.PORT)
