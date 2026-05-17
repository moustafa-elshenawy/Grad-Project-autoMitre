import struct, socket, collections, datetime, os, math, re

MITRE = {
    'TCP SYN Port Scan':          ('T1046',     'Discovery'),
    'TCP Connect Scan':           ('T1046',     'Discovery'),
    'UDP Port Scan':              ('T1046',     'Discovery'),
    'XMAS / NULL Scan':           ('T1046',     'Discovery'),
    'TCP SYN Flood':              ('T1498.001', 'Impact'),
    'ICMP Flood':                 ('T1498.001', 'Impact'),
    'DNS Amplification':          ('T1498.002', 'Impact'),
    'Traffic Volume Anomaly':     ('T1498',     'Impact'),
    'HTTP Brute-Force':           ('T1110',     'Credential Access'),
    'Cleartext Credential Theft': ('T1078',     'Defense Evasion'),
    'ARP Spoofing':               ('T1557.002', 'Credential Access'),
    'SQL Injection Probe':        ('T1190',     'Initial Access'),
    'Command Injection':          ('T1059',     'Execution'),
    'XSS Probe':                  ('T1059.007', 'Execution'),
    'Java RMI Exploitation':      ('T1203',     'Execution'),
    'SSL/TLS Downgrade':          ('T1600',     'Defense Evasion'),
    'C2 Beaconing':               ('T1071',     'Command and Control'),
    'DNS Exfiltration':           ('T1048.003', 'Exfiltration'),
    'Data Exfiltration':          ('T1041',     'Exfiltration'),
    'TCP Replay Attack':          ('T1498',     'Impact'),
}

SENSITIVE_PORTS = {21:'FTP',23:'Telnet',110:'POP3',143:'IMAP',25:'SMTP',
                   5800:'VNC',3389:'RDP',445:'SMB',6667:'IRC',2628:'DICT'}

SQLI_RE = re.compile(rb'(?i)(union\s+select|or\s+1\s*=\s*1|\'--|\bdrop\s+table\b|select\s+\*\s+from)', re.I)
CMDI_RE = re.compile(rb'(?i)(cmd\.exe|/bin/sh|/bin/bash|wget\s|curl\s|eval\(|system\(|exec\(|base64\s+-d)')
XSS_RE  = re.compile(rb'(?i)(<script|javascript:|onerror\s*=|onload\s*=|alert\()')
CRED_RE = re.compile(rb'(?i)(^USER |^PASS |login:\s|password:\s)')
SSL_BAD = re.compile(rb'\x16\x03[\x00\x01]')

def _entropy(s):
    if not s: return 0.0
    c = collections.Counter(s); l = len(s)
    return -sum((v/l)*math.log2(v/l) for v in c.values())

def _parse_ip(data, off):
    if len(data) < off+20: return None
    ihl = (data[off] & 0x0F) * 4
    if len(data) < off+ihl: return None
    return {'ihl':ihl,'proto':data[off+9],
            'src':socket.inet_ntoa(data[off+12:off+16]),
            'dst':socket.inet_ntoa(data[off+16:off+20]),
            'total_offset':off+ihl}

def _parse_tcp(data, off):
    if len(data) < off+20: return None
    sp,dp = struct.unpack('>HH', data[off:off+4])
    seq,  = struct.unpack('>I',  data[off+4:off+8])
    flags = data[off+13]
    doff  = (data[off+12]>>4)*4
    return {'sport':sp,'dport':dp,'seq':seq,'flags':flags,'doff':doff,
            'syn':bool(flags&2),'ack_f':bool(flags&16),
            'rst':bool(flags&4),'fin':bool(flags&1)}

def _parse_udp(data, off):
    if len(data) < off+8: return None
    sp,dp = struct.unpack('>HH', data[off:off+4])
    return {'sport':sp,'dport':dp}

