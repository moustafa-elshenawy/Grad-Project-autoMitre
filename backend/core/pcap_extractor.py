import struct
import socket
import collections
import datetime
import os

def parse_ip(data, offset):
    if len(data) < offset + 20: return None
    ihl = (data[offset] & 0x0F) * 4
    if len(data) < offset + ihl: return None
    proto = data[offset+9]
    src_ip = socket.inet_ntoa(data[offset+12:offset+16])
    dst_ip = socket.inet_ntoa(data[offset+16:offset+20])
    return {
        'ihl': ihl, 'proto': proto, 
        'src': src_ip, 'dst': dst_ip, 
        'total_offset': offset + ihl
    }

def parse_tcp(data, offset):
    if len(data) < offset + 20: return None
    src_port = struct.unpack('>H', data[offset:offset+2])[0]
    dst_port = struct.unpack('>H', data[offset+2:offset+4])[0]
    seq      = struct.unpack('>I', data[offset+4:offset+8])[0]
    ack      = struct.unpack('>I', data[offset+8:offset+12])[0]
    data_offset = ((data[offset+12] >> 4) * 4)
    if len(data) < offset + data_offset: return None
    flags = data[offset+13]
    return {
        'src_port': src_port, 'dst_port': dst_port, 'seq': seq, 'ack': ack,
        'syn': bool(flags & 0x02), 'ack_f': bool(flags & 0x10),
        'fin': bool(flags & 0x01), 'rst': bool(flags & 0x04),
        'psh': bool(flags & 0x08), 'data_offset': data_offset
    }

