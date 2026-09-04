import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "mail.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create USERS table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create EMAILS table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            subject TEXT,
            body_text TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users (id)
        )
    """)

    # Create index on sender_id
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_emails_sender_id ON emails(sender_id)")

    # Create RECIPIENTS table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipients (
            email_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_read BOOLEAN DEFAULT 0,
            is_deleted BOOLEAN DEFAULT 0,
            PRIMARY KEY (email_id, user_id),
            FOREIGN KEY (email_id) REFERENCES emails (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    # Create index on user_id for fast inbox reads
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON recipients(user_id)")

    # Create ATTACHMENTS table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            FOREIGN KEY (email_id) REFERENCES emails (id)
        )
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
