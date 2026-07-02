"""Configuration settings for VolleyTrack backend"""
import os
from datetime import datetime

# Ground location (Configurable) - Set to your actual ground using the app's "Use My Location as Ground" button
GROUND_LATITUDE = 17.4811  # Hyderabad, Telangana (default - update via app)
GROUND_LONGITUDE = 78.5286

# Distance thresholds (in meters)
AT_GROUND_RADIUS = 100
NEARBY_RADIUS = 500
ON_THE_WAY_RADIUS = 2000

# Time settings
LOCATION_UPDATE_INTERVAL = 30  # seconds
OFFLINE_THRESHOLD = 300  # 5 minutes in seconds

# Match readiness settings
MIN_PLAYERS_FOR_FULL_MATCH = 12

# Server configuration
DEBUG = True
HOST = "0.0.0.0"
PORT = 5000

# CORS configuration
CORS_ORIGINS = ["*"]  # In production, specify exact origins

# Admin Configuration
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "volleyadmin")

# Upload Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
MOMENTS_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'moments')
PROFILES_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
