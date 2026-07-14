"""Configuration settings for VolleyTrack backend"""
import os
from dotenv import load_dotenv

# Try to load .env from backend directory, then fallback to frontend directory
load_dotenv()
if not os.environ.get("DATABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'frontend', '.env'))

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Server configuration
# Set FLASK_DEBUG=0 in production environment variables
DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 5000))

# Flask secret key (used for session signing — set in env for production)
SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(32).hex())

# CORS configuration
# Set CORS_ORIGINS env var as comma-separated domains in production
# e.g. CORS_ORIGINS=https://volley-htbr.onrender.com,http://localhost:3000
_cors_env = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else ["*"]

# Admin Configuration — MUST be set via environment variables in production
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

# Upload Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
MOMENTS_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'moments')
PROFILES_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
