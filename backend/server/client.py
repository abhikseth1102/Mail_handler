import socket
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from protocol import send_message, receive_message
from mime.encoder import create_mime_email

HOST = "127.0.0.1"
PORT = 5000

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((HOST, PORT))
        print("Connected to server.")
        
        # 1. Register User 2
        send_message(s, "REGISTER", b"user2:pass2")
        print("REG:", receive_message(s))
        
        # 2. Login User 2
        send_message(s, "LOGIN", b"user2:pass2")
        print("LOG:", receive_message(s))
        
        # 3. Send Email from user2 to username
        mime_bytes = create_mime_email(
            sender="user2",
            recipients=["username"], # 'username' was registered in the previous run
            subject="Hello from user2!",
            body_text="This is a test email with an attachment.",
            attachments=[{'filename': 'hello.txt', 'mime_type': 'text/plain', 'content': b'Hello world attachment!'}]
        )
        send_message(s, "SEND_EMAIL", mime_bytes)
        print("SEND:", receive_message(s))
        
        # 4. Logout User 2
        send_message(s, "LOGOUT", b"")
        print("LOGOUT:", receive_message(s))
        
    finally:
        s.close()
        
    # Second connection for user 1
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((HOST, PORT))
        send_message(s, "LOGIN", b"username:password")
        print("LOG1:", receive_message(s))
        
        # Get Inbox
        send_message(s, "GET_INBOX", b"")
        verb, payload = receive_message(s)
        print("INBOX:", verb, payload.decode())
        
        inbox = json.loads(payload.decode())
        if inbox:
            email_id = str(inbox[0]['id']).encode()
            
            # Get Email
            send_message(s, "GET_EMAIL", email_id)
            verb, payload = receive_message(s)
            print("EMAIL:", verb, payload.decode()[:200], "...")
            
    finally:
        s.close()

if __name__ == "__main__":
    main()