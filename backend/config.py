"""Configuration settings for VolleyTrack backend"""
import os
from datetime import datetime
from dotenv import load_dotenv

# Try to load .env from backend directory, then fallback to frontend directory
load_dotenv()
if not os.environ.get("DATABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'frontend', '.env'))

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Server configuration
DEBUG = True
HOST = "0.0.0.0"
PORT = 5000

# CORS configuration
CORS_ORIGINS = ["*"]  # In production, specify exact origins

# Admin Configuration
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

# Upload Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
MOMENTS_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'moments')
PROFILES_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