def _dns_name(data, off):
    labels=[]; visited=set()
    while off < len(data):
        if off in visited: break
        visited.add(off)
        l = data[off]
        if l == 0: off+=1; break
        if (l & 0xC0) == 0xC0:
            ptr = ((l&0x3F)<<8)|data[off+1]
            sub,_ = _dns_name(data, ptr); labels+=sub; off+=2; break
        off+=1; labels.append(data[off:off+l].decode('ascii','replace')); off+=l
    return labels, off

def _dns_qname(payload):
    if len(payload)<12: return None
    if struct.unpack('>H', payload[4:6])[0] < 1: return None
    labels,_ = _dns_name(payload, 12)
    return '.'.join(labels)

def _add(attacks, iocs, atype, sev, t0, t1, attacker, target, metrics, verdict, conf, snips=None):
    tid, tactic = MITRE.get(atype, ('T0000','Unknown'))
    attacks.append({'type':atype,'severity':sev,'start_ts':t0,'end_ts':t1,
                    'attacker':attacker,'target':target,'metrics':metrics,'verdict':verdict,
                    'mitre_technique_id':tid,'mitre_tactic':tactic,
                    'confidence':round(conf,2),'payload_snippets':snips or []})
    iocs['ips'].add(attacker)

def _collect_packets(filepath):
    with open(filepath,'rb') as f:
        magic = f.read(4)
        if len(magic)<4: return None,'File too short'
        if magic == b'\x0a\x0d\x0d\x0a':
            try:
                from scapy.all import rdpcap
                pkts = rdpcap(filepath, count=100000)
                return ('scapy', pkts), None
            except Exception as e:
                return None, f'PCAPNG parse failed: {e}'
        valid = (b'\xd4\xc3\xb2\xa1',b'\xa1\xb2\xc3\xd4',b'\x4d\x3c\xb2\xa1',b'\xa1\xb2\x3c\x4d')
        if magic not in valid: return None,'Not a valid PCAP/PCAPNG file'
        endian = '<' if magic in (b'\xd4\xc3\xb2\xa1',b'\x4d\x3c\xb2\xa1') else '>'
        _,_,_,_,_,network = struct.unpack(endian+'HHiIII', f.read(20))
        if network == 113: link_off = 16
        elif network == 1: link_off = 14
        else: return None, f'Unsupported link type: {network}'
        packets=[]
        while True:
            rec = f.read(16)
            if len(rec)<16: break
            ts_sec,ts_usec,incl,orig = struct.unpack(endian+'IIII', rec)
            data = f.read(incl)
            if len(data)<incl: break
            packets.append((ts_sec,ts_usec,data,orig))
    if not packets: return None,'No packets found'
    return ('raw', packets, link_off), None

def analyze_pcap(filepath):
    result, err = _collect_packets(filepath)
    if err: return {'error': err}
    if result[0] == 'raw':
        _, packets, link_off = result
        return _analyze(packets, link_off, filepath)
    else:
        _, scapy_pkts = result
        return _analyze_scapy(scapy_pkts, filepath)

def _analyze_scapy(pkts, filepath):
    """Fallback for PCAPNG: convert scapy packets to raw tuples and analyse."""
    from scapy.all import IP, TCP, UDP
    packets = []
    for pkt in pkts:
        if IP not in pkt: continue
        ts = float(pkt.time)
        ts_sec = int(ts); ts_usec = int((ts-ts_sec)*1e6)
        raw = bytes(pkt)
        # Build minimal fake Ethernet header so link_off=14 works
        eth = b'\x00'*14 + raw[pkt[IP]._offset:]
        packets.append((ts_sec, ts_usec, eth, len(raw)))
    if not packets: return {'error':'No IP packets in PCAPNG'}
    return _analyze(packets, 14, filepath)

