import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "/app/data/nosso_mapa.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS places (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            google_place_id TEXT,
            lat             REAL NOT NULL,
            lng             REAL NOT NULL,
            status          TEXT NOT NULL DEFAULT 'to_go',
            alias           TEXT,
            description     TEXT,
            deleted_at      DATETIME,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS place_categories (
            place_id    INTEGER NOT NULL REFERENCES places(id),
            category_id INTEGER NOT NULL REFERENCES categories(id),
            PRIMARY KEY (place_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id   INTEGER NOT NULL REFERENCES places(id),
            reviewer   TEXT NOT NULL,
            rating     REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        INSERT OR IGNORE INTO categories (name) VALUES
            ('Restaurante'), ('Café'), ('Museu'), ('Cinema'), ('Lanche');
    """)
    # Migrate existing DBs — silently skip if columns already exist
    for ddl in [
        "ALTER TABLE places ADD COLUMN alias TEXT",
        "ALTER TABLE places ADD COLUMN description TEXT",
        "ALTER TABLE places ADD COLUMN deleted_at DATETIME",
    ]:
        try:
            conn.execute(ddl)
        except Exception:
            pass
    conn.commit()
    conn.close()