def analyze_pcap(filepath):
    try:
        with open(filepath, 'rb') as f:
            magic = f.read(4)
            if len(magic) < 4:
                return {'error': 'File too short to be a valid capture.'}
                
            if magic in (b'\x0a\x0d\x0d\x0a',):
                return {'error': 'This file uses the modern PCAPNG format. The standalone extractor strictly requires the legacy libpcap (.pcap) format. Please save/export as .pcap in Wireshark.'}

            if magic not in (b'\xd4\xc3\xb2\xa1', b'\xa1\xb2\xc3\xd4', b'\x4d\x3c\xb2\xa1', b'\xa1\xb2\x3c\x4d'):
                return {'error': 'Not a valid libpcap file (unsupported magic signature). Make sure it is saved as standard tcpdump pcap.'}
                
            endian = '<' if magic in (b'\xd4\xc3\xb2\xa1', b'\x4d\x3c\xb2\xa1') else '>'
            
            ver_major, ver_minor, thiszone, sigfigs, snaplen, network = struct.unpack(endian + 'HHiIII', f.read(20))
            
            if network == 113:
                link_offset = 16
            elif network == 1:
                link_offset = 14
            else:
                return {'error': f'Unsupported link-layer type: {network}'}
            
            packets = []
            while True:
                rec_hdr = f.read(16)
                if len(rec_hdr) < 16: break
                ts_sec, ts_usec, incl_len, orig_len = struct.unpack(endian + 'IIII', rec_hdr)
                data = f.read(incl_len)
                if len(data) < incl_len: break
                packets.append((ts_sec, ts_usec, data, orig_len))
    except Exception as e:
        return {'error': str(e)}

    # Check if empty
    if not packets:
        return {'error': 'No packets found in PCAP'}

    start_ts_sec = packets[0][0]
    start_ts_full = packets[0][0] + packets[0][1]/1e6
    end_ts_full = packets[-1][0] + packets[-1][1]/1e6
    duration = max(end_ts_full - start_ts_full, 0.001)
    
    protocols = {'TCP': 0, 'UDP': 0, 'ICMP': 0}
    hosts = set()
    
    syn_packets = []  # (ts, src, dst, sport, dport)
    rst_packets = set() # (src, dst, sport, dport)
    syn_ack_packets = set()
    
    tcp_sessions = collections.defaultdict(list) # canon_key -> list of events
    seen_seq = {} # (src, dst, sport, dport, seq) -> first_ts
    retransmissions = []
    
    dns_ptr_queries = collections.defaultdict(list) # src -> list of ts
    
    buckets = collections.defaultdict(int)
    flow_buckets = collections.defaultdict(lambda: collections.defaultdict(int))
    
    for ts_sec, ts_usec, data, orig_len in packets:
        ts = ts_sec + ts_usec / 1e6
        buckets[(ts_sec - start_ts_sec) // 10] += 1
        
        ip = parse_ip(data, link_offset)
        if not ip: continue
        
        hosts.add(ip['src'])
        hosts.add(ip['dst'])
        
        flow_endpoints = (ip['src'], ip['dst'])
        flow_buckets[(ts_sec - start_ts_sec) // 10][flow_endpoints] += 1
        
        if ip['proto'] == 6:  # TCP
            protocols['TCP'] += 1
            tcp = parse_tcp(data, ip['total_offset'])
            if not tcp: continue
            
            payload_start = ip['total_offset'] + tcp['data_offset']
            payload = data[payload_start:]
            
            if tcp['syn'] and not tcp['ack_f']:
                syn_packets.append((ts, ip['src'], ip['dst'], tcp['src_port'], tcp['dst_port']))
            if tcp['syn'] and tcp['ack_f']:
                syn_ack_packets.add((ip['src'], ip['dst'], tcp['src_port'], tcp['dst_port']))
            if tcp['rst']:
                rst_packets.add((ip['src'], ip['dst'], tcp['src_port'], tcp['dst_port']))
            
            key = (ip['src'], ip['dst'], tcp['src_port'], tcp['dst_port'], tcp['seq'])
            if payload:
                if key in seen_seq:
                    retransmissions.append((ts, seen_seq[key], ip['src'], tcp['dst_port'], len(payload)))
                else:
                    seen_seq[key] = ts
                    
            canon_key = tuple(sorted([f"{ip['src']}:{tcp['src_port']}", f"{ip['dst']}:{tcp['dst_port']}"]))
            tcp_sessions[canon_key].append({
                'ts': ts,
                'src': ip['src'], 'sport': tcp['src_port'],
                'dst': ip['dst'], 'dport': tcp['dst_port'],
                'payload_len': len(payload),
                'syn': tcp['syn'], 'payload': payload
            })

        elif ip['proto'] == 17:  # UDP
            protocols['UDP'] += 1
            offset = ip['total_offset'] + 8
            udp_payload = data[offset:]
            if b'in-addr' in udp_payload and b'arpa' in udp_payload:
                dns_ptr_queries[ip['src']].append((ts, udp_payload))
                
        elif ip['proto'] == 1:  # ICMP
            protocols['ICMP'] += 1

    attacks = []
    iocs = {'ips': set(), 'ports': set(), 'signatures': set()}
    
    # 1. TCP SYN Port Scan
    syn_by_src_dst = collections.defaultdict(list)
    for ts, src, dst, sport, dport in syn_packets:
        syn_by_src_dst[(src, dst)].append((ts, sport, dport))
        
    for (src, dst), events in syn_by_src_dst.items():
        events.sort(key=lambda x: x[0])
        n = len(events)
        i = 0
        while i < n:
            window_end = events[i][0] + 60
            unique_ports = set()
            j = i
            while j < n and events[j][0] <= window_end:
                unique_ports.add(events[j][2]) # dport
                j += 1
            
            if len(unique_ports) >= 20:
                # Confirm with RST or lack of SYN-ACK
                rst_count = sum(1 for p in unique_ports if (dst, src, p, events[i][1]) in rst_packets)
                open_ports = sum(1 for p in unique_ports if (dst, src, p, events[i][1]) in syn_ack_packets)
                rate = len(unique_ports) / max(events[j-1][0] - events[i][0], 0.001)
                
                attacks.append({
                    'type': 'TCP SYN Port Scan',
                    'severity': 'Medium',
                    'start_ts': events[i][0],
                    'end_ts': events[j-1][0],
                    'attacker': src,
                    'target': dst,
                    'metrics': f"Scanned {len(unique_ports)} ports, Open: {open_ports}, Rate: {rate:.1f} SYN/sec",
                    'verdict': f"Source {src} scanned {len(unique_ports)} unique ports on {dst} within 60s."
                })
                iocs['ips'].add(src)
                iocs['ports'].update(unique_ports)
                i += j # skip ahead
            else:
                i += 1

    # 2. TCP SYN Flood (DoS)
    syn_by_target = collections.defaultdict(list)
    for ts, src, dst, sport, dport in syn_packets:
        syn_by_target[(src, dst, dport)].append(ts)
        
    for (src, dst, dport), timestamps in syn_by_target.items():
        timestamps.sort()
        n = len(timestamps)
        i = 0
        while i < n:
            window_end = timestamps[i] + 30
            j = i
            while j < n and timestamps[j] <= window_end:
                j += 1
            count = j - i
            if count >= 500:
                rate = count / max(timestamps[j-1] - timestamps[i], 0.001)
                attacks.append({
                    'type': 'TCP SYN Flood (DoS)',
                    'severity': 'High',
                    'start_ts': timestamps[i],
                    'end_ts': timestamps[j-1],
                    'attacker': src,
                    'target': f"{dst}:{dport}",
                    'metrics': f"SYN count: {count}, Rate: {rate:.1f}/sec",
                    'verdict': f"Source {src} flooded {dst}:{dport} with {count} SYN packets without completing handshake."
                })
                iocs['ips'].add(src)
                iocs['ports'].add(dport)
                i += j
            else:
                i += 1

    # 3. SSH Session Replay Attack
    for canon_key, pkts in tcp_sessions.items():
        client_node = server_node = None
        for p in pkts:
            if b'SSH-2.0-' in p['payload'][:32]:
                server_node = (p['src'], p['sport'])
                client_node = (p['dst'], p['dport'])
                break
        
        if server_node and client_node:
            client_bytes = server_bytes = 0
            first_client_ts = first_server_ts = None
            
            for p in pkts:
                if (p['src'], p['sport']) == client_node:
                    client_bytes += p['payload_len']
                    if first_client_ts is None and p['payload_len'] > 0:
                        first_client_ts = p['ts']
                elif (p['src'], p['sport']) == server_node:
                    server_bytes += p['payload_len']
                    if first_server_ts is None and p['payload_len'] > 0:
                        first_server_ts = p['ts']
            
            if client_bytes > 0 and server_bytes >= 50 * client_bytes:
                if first_client_ts and first_server_ts and (first_server_ts - first_client_ts) <= 1.0 and server_bytes > 1000000:
                    attacks.append({
                        'type': 'SSH Session Replay Attack',
                        'severity': 'Critical',
                        'start_ts': pkts[0]['ts'],
                        'end_ts': pkts[-1]['ts'],
                        'attacker': client_node[0],
                        'target': f"{server_node[0]}:{server_node[1]}",
                        'metrics': f"Client bytes: {client_bytes}, Server bytes: {server_bytes}, Ratio: {server_bytes/client_bytes:.1f}",
                        'verdict': f"Massive asymmetric data transfer immediately following SSH handshake implies a replay attack or unauthorized bulk extraction."
                    })
                    iocs['ips'].add(client_node[0])
                    iocs['signatures'].add('SSH-2.0- (anomaly)')

    # 4. Retransmission / Replay Detection
    if retransmissions:
        zero_delays = [r for r in retransmissions if (r[0] - r[1]) <= 0.001] # account for minor float drift or 0.0
        if len(zero_delays) >= 1 or len(retransmissions) >= 5: # Drastically lowered threshold to catch any replay!
            attacks.append({
                'type': 'TCP Retransmission / Replay Detection',
                'severity': 'Medium' if len(zero_delays) == 0 else 'High',
                'start_ts': retransmissions[0][0],
                'end_ts': retransmissions[-1][0],
                'attacker': retransmissions[0][2],
                'target': f"Port {retransmissions[0][3]}",
                'metrics': f"Total retransmissions: {len(retransmissions)}, Suspicious replays (delay ~0): {len(zero_delays)}",
                'verdict': f"Detected duplicate payload sequences. Zero-delay duplicates indicate a synthetic replay attack, whilst delayed ones indicate heavy retransmissions."
            })
            iocs['ips'].add(retransmissions[0][2])

    # 5. Java RMI Exploitation
    rmi_connections = [(p['src'], p['dst']) for pkts in tcp_sessions.values() for p in pkts if p['dport'] == 1099]
    for rmi_client, rmi_server in set(rmi_connections):
        for pkts in tcp_sessions.values():
            for p in pkts:
                if p['src'] == rmi_server and p['dst'] == rmi_client and p['sport'] > 1024 and p['dport'] > 1024:
                    attacks.append({
                        'type': 'Java RMI Exploitation Pattern',
                        'severity': 'Critical',
                        'start_ts': p['ts'],
                        'end_ts': p['ts'],
                        'attacker': rmi_client,
                        'target': f"{rmi_server}:1099",
                        'metrics': f"Callback triggered to port {p['dport']}",
                        'verdict': f"Client connected to Java RMI port 1099, followed by the server connecting back to the client on a high port."
                    })
                    iocs['ips'].add(rmi_client)
                    iocs['ports'].update({1099, p['dport']})
                    break

    # 6. DNS Reconnaissance
    for src, queries in dns_ptr_queries.items():
        if len(queries) < 5: continue
        queries.sort(key=lambda x: x[0])
        n = len(queries)
        i = 0
        while i < n:
            window_end = queries[i][0] + 60
            j = i
            while j < n and queries[j][0] <= window_end:
                j += 1
            if (j - i) >= 5:
                attacks.append({
                    'type': 'DNS Reconnaissance',
                    'severity': 'Low',
                    'start_ts': queries[i][0],
                    'end_ts': queries[j-1][0],
                    'attacker': src,
                    'target': 'DNS Resolver',
                    'metrics': f"PTR lookups count: {j-i} within 60s",
                    'verdict': f"Host {src} performed rapid reverse DNS (PTR) lookups, common in network mapping."
                })
                iocs['ips'].add(src)
                i += j
            else:
                i += 1

    # 7. Protocol Anomaly / Service Probe
    sensitive_ports = {5800: 'VNC', 2628: 'DICT', 5000: 'UPnP', 6667: 'IRC', 3389: 'RDP', 445: 'SMB'}
    for ts, src, dst, sport, dport in syn_packets:
        if dport in sensitive_ports:
            has_rst = (dst, src, dport, sport) in rst_packets
            if has_rst:
                attacks.append({
                    'type': 'Protocol Anomaly / Service Probe',
                    'severity': 'Low',
                    'start_ts': ts,
                    'end_ts': ts,
                    'attacker': src,
                    'target': f"{dst}:{dport}",
                    'metrics': f"Probed {sensitive_ports[dport]} ({dport})",
                    'verdict': f"Probe detected on sensitive port {dport} ({sensitive_ports[dport]}) leading to a closed connection."
                })
                iocs['ips'].add(src)
                iocs['ports'].add(dport)

    # 8. Traffic Volume Anomaly
    if buckets:
        avg_vol = sum(buckets.values()) / len(buckets)
        for t_idx, count in buckets.items():
            if count > avg_vol * 3 and count > 100:
                top_flow = max(flow_buckets[t_idx].items(), key=lambda x: x[1])
                src, dst = top_flow[0]
                attacks.append({
                    'type': 'Traffic Volume Anomaly',
                    'severity': 'Medium',
                    'start_ts': start_ts_sec + t_idx * 10,
                    'end_ts': start_ts_sec + t_idx * 10 + 10,
                    'attacker': src,
                    'target': dst,
                    'metrics': f"Spike of {count} packets (Avg: {avg_vol:.1f}). Top flow: {top_flow[1]} pkts",
                    'verdict': f"Anomalous traffic spike > 3x the baseline. Driven primarily by {src} -> {dst}."
                })

    # Prepare string report output
    unique_attacks = []
    seen_sigs = set()
    for att in attacks:
        sig = (att['type'], att['attacker'], att['target'])
        if sig not in seen_sigs:
            seen_sigs.add(sig)
            unique_attacks.append(att)
            
    # Sort attacks by start_ts
    unique_attacks.sort(key=lambda x: x['start_ts'])

    dt_start = datetime.datetime.fromtimestamp(start_ts_full, tz=datetime.timezone.utc)
    
    rep = []
    rep.append("PCAP METADATA")
    rep.append(f"  File: {os.path.basename(filepath)}")
    rep.append(f"  Capture start: {dt_start.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    rep.append(f"  Duration: {duration:.2f} seconds (~{duration/60:.2f} min)")
    rep.append(f"  Total packets: {len(packets)}")
    rep.append(f"  Protocols: TCP {protocols['TCP']}, UDP {protocols['UDP']}, ICMP {protocols['ICMP']}")
    rep.append(f"  Hosts observed: {', '.join(sorted(list(hosts))) if hosts else 'None'}")
    rep.append("")
    rep.append("ATTACKS DETECTED")
    
    if not unique_attacks:
        rep.append("  No attacks detected.")
    else:
        for idx, att in enumerate(unique_attacks, 1):
            rep.append("  ─────────────────────────────────────")
            rep.append(f"  Attack #{idx} — {att['type']}")
            rep.append(f"  Severity: {att['severity']}")
            rep.append(f"  Time window: t={att['start_ts']:.2f}s to t={att['end_ts']:.2f}s")
            rep.append(f"  Attacker: {att['attacker']}")
            rep.append(f"  Target: {att['target']}")
            rep.append(f"  {att['metrics']}")
            rep.append(f"  Verdict: {att['verdict']}")
            
    rep.append("")
    rep.append("ATTACK CHAIN SUMMARY")
    if unique_attacks:
        chain = []
        for a in unique_attacks:
            chain.append(f"{a['attacker']} targeted {a['target']} with {a['type']}.")
        rep.append("  " + " ".join(chain[:5]) + ("..." if len(chain) > 5 else ""))
    else:
        rep.append("  No attack sequence to summarize.")
        
    rep.append("")
    rep.append("INDICATORS OF COMPROMISE")
    rep.append(f"  Attacker IPs: {', '.join(sorted(list(iocs['ips']))) if iocs['ips'] else 'None'}")
    rep.append(f"  Targeted ports: {', '.join(map(str, sorted(list(iocs['ports'])))) if iocs['ports'] else 'None'}")
    rep.append(f"  Suspicious payload signatures: {', '.join(list(iocs['signatures'])) if iocs['signatures'] else 'None'}")

    return {
        'report_text': "\n".join(rep),
        'metadata': {
            'file': filepath,
            'capture_start': start_ts_full,
            'duration': duration,
            'total_packets': len(packets),
            'protocols': protocols,
            'hosts': list(hosts)
        },
        'attacks': unique_attacks,
        'iocs': {
            'ips': list(iocs['ips']),
            'ports': list(iocs['ports']),
            'signatures': list(iocs['signatures'])
        }
    }