def _analyze(packets, link_off, filepath):
    start_full = packets[0][0]+packets[0][1]/1e6
    end_full   = packets[-1][0]+packets[-1][1]/1e6
    duration   = max(end_full-start_full, 0.001)
    start_sec  = packets[0][0]

    protocols  = {'TCP':0,'UDP':0,'ICMP':0,'Other':0}
    hosts      = set()

    syn_pkts   = []
    syn_ack    = set()
    rst_pkts   = set()
    udp_probes = collections.defaultdict(set)
    icmp_src   = collections.defaultdict(list)

    tcp_sessions  = collections.defaultdict(list)
    seen_seq      = {}
    retransmits   = []

    dns_queries   = collections.defaultdict(list)
    dns_ans_sz    = collections.defaultdict(list)
    arp_ip_mac    = collections.defaultdict(set)

    http_posts    = collections.defaultdict(list)
    http_snips    = collections.defaultdict(list)
    sqli_hits=[];  cmdi_hits=[];  xss_hits=[];  cred_hits=[];  ssl_hits=[]

    beacon_flows  = collections.defaultdict(list)
    outbound      = collections.defaultdict(int)
    buckets       = collections.defaultdict(int)
    flow_bkts     = collections.defaultdict(lambda: collections.defaultdict(int))

    for ts_sec,ts_usec,data,orig in packets:
        ts  = ts_sec+ts_usec/1e6
        bkt = (ts_sec-start_sec)//10
        buckets[bkt] += 1

        # ARP spoofing detection (Ethernet only)
        if link_off==14 and len(data)>=42:
            if struct.unpack('>H',data[12:14])[0]==0x0806:
                op = struct.unpack('>H',data[20:22])[0]
                if op==2:
                    mac = ':'.join(f'{b:02x}' for b in data[22:28])
                    ip  = socket.inet_ntoa(data[28:32])
                    arp_ip_mac[ip].add(mac)

        iph = _parse_ip(data, link_off)
        if not iph: continue
        src,dst = iph['src'],iph['dst']
        hosts.add(src); hosts.add(dst)
        flow_bkts[bkt][(src,dst)] += 1
        outbound[(src,dst)] += orig

        if iph['proto']==6:
            protocols['TCP']+=1
            tcp = _parse_tcp(data, iph['total_offset'])
            if not tcp: continue
            sp,dp = tcp['sport'],tcp['dport']
            pl_off = iph['total_offset']+tcp['doff']
            payload = data[pl_off:]

            if tcp['syn'] and not tcp['ack_f']: syn_pkts.append((ts,src,dst,sp,dp))
            if tcp['syn'] and tcp['ack_f']:     syn_ack.add((src,dst,sp,dp))
            if tcp['rst']:                       rst_pkts.add((src,dst,sp,dp))

            key = (src,dst,sp,dp,tcp['seq'])
            if payload:
                if key in seen_seq and (ts-seen_seq[key])<1.0:
                    retransmits.append((ts,seen_seq[key],src,dp,payload[:80]))
                else:
                    seen_seq[key]=ts

            canon = tuple(sorted([f'{src}:{sp}',f'{dst}:{dp}']))
            tcp_sessions[canon].append({'ts':ts,'src':src,'sport':sp,'dst':dst,'dport':dp,
                                        'payload_len':len(payload),'syn':tcp['syn'],'payload':payload})

            http_port = dp in (80,8080,8000,443,8443) or sp in (80,8080,8000,443,8443)
            if http_port and payload[:4] in (b'GET ',b'POST',b'PUT ',b'DELE',b'HEAD',b'OPTI'):
                snip = payload[:200].decode('utf-8','ignore').split('\r\n')[0]
                if payload[:4]==b'POST':
                    http_posts[(src,dst,dp)].append(ts)
                    http_snips[(src,dst,dp)].append(snip)
                if SQLI_RE.search(payload): sqli_hits.append((ts,src,dst,dp,payload))
                if CMDI_RE.search(payload): cmdi_hits.append((ts,src,dst,dp,payload))
                if XSS_RE.search(payload):  xss_hits.append((ts,src,dst,dp,payload))

            if dp in SENSITIVE_PORTS and payload and CRED_RE.search(payload[:64]):
                cred_hits.append((ts,src,dst,dp,payload[:64]))

            if payload and SSL_BAD.search(payload[:5]): ssl_hits.append((ts,src,dst,dp))

            # XMAS / NULL scans
            flags = tcp['flags']
            if flags==0x29 or flags==0:
                syn_pkts.append((ts,src,dst,sp,dp))  # reuse scan detection

            if payload and not tcp['syn']:
                beacon_flows[(src,dst,dp)].append((ts,len(payload)))

        elif iph['proto']==17:
            protocols['UDP']+=1
            udp = _parse_udp(data, iph['total_offset'])
            if not udp: continue
            sp,dp = udp['sport'],udp['dport']
            payload = data[iph['total_offset']+8:]
            udp_probes[(src,dst)].add(dp)
            if dp==53 or sp==53:
                qname = _dns_qname(payload)
                if qname: dns_queries[src].append((ts,qname))
                if sp==53: dns_ans_sz[dst].append(len(payload))
        elif iph['proto']==1:
            protocols['ICMP']+=1
            if len(data)>iph['total_offset'] and data[iph['total_offset']]==8:
                icmp_src[src].append(ts)
        else:
            protocols['Other']+=1

    attacks=[]; iocs={'ips':set(),'ports':set(),'signatures':set()}

    # 1 — TCP SYN Port Scan
    by_pair = collections.defaultdict(list)
    for ts,src,dst,sp,dp in syn_pkts: by_pair[(src,dst)].append((ts,sp,dp))
    for (src,dst),evs in by_pair.items():
        evs.sort(); n=len(evs); i=0
        while i<n:
            we=evs[i][0]+60; uports=set(); j=i
            while j<n and evs[j][0]<=we: uports.add(evs[j][2]); j+=1
            if len(uports)>=15:
                op=sum(1 for p in uports if (dst,src,p,evs[i][1]) in syn_ack)
                rate=len(uports)/max(evs[j-1][0]-evs[i][0],0.001)
                conf=min(1.0,len(uports)/50)
                _add(attacks,iocs,'TCP SYN Port Scan','Medium',evs[i][0],evs[j-1][0],src,dst,
                     f'{len(uports)} ports, {op} open, {rate:.1f} SYN/s',
                     f'{src} scanned {len(uports)} ports on {dst}.',conf)
                iocs['ports'].update(uports); i=j
            else: i+=1

    # 2 — SYN Flood
    by_tgt = collections.defaultdict(list)
    for ts,src,dst,sp,dp in syn_pkts: by_tgt[(src,dst,dp)].append(ts)
    for (src,dst,dp),tss in by_tgt.items():
        tss.sort(); n=len(tss); i=0
        while i<n:
            we=tss[i]+30; j=i
            while j<n and tss[j]<=we: j+=1
            if j-i>=200:
                rate=(j-i)/max(tss[j-1]-tss[i],0.001)
                _add(attacks,iocs,'TCP SYN Flood','High',tss[i],tss[j-1],src,f'{dst}:{dp}',
                     f'{j-i} SYN/30s, {rate:.0f}/s',f'SYN flood: {src} → {dst}:{dp}.',min(1.0,(j-i)/1000))
                iocs['ports'].add(dp); i=j
            else: i+=1

    # 3 — UDP Port Scan
    for (src,dst),dports in udp_probes.items():
        if len(dports)>=15:
            _add(attacks,iocs,'UDP Port Scan','Low',start_full,end_full,src,dst,
                 f'{len(dports)} UDP ports probed',f'{src} probed {len(dports)} UDP ports on {dst}.',
                 min(1.0,len(dports)/40))

    # 4 — ICMP Flood
    for src,tss in icmp_src.items():
        tss.sort(); n=len(tss); i=0
        while i<n:
            we=tss[i]+1.0; j=i
            while j<n and tss[j]<=we: j+=1
            if j-i>=100:
                _add(attacks,iocs,'ICMP Flood','High',tss[i],tss[j-1],src,'network',
                     f'{j-i} ICMP echo/s',f'ICMP flood from {src} at {j-i} req/s.',min(1.0,(j-i)/500))
                i=j
            else: i+=1

    # 5 — HTTP Brute-Force
    for (src,dst,dp),tss in http_posts.items():
        tss.sort(); n=len(tss); i=0
        while i<n:
            we=tss[i]+10; j=i
            while j<n and tss[j]<=we: j+=1
            if j-i>=30:
                snips=http_snips[(src,dst,dp)][:3]
                _add(attacks,iocs,'HTTP Brute-Force','High',tss[i],tss[j-1],src,f'{dst}:{dp}',
                     f'{j-i} POST/10s',f'Brute-force login: {src} → {dst}:{dp}.',
                     min(1.0,(j-i)/100),snips)
                iocs['ports'].add(dp); i=j
            else: i+=1

    # 6 — SQL Injection
    seen=set()
    for ts,src,dst,dp,pl in sqli_hits:
        if (src,dst,dp) not in seen:
            seen.add((src,dst,dp))
            snip=pl[:150].decode('utf-8','ignore')
            _add(attacks,iocs,'SQL Injection Probe','Critical',ts,ts,src,f'{dst}:{dp}',
                 'SQLi pattern in HTTP payload','SQL injection detected in HTTP request.',0.92,[snip])
            iocs['signatures'].add('SQLi')

    # 7 — Command Injection
    seen=set()
    for ts,src,dst,dp,pl in cmdi_hits:
        if (src,dst,dp) not in seen:
            seen.add((src,dst,dp))
            snip=pl[:150].decode('utf-8','ignore')
            _add(attacks,iocs,'Command Injection','Critical',ts,ts,src,f'{dst}:{dp}',
                 'Shell command pattern in payload','OS command injection detected.',0.90,[snip])
            iocs['signatures'].add('CMDi')

    # 8 — XSS
    seen=set()
    for ts,src,dst,dp,pl in xss_hits:
        if (src,dst,dp) not in seen:
            seen.add((src,dst,dp))
            snip=pl[:150].decode('utf-8','ignore')
            _add(attacks,iocs,'XSS Probe','Medium',ts,ts,src,f'{dst}:{dp}',
                 'XSS pattern in HTTP payload','Cross-site scripting probe detected.',0.85,[snip])
            iocs['signatures'].add('XSS')

    # 9 — DNS Exfiltration
    for src,queries in dns_queries.items():
        sus=[(ts,n) for ts,n in queries
             if n and (max((len(l) for l in n.split('.')),default=0)>50
                       or (n.split('.') and _entropy(n.split('.')[0])>4.2))]
        if len(sus)>=3:
            names=[n for _,n in sus[:3]]
            _add(attacks,iocs,'DNS Exfiltration','High',sus[0][0],sus[-1][0],src,'DNS',
                 f'{len(sus)} high-entropy DNS queries','DNS tunneling suspected — long/high-entropy labels.',
                 0.80,names)
            iocs['signatures'].add('DNS Tunnel')

    # 10 — DNS Amplification
    for src,sizes in dns_ans_sz.items():
        if len(sizes)>=10:
            avg=sum(sizes)//len(sizes)
            if avg>512:
                _add(attacks,iocs,'DNS Amplification','High',start_full,end_full,src,'DNS server',
                     f'{len(sizes)} large DNS replies, avg={avg}B',
                     f'DNS amplification: large responses directed at {src}.',0.75)

    # 11 — Cleartext Credentials
    seen=set()
    for ts,src,dst,dp,pl in cred_hits:
        if (src,dst,dp) not in seen:
            seen.add((src,dst,dp))
            svc=SENSITIVE_PORTS.get(dp,'plaintext')
            snip=pl.decode('utf-8','ignore').strip()
            _add(attacks,iocs,'Cleartext Credential Theft','Critical',ts,ts,src,f'{dst}:{dp}',
                 f'Plaintext {svc} creds','Credentials sent in cleartext over unencrypted channel.',0.97,[snip])
            iocs['ports'].add(dp); iocs['signatures'].add(f'Cleartext-{svc}')

    # 12 — ARP Spoofing
    for ip_addr,macs in arp_ip_mac.items():
        if len(macs)>1:
            _add(attacks,iocs,'ARP Spoofing','Critical',start_full,end_full,'Multiple Hosts',ip_addr,
                 f'IP {ip_addr} claimed by {len(macs)} MACs',
                 f'ARP poisoning: {ip_addr} advertised by {len(macs)} different MACs.',0.95)
            iocs['signatures'].add('ARP Poison')

    # 13 — Java RMI
    rmi_clients=set()
    for canon,pkts in tcp_sessions.items():
        for p in pkts:
            if p['dport']==1099: rmi_clients.add((p['src'],p['dst']))
    for (rc,rs) in rmi_clients:
        for canon,pkts in tcp_sessions.items():
            for p in pkts:
                if p['src']==rs and p['dst']==rc and p['sport']>1024 and p['dport']>1024:
                    _add(attacks,iocs,'Java RMI Exploitation','Critical',p['ts'],p['ts'],rc,f'{rs}:1099',
                         f'RMI callback port {p["dport"]}',
                         'Java RMI exploit — server called back to client on high port.',0.88)
                    break

    # 14 — TCP Replay
    if retransmits:
        zd=[r for r in retransmits if (r[0]-r[1])<=0.001]
        if len(zd)>=1 or len(retransmits)>=5:
            snips=[r[4].decode('utf-8','ignore')[:80] for r in retransmits[:3]]
            _add(attacks,iocs,'TCP Replay Attack','High' if zd else 'Medium',
                 retransmits[0][0],retransmits[-1][0],retransmits[0][2],f'Port {retransmits[0][3]}',
                 f'{len(retransmits)} retransmits, {len(zd)} zero-delay replays',
                 'Duplicate TCP segments — zero-delay copies indicate replay injection.',
                 min(1.0,0.5+len(zd)*0.1),snips)

    # 15 — SSL/TLS Downgrade
    seen=set()
    for ts,src,dst,dp in ssl_hits:
        if (src,dst) not in seen:
            seen.add((src,dst))
            _add(attacks,iocs,'SSL/TLS Downgrade','High',ts,ts,src,f'{dst}:{dp}',
                 'SSLv2/SSLv3 ClientHello','TLS downgrade to broken SSL version attempted.',0.90)
            iocs['signatures'].add('SSL Downgrade')

    # 16 — C2 Beaconing
    for (src,dst,dp),events in beacon_flows.items():
        if len(events)<10: continue
        events.sort()
        intervals=[events[i+1][0]-events[i][0] for i in range(len(events)-1)]
        sizes=[e[1] for e in events]
        if not intervals: continue
        avg_int=sum(intervals)/len(intervals)
        size_var=max(sizes)-min(sizes) if sizes else 9999
        stddev=(sum((x-avg_int)**2 for x in intervals)/len(intervals))**0.5
        jitter=stddev/avg_int if avg_int>0 else 1
        if 5<=avg_int<=60 and jitter<0.25 and size_var<100:
            conf=min(1.0,0.6+(0.25-jitter))
            _add(attacks,iocs,'C2 Beaconing','Critical',events[0][0],events[-1][0],src,f'{dst}:{dp}',
                 f'{len(events)} beacons, avg interval {avg_int:.1f}s, jitter {jitter:.2f}',
                 f'Periodic heartbeat to {dst}:{dp} — consistent size/timing indicates C2 implant.',conf)
            iocs['signatures'].add('C2 Beacon')

    # 17 — Data Exfiltration
    for (src,dst),nbytes in outbound.items():
        if nbytes>5*1024*1024:
            _add(attacks,iocs,'Data Exfiltration','High',start_full,end_full,src,dst,
                 f'{nbytes/1024/1024:.1f} MB transferred outbound',
                 f'Sustained large outbound transfer from {src} to {dst}.',
                 min(1.0,nbytes/(50*1024*1024)))

    # 18 — Traffic Volume Anomaly
    if buckets:
        avg=sum(buckets.values())/len(buckets)
        for bkt,cnt in buckets.items():
            if cnt>avg*3 and cnt>100:
                top=max(flow_bkts[bkt].items(),key=lambda x:x[1])
                s2,d2=top[0]
                _add(attacks,iocs,'Traffic Volume Anomaly','Medium',
                     start_sec+bkt*10,start_sec+bkt*10+10,s2,d2,
                     f'{cnt} pkts (avg {avg:.0f}), top flow {top[1]} pkts',
                     f'Traffic spike 3× baseline driven by {s2}→{d2}.',
                     min(1.0,cnt/(avg*5)))

    # Deduplicate and sort
    unique=[]; seen_sig=set()
    for att in attacks:
        sig=(att['type'],att['attacker'],att['target'])
        if sig not in seen_sig:
            seen_sig.add(sig); unique.append(att)
    SEV_ORDER = {'Critical':0,'High':1,'Medium':2,'Low':3}
    unique.sort(key=lambda x:(SEV_ORDER.get(x['severity'],9), -(x.get('confidence') or 0)))

    # Build report text
    dt=datetime.datetime.fromtimestamp(start_full,tz=datetime.timezone.utc)
    rep=[
        'PCAP METADATA',
        f'  File: {os.path.basename(filepath)}',
        f'  Capture start: {dt:%Y-%m-%d %H:%M:%S UTC}',
        f'  Duration: {duration:.2f}s (~{duration/60:.2f} min)',
        f'  Total packets: {len(packets)}',
        f'  Protocols: TCP {protocols["TCP"]}  UDP {protocols["UDP"]}  ICMP {protocols["ICMP"]}  Other {protocols["Other"]}',
        f'  Hosts observed: {", ".join(sorted(hosts)) if hosts else "None"}',
        '',
        f'ATTACKS DETECTED ({len(unique)})',
    ]
    if not unique:
        rep.append('  No attacks detected.')
    else:
        for i,a in enumerate(unique,1):
            rep+=[f'  ──── Attack #{i} — {a["type"]} ────',
                  f'  Severity: {a["severity"]}  |  MITRE: {a["mitre_technique_id"]} ({a["mitre_tactic"]})'
                  f'  |  Confidence: {int(a["confidence"]*100)}%',
                  f'  Attacker: {a["attacker"]}  →  Target: {a["target"]}',
                  f'  {a["metrics"]}',
                  f'  Verdict: {a["verdict"]}',
                  '']

    rep+=['INDICATORS OF COMPROMISE',
          f'  IPs: {", ".join(sorted(iocs["ips"])) or "None"}',
          f'  Ports: {", ".join(map(str,sorted(iocs["ports"]))) or "None"}',
          f'  Signatures: {", ".join(sorted(iocs["signatures"])) or "None"}']

    return {
        'report_text': '\n'.join(rep),
        'metadata': {'file':filepath,'capture_start':start_full,'duration':duration,
                     'total_packets':len(packets),'protocols':protocols,'hosts':list(hosts)},
        'attacks': unique,
        'iocs': {'ips':list(iocs['ips']),'ports':list(iocs['ports']),'signatures':list(iocs['signatures'])}
    }
