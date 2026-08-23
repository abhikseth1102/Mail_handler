import socket

HOST = "127.0.0.1"
PORT = 5000

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind((HOST, PORT))
s.listen()

print(f"Server running on {HOST}:{PORT}")


while True:
    conn, addr = s.accept()

    print("Client connected:", addr)

    header = b""

    while b"\n" not in header:
        header += conn.recv(1)

    size = int(header.decode().strip())

    data = b""

    while len(data) < size:
        chunk = conn.recv(min(4096, size - len(data)))
        data += chunk

    print("Received:", data.decode())

    conn.sendall(b"Message received!")

    conn.close()