# Captures one real TCP connection on Linux loopback and prints its segments as JSON.
# Run it through `node model.mjs --capture`: that runs it in a fresh user + network namespace
# (unshare -rn, no root needed), checks every segment against the model and rewrites capture.json.
# To run it alone and print the JSON: unshare -rn sh -c 'ip link set lo up && python3 capture.py'
# The exchange matches the figure: connect, the client sends "hello", the client closes, the server closes.
import json
import socket
import struct
import threading
import time

PORT = 8080
segments = []
sniffer = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
sniffer.bind(("lo", 0))
sniffer.settimeout(0.2)


def sniff(until):
    while time.time() < until:
        try:
            frame, addr = sniffer.recvfrom(65535)
        except socket.timeout:
            continue
        if addr[2] == socket.PACKET_OUTGOING:  # lo shows each packet twice: keep the incoming copy
            continue
        ip = frame[14:]
        if ip[9] != 6:
            continue
        ihl = (ip[0] & 0x0F) * 4
        total = struct.unpack("!H", ip[2:4])[0]
        tcp = ip[ihl:total]
        sport, dport, seq, ack, off_flags = struct.unpack("!HHIIH", tcp[:14])
        flags = off_flags & 0x3F
        names = [n for bit, n in [(0x02, "SYN"), (0x01, "FIN"), (0x08, "PSH"), (0x10, "ACK"), (0x04, "RST")] if flags & bit]
        segments.append({
            "from": "client" if dport == PORT else "server",
            "flags": names,
            "seq": seq,
            "ack": ack if flags & 0x10 else None,
            "len": len(tcp) - (off_flags >> 12) * 4,
        })


def server(listener):
    conn, _ = listener.accept()
    conn.recv(5)
    while conn.recv(100):
        pass
    time.sleep(0.2)  # keep the server's ACK of the client's FIN apart from the server's own FIN
    conn.close()


listener = socket.socket()
listener.bind(("127.0.0.1", PORT))
listener.listen(1)
watch = threading.Thread(target=sniff, args=(time.time() + 1.5,))
watch.start()
threading.Thread(target=server, args=(listener,)).start()
client = socket.create_connection(("127.0.0.1", PORT))
time.sleep(0.1)
client.sendall(b"hello")
time.sleep(0.3)  # let the server ACK the data before the client's FIN
client.close()
watch.join()
print(json.dumps(segments))
