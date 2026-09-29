import base64
import json
import hmac
import hashlib
import time

# In a real production app, this would be loaded from environment variables
SECRET_KEY = b'advanced_tcp_mail_secret_key_2026'

def _b64_encode(data: bytes) -> str:
    """Helper to do base64 url-safe encoding without padding"""
    return base64.urlsafe_b64encode(data).decode('ascii').rstrip("=")

def _b64_decode(data: str) -> bytes:
    """Helper to do base64 url-safe decoding with padding handling"""
    padding = "=" * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(user_id: int, expiration_minutes: int = 120) -> str:
    """Generates a secure JSON Web Token manually without external libraries."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id, 
        "exp": int(time.time()) + (expiration_minutes * 60)
    }
    
    b64_header = _b64_encode(json.dumps(header).encode('utf-8'))
    b64_payload = _b64_encode(json.dumps(payload).encode('utf-8'))
    
    # Create the HMAC SHA-256 signature
    signature_base = f"{b64_header}.{b64_payload}".encode('utf-8')
    signature = hmac.new(SECRET_KEY, signature_base, hashlib.sha256).digest()
    b64_signature = _b64_encode(signature)
    
    return f"{b64_header}.{b64_payload}.{b64_signature}"

def verify_jwt(token: str):
    """Verifies a JWT signature and expiration. Returns user_id if valid, else None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
            
        b64_header, b64_payload, b64_signature = parts
        
        # Verify the signature
        signature_base = f"{b64_header}.{b64_payload}".encode('utf-8')
        expected_signature = hmac.new(SECRET_KEY, signature_base, hashlib.sha256).digest()
        expected_b64_signature = _b64_encode(expected_signature)
        
        # Prevent timing attacks using compare_digest
        if not hmac.compare_digest(b64_signature, expected_b64_signature):
            return None
            
        # Verify expiration
        payload = json.loads(_b64_decode(b64_payload))
        if payload.get("exp", 0) < time.time():
            return None # Token expired
            
        return payload.get("user_id")
    except Exception as e:
        print(f"JWT Verification Error: {e}")
        return None
