#!/bin/sh
# Capture one real TCP connection on a private loopback (a new user + network namespace, no sudo needed).
# The client connects, sends "hello", and closes first. The server reads, waits, then closes.
# Output: tcpdump lines with absolute sequence numbers (-S). model.mjs compares them with its own trace.
#   unshare -rn sh capture.sh > capture.txt
set -e
ip link set lo up
tcpdump -Z root -i lo -nn -S -l -c 9 'tcp port 8080' 2>/dev/null &
DUMP=$!
python3 - <<'EOF'
import socket, threading, time
srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("127.0.0.1", 8080)); srv.listen(1)
def serve():
    conn, _ = srv.accept()
    while conn.recv(100):
        pass                      # read "hello", then the client's FIN (recv returns b"")
    time.sleep(0.3)               # keep the ACK of the FIN and our own FIN in separate segments
    conn.close()
t = threading.Thread(target=serve); t.start()
time.sleep(1.0)                   # let tcpdump start
c = socket.create_connection(("127.0.0.1", 8080))
time.sleep(0.2)
c.sendall(b"hello")
time.sleep(0.2)
c.close()
t.join()
time.sleep(0.5)
EOF
wait $DUMP
