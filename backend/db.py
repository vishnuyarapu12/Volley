import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import config
import logging

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
    """Create tables if they don't exist, and run safe migrations."""
    init_db_pool()
    
    if not db_pool:
        return

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # ── Players table ──────────────────────────────────────────────
            cur.execute("""
                CREATE TABLE IF NOT EXISTS players (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(100),
                    team VARCHAR(255),
                    jersey INTEGER,
                    profile_picture TEXT,
                    picture_label VARCHAR(255)
                );
            """)

            # ── Moments table (new — stores Supabase URLs) ────────────────
            cur.execute("""
                CREATE TABLE IF NOT EXISTS moments (
                    id VARCHAR(36) PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    storage_path VARCHAR(500),
                    uploaded_at TIMESTAMP DEFAULT NOW()
                );
            """)

            # ── Safe migrations ────────────────────────────────────────────
            # Widen profile_picture to TEXT if it's still VARCHAR(255)
            cur.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'players'
                          AND column_name = 'profile_picture'
                          AND data_type = 'character varying'
                          AND character_maximum_length = 255
                    ) THEN
                        ALTER TABLE players ALTER COLUMN profile_picture TYPE TEXT;
                    END IF;
                END $$;
            """)

            conn.commit()
            logger.info("Database initialized successfully.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Database initialization failed: {e}")
    finally:
        release_db_connection(conn)

def query_db(query, args=(), one=False):
    """Execute query and fetch results as dict."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            if query.strip().upper().startswith("SELECT"):
                rv = cur.fetchall()
                return (rv[0] if rv else None) if one else rv
            else:
                conn.commit()
                return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_db_connection(conn)
