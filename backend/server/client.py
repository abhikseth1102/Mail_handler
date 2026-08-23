import socket

HOST = "127.0.0.1"
PORT = 5000

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((HOST, PORT))

msg = "Hello mail server!"
data = msg.encode()

header = f"{len(data)}\n".encode()

s.sendall(header)
s.sendall(data)

res = s.recv(1024)

print("Server:", res.decode())

s.close()