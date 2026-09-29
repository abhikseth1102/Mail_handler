import socket
import threading
import sys
import os
import sqlite3
import json
import base64
import time

# Allow importing from the db and mime modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from protocol import receive_message, send_message
from db.queries import create_user, authenticate_user, save_email, get_inbox, get_email, delete_email
from db.models import init_db
from mime.decoder import parse_mime_email

# Initialize DB tables on startup
init_db()

HOST = os.environ.get('TCP_HOST', '0.0.0.0')
PORT = int(os.environ.get('TCP_PORT', 5000))

# --- SECURITY: DDoS Protection & Rate Limiting ---
RATE_LIMIT_LOCK = threading.Lock()
IP_CONNECTIONS = {}
MAX_CONNECTIONS_PER_MINUTE = 1000  # Allows Next.js API, blocks infinite loops

def is_rate_limited(ip_address):
    with RATE_LIMIT_LOCK:
        current_time = time.time()
        if ip_address not in IP_CONNECTIONS:
            IP_CONNECTIONS[ip_address] = []
        
        # Keep timestamps from the last 60 seconds
        IP_CONNECTIONS[ip_address] = [t for t in IP_CONNECTIONS[ip_address] if current_time - t < 60]
        
        if len(IP_CONNECTIONS[ip_address]) >= MAX_CONNECTIONS_PER_MINUTE:
            return True
        
        IP_CONNECTIONS[ip_address].append(current_time)
        return False
# -------------------------------------------------

from jwt_util import create_jwt, verify_jwt

def handle_client(conn, addr):
    print(f"[NEW CONNECTION] {addr} connected.")
    current_user_id = None
    try:
        while True:
            verb, payload = receive_message(conn)
            print(f"[{addr}] Received Command: {verb}, Payload size: {len(payload)}")
            
            if verb == "REGISTER":
                try:
                    payload_str = payload.decode('utf-8')
                    username, password = payload_str.split(':', 1)
                    user_id = create_user(username, password)
                    token = create_jwt(user_id)
                    send_message(conn, "200", token.encode('utf-8'))
                except sqlite3.IntegrityError:
                    send_message(conn, "400", b"Username already exists")
                except ValueError:
                    send_message(conn, "400", b"Invalid payload format")
            
            elif verb == "LOGIN":
                try:
                    payload_str = payload.decode('utf-8')
                    username, password = payload_str.split(':', 1)
                    user = authenticate_user(username, password)
                    if user:
                        current_user_id = user['id']
                        token = create_jwt(current_user_id)
                        send_message(conn, "200", token.encode('utf-8'))
                    else:
                        send_message(conn, "401", b"Invalid username or password")
                except ValueError:
                    send_message(conn, "400", b"Invalid payload format")

            elif verb == "AUTH":
                token = payload.decode('utf-8').strip()
                user_id = verify_jwt(token)
                if user_id:
                    current_user_id = user_id
                    send_message(conn, "200", b"Authenticated")
                else:
                    send_message(conn, "401", b"Invalid or expired JWT")

            elif verb == "LOGOUT":
                current_user_id = None
                send_message(conn, "200", b"Logout successful")
                break # close connection
                
            elif verb == "SEND_EMAIL":
                if not current_user_id:
                    send_message(conn, "401", b"Unauthorized")
                    continue
                try:
                    email_data = parse_mime_email(payload)
                    recipients = [r.strip() for r in email_data['headers']['To'].split(',') if r.strip()]
                    email_id = save_email(
                        current_user_id,
                        email_data['headers']['Subject'],
                        email_data['body_text'],
                        recipients,
                        email_data['attachments']
                    )
                    send_message(conn, "200", f"Email sent with ID: {email_id}".encode('utf-8'))
                except Exception as e:
                    send_message(conn, "500", f"Server error: {e}".encode('utf-8'))
                    
            elif verb == "GET_INBOX":
                if not current_user_id:
                    send_message(conn, "401", b"Unauthorized")
                    continue
                try:
                    search = ""
                    limit = 20
                    offset = 0
                    if payload:
                        req_data = json.loads(payload.decode('utf-8'))
                        search = req_data.get("search", "")
                        page = max(1, req_data.get("page", 1))
                        offset = (page - 1) * limit
                        
                    inbox = get_inbox(current_user_id, search, limit, offset)
                    send_message(conn, "200", json.dumps(inbox).encode('utf-8'))
                except Exception as e:
                    send_message(conn, "500", f"Server error: {e}".encode('utf-8'))
                    
            elif verb == "GET_EMAIL":
                if not current_user_id:
                    send_message(conn, "401", b"Unauthorized")
                    continue
                try:
                    email_id = int(payload.decode('utf-8').strip())
                    email_data = get_email(email_id, current_user_id)
                    if email_data:
                        # Include attachments as base64 in the JSON response
                        for att in email_data.get('attachments', []):
                            if os.path.exists(att['file_path']):
                                with open(att['file_path'], 'rb') as f:
                                    att['content_base64'] = base64.b64encode(f.read()).decode('ascii')
                        send_message(conn, "200", json.dumps(email_data).encode('utf-8'))
                    else:
                        send_message(conn, "404", b"Email not found")
                except ValueError:
                    send_message(conn, "400", b"Invalid email ID")
                except Exception as e:
                    send_message(conn, "500", f"Server error: {e}".encode('utf-8'))
                    
            elif verb == "DELETE_EMAIL":
                if not current_user_id:
                    send_message(conn, "401", b"Unauthorized")
                    continue
                try:
                    email_id = int(payload.decode('utf-8').strip())
                    success = delete_email(email_id, current_user_id)
                    if success:
                        send_message(conn, "200", b"Email deleted")
                    else:
                        send_message(conn, "404", b"Email not found")
                except ValueError:
                    send_message(conn, "400", b"Invalid email ID")
            
            else:
                send_message(conn, "400", f"Unknown command: {verb}".encode('utf-8'))
                
    except (ConnectionError, ValueError) as e:
        print(f"[{addr}] Error/Disconnected: {e}")
    finally:
        conn.close()
        print(f"[DISCONNECTED] {addr} disconnected.")

def start_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind((HOST, PORT))
    s.listen()
    print(f"[LISTENING] Server is listening on {HOST}:{PORT}")

    while True:
        try:
            conn, addr = s.accept()
            ip = addr[0]
            
            if is_rate_limited(ip):
                print(f"[SECURITY] Blocking {ip} due to rate limiting (DDoS Protection).")
                send_message(conn, "429", b"Too Many Requests")
                conn.close()
                continue
                
            thread = threading.Thread(target=handle_client, args=(conn, addr))
            thread.start()
            print(f"[ACTIVE CONNECTIONS] {threading.active_count() - 1}")
        except KeyboardInterrupt:
            print("\nShutting down server...")
            break
            
    s.close()

if __name__ == "__main__":
    start_server()