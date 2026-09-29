import os
import hashlib
import binascii
from .connections import get_connection

def hash_password(password: str) -> str:
    """Hash a password for storing."""
    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), 
                                salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return (salt + pwdhash).decode('ascii')

def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify a stored password against one provided by user"""
    salt = stored_password[:64].encode('ascii')
    stored_hash = stored_password[64:]
    pwdhash = hashlib.pbkdf2_hmac('sha512', 
                                  provided_password.encode('utf-8'), 
                                  salt, 
                                  100000)
    pwdhash = binascii.hexlify(pwdhash).decode('ascii')
    return pwdhash == stored_hash

def create_user(username, password, public_key=None):
    """
    Hashes the password and creates a new user.
    Returns the user_id if successful. Raises Exception on duplicate username.
    """
    password_hash = hash_password(password)
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash, public_key) VALUES (?, ?, ?)",
            (username, password_hash, public_key)
        )
        conn.commit()
        return cursor.lastrowid
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def authenticate_user(username, password):
    """
    Verifies user credentials.
    Returns user dict if successful, else None.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if row:
            if verify_password(row['password_hash'], password):
                return dict(row)
        return None
    finally:
        conn.close()

def get_public_keys(usernames):
    """Returns a dict mapping username to public_key for requested users."""
    if not usernames: return {}
    conn = get_connection()
    try:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(usernames))
        cursor.execute(f"SELECT username, public_key FROM users WHERE username IN ({placeholders})", tuple(usernames))
        return {row['username']: row['public_key'] for row in cursor.fetchall()}
    finally:
        conn.close()

import uuid

def save_email(sender_id, subject, body_text, recipients_list, attachments_list=None):
    """Saves email to db and writes attachments to disk."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO emails (sender_id, subject, body_text) VALUES (?, ?, ?)",
            (sender_id, subject, body_text)
        )
        email_id = cursor.lastrowid
        
        # Insert recipients
        for rec in recipients_list:
            cursor.execute("SELECT id FROM users WHERE username = ?", (rec.strip(),))
            u_row = cursor.fetchone()
            if u_row:
                cursor.execute(
                    "INSERT INTO recipients (email_id, user_id) VALUES (?, ?)",
                    (email_id, u_row['id'])
                )
                
        # Handle attachments
        if attachments_list:
            att_dir = os.path.join(os.path.dirname(__file__), "..", "attachments")
            os.makedirs(att_dir, exist_ok=True)
            
            for att in attachments_list:
                safe_filename = f"{email_id}_{uuid.uuid4().hex}_{os.path.basename(att['filename'])}"
                file_path = os.path.join(att_dir, safe_filename)
                
                with open(file_path, 'wb') as f:
                    f.write(att['content'])
                    
                cursor.execute(
                    "INSERT INTO attachments (email_id, filename, mime_type, file_path) VALUES (?, ?, ?, ?)",
                    (email_id, att['filename'], att['mime_type'], file_path)
                )
                
        conn.commit()
        return email_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_inbox(user_id, search="", limit=20, offset=0):
    """Returns lightweight inbox summaries for user with search and pagination."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        query = """
            SELECT e.id, u.username as sender, e.subject, e.timestamp, r.is_read 
            FROM emails e
            JOIN recipients r ON e.id = r.email_id
            JOIN users u ON e.sender_id = u.id
            WHERE r.user_id = ? AND r.is_deleted = 0
        """
        params = [user_id]
        
        if search:
            query += " AND (e.subject LIKE ? OR u.username LIKE ?)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term])
            
        query += " ORDER BY e.timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, tuple(params))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def get_email(email_id, user_id):
    """Gets full email details and marks it as read."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE recipients SET is_read = 1 WHERE email_id = ? AND user_id = ?", (email_id, user_id))
        if cursor.rowcount == 0:
            return None # Not found or access denied
            
        cursor.execute("""
            SELECT e.id, u.username as sender, e.subject, e.body_text, e.timestamp 
            FROM emails e
            JOIN users u ON e.sender_id = u.id
            WHERE e.id = ?
        """, (email_id,))
        email_data = cursor.fetchone()
        
        if not email_data:
            return None
            
        result = dict(email_data)
        
        cursor.execute("SELECT id, filename, mime_type, file_path FROM attachments WHERE email_id = ?", (email_id,))
        result['attachments'] = [dict(row) for row in cursor.fetchall()]
        
        conn.commit()
        return result
    finally:
        conn.close()

def delete_email(email_id, user_id):
    """Marks an email as deleted for a user."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE recipients SET is_deleted = 1 WHERE email_id = ? AND user_id = ?", (email_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()
