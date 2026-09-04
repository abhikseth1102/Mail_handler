import socket

def send_message(conn: socket.socket, verb: str, payload: bytes = b""):
    """
    Sends a framed message over the socket.
    Format: VERB PAYLOAD_LENGTH\r\n<payload>
    """
    header = f"{verb} {len(payload)}\r\n".encode('utf-8')
    conn.sendall(header + payload)

def receive_message(conn: socket.socket):
    """
    Receives a framed message from the socket.
    Returns: (verb: str, payload: bytes)
    Raises ConnectionError if connection closes or format is invalid.
    """
    header = b""
    while b"\r\n" not in header:
        chunk = conn.recv(1)
        if not chunk:
            raise ConnectionError("Connection closed by peer")
        header += chunk
        # Prevent infinite loops if protocol is violated
        if len(header) > 1024:
            raise ValueError("Header too long")
            
    header_str = header.decode('utf-8').strip()
    parts = header_str.split(' ', 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid header format: {header_str}")
        
    verb = parts[0]
    try:
        length = int(parts[1])
    except ValueError:
        raise ValueError(f"Invalid payload length: {parts[1]}")
        
    payload = b""
    while len(payload) < length:
        chunk = conn.recv(min(4096, length - len(payload)))
        if not chunk:
            raise ConnectionError("Connection closed while receiving payload")
        payload += chunk
        
    return verb, payload
