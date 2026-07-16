"""Configuration settings for VolleyTrack backend"""
import os
from dotenv import load_dotenv

# Try to load .env from backend directory, then fallback to frontend directory
load_dotenv()
if not os.environ.get("DATABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'frontend', '.env'))

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Server configuration
DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 5000))

# Flask secret key
SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(32).hex())

# CORS configuration
_cors_env = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else ["*"]

# Admin Configuration
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

# ─── Supabase Storage Configuration ───────────────────────────────────────────
# Set these in your Render environment variables.
# SUPABASE_URL: Your project URL (e.g. https://xxxxx.supabase.co)
# SUPABASE_SERVICE_KEY: The service_role key (secret — never expose to frontend)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_BUCKET = "volleytrack-images"

# Local upload folders (kept as fallback; new uploads go to Supabase Storage)
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
MOMENTS_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'moments')
PROFILES_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
