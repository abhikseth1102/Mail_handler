import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "mail.db")

def get_connection():
    """
    Returns a new SQLite connection with foreign keys enabled
    and row_factory set to sqlite3.Row for easy dict-like access.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
