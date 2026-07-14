import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import config
import logging
import json

logger = logging.getLogger(__name__)

# Connection pool
db_pool = None

def init_db_pool():
    global db_pool
    if config.DATABASE_URL:
        try:
            db_pool = psycopg2.pool.SimpleConnectionPool(
                1, 20, config.DATABASE_URL
            )
            if db_pool:
                logger.info("Connection pool created successfully")
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise e
    else:
        logger.warning("DATABASE_URL not set in config.")

def get_db_connection():
    if not db_pool:
        raise Exception("Database connection pool not initialized")
    return db_pool.getconn()

def release_db_connection(conn):
    if db_pool and conn:
        db_pool.putconn(conn)

def init_db():
    """Create tables if they don't exist"""
    init_db_pool()
    
    if not db_pool:
        return

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # players table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS players (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    team VARCHAR(255),
                    jersey INTEGER,
                    latitude FLOAT,
                    longitude FLOAT,
                    timestamp TIMESTAMP,
                    status VARCHAR(50),
                    distance FLOAT,
                    is_online BOOLEAN DEFAULT TRUE,
                    profile_picture VARCHAR(255),
                    picture_label VARCHAR(255),
                    has_gps BOOLEAN DEFAULT FALSE,
                    location_vote VARCHAR(50),
                    location_vote_at TIMESTAMP
                );
            """)

            # attendance_stats table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS attendance_stats (
                    player_id VARCHAR(36) PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
                    visits INTEGER DEFAULT 0,
                    last_visit TIMESTAMP,
                    arrival_times JSONB,
                    consecutive_streak INTEGER DEFAULT 0,
                    total_attendance_percentage INTEGER DEFAULT 0
                );
            """)
            
            conn.commit()
            logger.info("Database initialized successfully.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Database initialization failed: {e}")
    finally:
        release_db_connection(conn)

def query_db(query, args=(), one=False):
    """Execute query and fetch results as dict"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            if query.strip().upper().startswith("SELECT"):
                rv = cur.fetchall()
                # psycopg2 returns datetime objects, but our app expects ISO strings in some places
                # We'll let the application layer handle formatting
                return (rv[0] if rv else None) if one else rv
            else:
                conn.commit()
                return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_db_connection(conn)
