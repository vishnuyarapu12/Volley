"""Utility functions for VolleyTrack backend"""

import math
from datetime import datetime, timedelta
import config


def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in meters.
    
    Args:
        lat1, lon1: Player's latitude and longitude
        lat2, lon2: Ground's latitude and longitude
    
    Returns:
        Distance in meters
    """
    # Earth's radius in kilometers
    R = 6371.0
    
    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    # Distance in kilometers, then convert to meters
    distance_km = R * c
    distance_meters = distance_km * 1000
    
    return distance_meters


def get_player_status(distance):
    """
    Determine player status based on distance from ground.
    
    Args:
        distance: Distance in meters
    
    Returns:
        Status string: "At Ground", "Nearby", "On The Way", "Away", "Offline"
    """
    if distance <= config.AT_GROUND_RADIUS:
        return "At Ground"
    elif distance <= config.NEARBY_RADIUS:
        return "Nearby"
    elif distance <= config.ON_THE_WAY_RADIUS:
        return "On The Way"
    else:
        return "Away"


def cleanup_offline_players(players_db, offline_threshold):
    """
    Mark players as offline if no update received for offline_threshold seconds.
    
    Args:
        players_db: Dictionary of players
        offline_threshold: Time in seconds (default 300 = 5 minutes)
    """
    now = datetime.now()
    
    for player_id, player in players_db.items():
        last_update = datetime.fromisoformat(player['timestamp'])
        time_since_update = (now - last_update).total_seconds()
        
        if time_since_update > offline_threshold:
            player['is_online'] = False
            player['status'] = 'Offline'


def format_time_ago(timestamp_str):
    """
    Format timestamp as 'X minutes ago', 'X hours ago', etc.
    
    Args:
        timestamp_str: ISO format timestamp string
    
    Returns:
        Formatted time string
    """
    try:
        timestamp = datetime.fromisoformat(timestamp_str)
        now = datetime.now()
        diff = now - timestamp
        
        seconds = diff.total_seconds()
        
        if seconds < 60:
            return "Just now"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f"{minutes}m ago"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f"{hours}h ago"
        else:
            days = int(seconds / 86400)
            return f"{days}d ago"
    except:
        return "Unknown"


def is_valid_coordinate(latitude, longitude):
    """Return True if lat/lon are usable WGS84 coordinates."""
    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return False
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0


def recalculate_player_distance_status(player):
    """Update distance and status for one player from current ground in config."""
    if player.get('latitude') is None or player.get('longitude') is None:
        return
    distance = calculate_distance(
        float(player['latitude']),
        float(player['longitude']),
        float(config.GROUND_LATITUDE),
        float(config.GROUND_LONGITUDE),
    )
    player['distance'] = round(distance, 2)
    if player.get('is_online'):
        player['status'] = get_player_status(distance)
    else:
        player['status'] = 'Offline'


def recalculate_all_players_distances(players_db):
    """Recalculate every player after ground location changes."""
    for player in players_db.values():
        recalculate_player_distance_status(player)


def player_has_map_location(player):
    """Player can be shown on the live map."""
    if not player.get('is_online'):
        return False
    if player.get('latitude') is None or player.get('longitude') is None:
        return False
    if player.get('has_gps') is False:
        return False
    return is_valid_coordinate(player['latitude'], player['longitude'])


def get_match_readiness(num_players):
    """
    Determine match readiness based on number of players.
    
    Args:
        num_players: Number of players at ground
    
    Returns:
        Dictionary with status, color, and message
    """
    if num_players < config.MIN_PLAYERS_FOR_FULL_MATCH:
        return {
            "status": "Not Enough Players",
            "color": "red",
            "message": f"Need {config.MIN_PLAYERS_FOR_FULL_MATCH - num_players} more for full match"
        }
    return {
        "status": "Full Match Ready",
        "color": "green",
        "message": f"{num_players} players ready for full match!"
    }
