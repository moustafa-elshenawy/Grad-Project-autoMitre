import { useState, useEffect, useMemo } from 'react'
import { Shield, Target, BookOpen, AlertTriangle, ExternalLink, Loader2, ChevronRight, Activity, Zap, CheckCircle2 } from 'lucide-react'
import { useDataView } from '../contexts/DataViewContext'

// Original static definitions for fallback/reference
const ALL_TACTICS = [
    { id: 'TA0001', name: 'Initial Access', techniques: ['T1190', 'T1133', 'T1078', 'T1566'], color: '#ef4444' },
    { id: 'TA0002', name: 'Execution', techniques: ['T1059', 'T1059.001', 'T1059.003', 'T1204'], color: '#f97316' },
    { id: 'TA0003', name: 'Persistence', techniques: ['T1053', 'T1543', 'T1547'], color: '#f59e0b' },
    { id: 'TA0004', name: 'Priv. Escalation', techniques: ['T1548', 'T1134'], color: '#84cc16' },
    { id: 'TA0005', name: 'Defense Evasion', techniques: ['T1055', 'T1027', 'T1070'], color: '#22c55e' },
    { id: 'TA0006', name: 'Credential Access', techniques: ['T1110', 'T1003', 'T1555'], color: '#06b6d4' },
    { id: 'TA0007', name: 'Discovery', techniques: ['T1087', 'T1083', 'T1046'], color: '#3b82f6' },
    { id: 'TA0008', name: 'Lateral Movement', techniques: ['T1021', 'T1080'], color: '#8b5cf6' },
    { id: 'TA0009', name: 'Collection', techniques: ['T1560', 'T1005'], color: '#ec4899' },
    { id: 'TA0011', name: 'Command & Control', techniques: ['T1071', 'T1095'], color: '#f43f5e' },
    { id: 'TA0010', name: 'Exfiltration', techniques: ['T1048', 'T1041'], color: '#fb923c' },
    { id: 'TA0040', name: 'Impact', techniques: ['T1485', 'T1486', 'T1489'], color: '#94a3b8' },
]

const DEFEND_CATEGORIES = [
    { name: 'Harden', items: ['Application Hardening (D3-AH)', 'Software Updates (D3-SR)', 'User Account Permissions (D3-UAP)'], color: '#3b82f6' },
    { name: 'Detect', items: ['Network Monitoring (D3-NM)', 'Endpoint Monitoring (D3-EM)', 'Decoy Environment (D3-DE)'], color: '#f59e0b' },
    { name: 'Isolate', items: ['Network Traffic Filtering (D3-NTF)', 'Application Layer Filtering (D3-AL)', 'Inbound Filtering (D3-IPAM)'], color: '#8b5cf6' },
    { name: 'Credential Hardening', items: ['Multi-factor Auth (D3-IAM)', 'Password Hashing (D3-PH)', 'Account Locking (D3-ACH)'], color: '#10b981' },
    { name: 'Evict', items: ['Process Termination (D3-PE)'], color: '#ef4444' },
    { name: 'Restore', items: ['Backup (D3-BA)'], color: '#22c55e' },
]

const NIST_FAMILIES = [
    { id: 'AC', name: 'Access Control', controls: 16, covered: 5, color: '#3b82f6' },
    { id: 'AU', name: 'Audit & Accountability', controls: 16, covered: 2, color: '#8b5cf6' },
    { id: 'CM', name: 'Config Management', controls: 14, covered: 2, color: '#ec4899' },
    { id: 'IA', name: 'Identification & Auth', controls: 13, covered: 2, color: '#06b6d4' },
    { id: 'IR', name: 'Incident Response', controls: 10, covered: 1, color: '#f43f5e' },
    { id: 'RA', name: 'Risk Assessment', controls: 10, covered: 1, color: '#f97316' },
    { id: 'SC', name: 'System & Comms Protection', controls: 51, covered: 2, color: '#10b981' },
    { id: 'SI', name: 'System & Info Integrity', controls: 23, covered: 2, color: '#f59e0b' },
]

const OWASP_TOP10 = [
    { id: 'A01:2021', name: 'Broken Access Control', covered: true },
    { id: 'A02:2021', name: 'Cryptographic Failures', covered: true },
    { id: 'A03:2021', name: 'Injection', covered: true },
    { id: 'A04:2021', name: 'Insecure Design', covered: true },
    { id: 'A05:2021', name: 'Security Misconfiguration', covered: true },
    { id: 'A06:2021', name: 'Vulnerable Components', covered: true },
    { id: 'A07:2021', name: 'Auth Failures', covered: true },
    { id: 'A08:2021', name: 'Integrity Failures', covered: false },
    { id: 'A09:2021', name: 'Logging & Monitoring Failures', covered: true },
    { id: 'A10:2021', name: 'SSRF', covered: true },
]

export default function FrameworkCoverage() {
    const [activeFramework, setActiveFramework] = useState('attack')
    const [loading, setLoading] = useState(true)

    // Dynamic stats
    const [discoveredTechniques, setDiscoveredTechniques] = useState(new Set())
    const [discoveredTactics, setDiscoveredTactics] = useState(new Set())
    const [subTechniqueCount, setSubTechniqueCount] = useState(0)

    // NEW dynamic state map
    const [d3fendCoverage, setD3fendCoverage] = useState(new Set())
    const [nistCoverage, setNistCoverage] = useState({}) // { 'AC': 3, 'AU': 1 }
    const [owaspCoverage, setOwaspCoverage] = useState(new Set())
    const { viewParam, viewMode } = useDataView()

    useEffect(() => {
        const fetchCoverageData = async () => {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                const res = await fetch(`http://localhost:8000/api/users/history${viewParam}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    const items = data.items || []

                    const techSet = new Set()
                    const tacticSet = new Set()
                    let subs = 0

                    const newD3fend = new Set()
                    const newNist = { AC: 0, AU: 0, CM: 0, IA: 0, IR: 0, RA: 0, SC: 0, SI: 0 }
                    const newOwasp = new Set()

                    // Text-based heuristics
                    const owaspKeywords = {
                        'A01:2021': ['access control', 'privilege escalation', 'T1548', 'T1134', 'lateral movement'],
                        'A02:2021': ['crypto', 'hash', 'password', 'keylogger', 'T1555'],
                        'A03:2021': ['sql injection', 'xss', 'cross-site', 'command injection', 'T1190'],
                        'A04:2021': ['insecure design', 'architecture', 'default credentials'],
                        'A05:2021': ['misconfiguration', 'open port', 'default', 'T1078'],
                        'A06:2021': ['vulnerable component', 'cve', 'exploit', 'T1190', 'T1203'],
                        'A07:2021': ['auth failure', 'brute force', 'credential', 'T1110', 'T1003'],
                        'A08:2021': ['integrity failure', 'supply chain', 'update', 'T1195'],
                        'A09:2021': ['logging failure', 'monitor', 'log clear', 'T1070'],
                        'A10:2021': ['ssrf', 'server-side request', 'cloud meta']
                    }

                    // NIST mapping per technique ID heuristics
                    const nistMap = {
                        'T1190': ['SI', 'SC'], 'T1110': ['IA', 'AC'], 'T1003': ['AC', 'SC'],
                        'T1078': ['IA', 'AC'], 'T1555': ['SC', 'IA'], 'T1059': ['CM', 'SI'],
                        'T1486': ['IR', 'SI'], 'T1485': ['IR', 'SI'], 'T1070': ['AU', 'SI'],
                        'T1566': ['SI', 'SC', 'AT'] // AT not in default list 
                    }

                    items.forEach(threat => {
                        const fullText = `${threat.title} ${threat.description} ${threat.business_impact}`.toLowerCase()

                        // Process Mitigations -> D3FEND
                        if (threat.mitigations && Array.isArray(threat.mitigations)) {
                            threat.mitigations.forEach(m => {
                                // Match simple heuristics to D3FEND concepts by text content
                                const mText = `${m.title} ${m.description}`.toLowerCase()
                                if (mText.includes('auth') || mText.includes('mfa')) newD3fend.add('Authentication')
                                if (mText.includes('firewall') || mText.includes('waf')) newD3fend.add('Network Filtering')
                                if (mText.includes('patch') || mText.includes('update')) newD3fend.add('Patch Management')
                                if (mText.includes('backup') || mText.includes('offline')) newD3fend.add('File Backup')
                                if (mText.includes('isolate') || mText.includes('segment')) newD3fend.add('Network Isolation')
                                if (mText.includes('monitor') || mText.includes('edr')) newD3fend.add('Process Analysis')
                                if (mText.includes('password') || mText.includes('credential')) newD3fend.add('Credential Eviction')
                            })
                        }

                        // Process Attack Techniques -> MITRE & NIST
                        if (threat.attack_techniques && Array.isArray(threat.attack_techniques)) {
                            threat.attack_techniques.forEach(tech => {
                                const techId = typeof tech === 'string' ? tech : (tech.technique_id || tech.id || '')
                                if (!techId) return

                                techSet.add(techId)

                                if (typeof techId === 'string' && techId.includes('.')) {
                                    subs++
                                }

                                ALL_TACTICS.forEach(tactic => {
                                    if (tactic.techniques && tactic.techniques.includes(techId)) {
                                        tacticSet.add(tactic.id)
                                    }
                                })

                                // Map to NIST
                                const mappedNist = nistMap[techId]
                                if (mappedNist) {
                                    mappedNist.forEach(cat => {
                                        if (newNist[cat] !== undefined) newNist[cat]++
                                    })
                                }
                            })
                        }

                        // Process text to OWASP 
                        Object.entries(owaspKeywords).forEach(([owaspId, words]) => {
                            if (words.some(w => fullText.includes(w) || techSet.has(w))) {
                                newOwasp.add(owaspId)
                            }
                        })
                    })

                    setDiscoveredTechniques(techSet)
                    setDiscoveredTactics(tacticSet)
                    setSubTechniqueCount(subs)

                    setD3fendCoverage(newD3fend)
                    setNistCoverage(newNist)
                    setOwaspCoverage(newOwasp)
                }
            } catch (error) {
                console.error("Failed to load coverage history:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchCoverageData()
    }, [viewMode])

    // Generate the dynamic matrix
    // We intertwine ALL_TACTICS with our discovered techniques to highlight which ones we've actually seen
    const activeTactics = ALL_TACTICS.map(tactic => {
        const coveredTechniques = tactic.techniques.filter(t => discoveredTechniques.has(t));
        const uncoveredTechniques = tactic.techniques.filter(t => !discoveredTechniques.has(t));

        return {
            ...tactic,
            coveredTechniques,
            uncoveredTechniques,
            isCovered: coveredTechniques.length > 0
        }
    })

    const totalTechniquesCoverage = discoveredTechniques.size;
    const TOTAL_MITRE_TECHNIQUES = 635; // MITRE v14 base techniques

    const coveragePercentage = totalTechniquesCoverage > 0
        ? ((totalTechniquesCoverage / TOTAL_MITRE_TECHNIQUES) * 100).toFixed(1)
        : 0;

    return (
        <div>
            {/* Framework switcher */}
            <div className="tabs" style={{ marginBottom: 24 }}>
                {[
                    ['attack', '🎯 MITRE ATT&CK'],
                    ['defend', '🛡️ MITRE D3FEND'],
                    ['nist', '📋 NIST SP 800-53'],
                    ['owasp', '🌐 OWASP Top 10']
                ].map(([id, label]) => (
                    <button key={id} className={`tab ${activeFramework === id ? 'active' : ''}`} onClick={() => setActiveFramework(id)}>
                        {label}
                    </button>
                ))}
            </div>

            {/* MITRE ATT&CK */}
            {activeFramework === 'attack' && (
                <div>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#94a3b8' }}>
                            <Loader2 className="spin" style={{ marginRight: 8 }} size={20} />
                            Calculating framework coverage...
                        </div>
                    ) : (
                        <>
                            <div className="grid-4" style={{ marginBottom: 20 }}>
                                <div className="stat-card">
                                    <div className="stat-label">Techniques Covered</div>
                                    <div className="stat-number" style={{ fontSize: 28 }}>{totalTechniquesCoverage}</div>
                                    <div className="progress-bar" style={{ marginTop: 8 }}>
                                        <div className="progress-bar-fill risk-gradient" style={{ width: `${coveragePercentage}%` }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                                        {totalTechniquesCoverage} / {TOTAL_MITRE_TECHNIQUES} ({coveragePercentage}%)
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Tactics Observed</div>
                                    <div className="stat-number" style={{ fontSize: 28 }}>{discoveredTactics.size}</div>
                                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>of 14 total tactics</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">ATT&CK Version</div>
                                    <div className="stat-number" style={{ fontSize: 28 }}>v14</div>
                                    <div style={{ fontSize: 10, color: '#10b981', marginTop: 4 }}>Up to date</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Sub-techniques</div>
                                    <div className="stat-number" style={{ fontSize: 28 }}>{subTechniqueCount}</div>
                                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Detected variations</div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">
                                        <Target size={16} color="#00d4ff" /> Detected ATT&CK Matrix Coverage
                                    </div>
                                    <a href="https://attack.mitre.org" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#00d4ff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                                        MITRE ATT&CK <ExternalLink size={10} />
                                    </a>
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                                    Techniques highlighted in color have been actively detected in your threat analysis history. Gray techniques represent general taxonomy categories.
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 8 }}>
                                    {activeTactics.map(tactic => (
                                        <div key={tactic.id} style={{
                                            background: tactic.isCovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                                            border: `1px solid ${tactic.isCovered ? tactic.color + '40' : 'rgba(255,255,255,0.04)'}`,
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                            transition: 'all 0.2s'
                                        }}>
                                            <div style={{
                                                background: tactic.isCovered ? tactic.color + '22' : 'rgba(255,255,255,0.03)',
                                                borderBottom: `2px solid ${tactic.isCovered ? tactic.color : 'rgba(255,255,255,0.1)'}`,
                                                padding: '8px 10px'
                                            }}>
                                                <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: tactic.isCovered ? tactic.color : '#64748b', marginBottom: 2 }}>{tactic.id}</div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: tactic.isCovered ? '#f0f4ff' : '#94a3b8' }}>{tactic.name}</div>
                                            </div>

                                            <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                {/* Specifically Covered Techniques */}
                                                {tactic.coveredTechniques.map(t => (
                                                    <a key={t} href={`https://attack.mitre.org/techniques/${t.replace('.', '/')}`} target="_blank" rel="noreferrer" className="technique-chip" style={{ textDecoration: 'none', background: tactic.color + '33', border: `1px solid ${tactic.color}80`, color: '#fff' }}>
                                                        {t}
                                                    </a>
                                                ))}
                                                {/* All Other Uncovered Techniques (grayed out) */}
                                                {tactic.uncoveredTechniques.map(t => (
                                                    <span key={t} className="technique-chip" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', opacity: 0.6 }}>
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* D3FEND */}
            {activeFramework === 'defend' && (
                <div>
                    <div className="grid-3" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div className="stat-label">Countermeasures Active</div>
                            <div className="stat-number" style={{ fontSize: 28 }}>{d3fendCoverage.size}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{d3fendCoverage.size} / 58 countermeasures</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">D3FEND Categories</div>
                            <div className="stat-number" style={{ fontSize: 28 }}>
                                {new Set([...d3fendCoverage].map(c => DEFEND_CATEGORIES.find(cat => cat.items.includes(c))?.name).filter(Boolean)).size}
                            </div>
                            <div style={{ fontSize: 10, color: '#475569' }}>Active defensive classes</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Coverage</div>
                            <div className="stat-number" style={{ fontSize: 28 }}>{((d3fendCoverage.size / 58) * 100).toFixed(1)}%</div>
                            <div className="progress-bar" style={{ marginTop: 8 }}>
                                <div className="progress-bar-fill" style={{ width: `${((d3fendCoverage.size / 58) * 100).toFixed(1)}%`, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                            </div>
                        </div>
                    </div>
                    <div className="grid-2">
                        {DEFEND_CATEGORIES.map(cat => (
                            <div key={cat.name} className="card">
                                <div className="card-header">
                                    <div className="card-title">
                                        <Shield size={14} style={{ color: cat.color }} />
                                        {cat.name}
                                    </div>
                                    <span className="badge badge-defend">{cat.items.filter(item => d3fendCoverage.has(item)).length} active</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {cat.items.map(item => {
                                        const isCovered = d3fendCoverage.has(item)
                                        return (
                                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: isCovered ? `${cat.color}1a` : 'transparent', borderRadius: 6, border: `1px solid ${isCovered ? cat.color + '40' : 'rgba(255,255,255,0.05)'}` }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isCovered ? cat.color : '#475569', flexShrink: 0 }} />
                                                <span style={{ fontSize: 12, color: isCovered ? '#f0f4ff' : '#64748b' }}>{item}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* NIST */}
            {activeFramework === 'nist' && (
                <div>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <div className="card-title"><BookOpen size={16} color="#00d4ff" /> NIST SP 800-53 Control Coverage</div>
                            <a href="https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#00d4ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                NIST SP 800-53 Rev 5 <ExternalLink size={10} />
                            </a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {NIST_FAMILIES.map(f => {
                                const dynamicCovered = nistCoverage[f.id] || 0
                                return (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ width: 30, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: f.color, fontWeight: 700 }}>{f.id}</span>
                                        <span style={{ width: 180, fontSize: 12, color: '#94a3b8' }}>{f.name}</span>
                                        <div className="progress-bar" style={{ flex: 1 }}>
                                            <div className="progress-bar-fill" style={{ width: `${Math.min(100, (dynamicCovered / f.controls) * 100)}%`, background: f.color }} />
                                        </div>
                                        <span style={{ width: 60, fontSize: 11, color: '#475569', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{dynamicCovered}/{f.controls}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* OWASP */}
            {activeFramework === 'owasp' && (
                <div>
                    <div className="grid-2" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div className="stat-label">OWASP Top 10 Coverage</div>
                            <div className="stat-number" style={{ fontSize: 28, background: 'linear-gradient(135deg,#f97316,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{owaspCoverage.size}/10</div>
                            <div className="progress-bar" style={{ marginTop: 8 }}>
                                <div className="progress-bar-fill" style={{ width: `${(owaspCoverage.size / 10) * 100}%`, background: 'linear-gradient(90deg,#f97316,#f59e0b)' }} />
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">ASVS Requirements</div>
                            <div className="stat-number" style={{ fontSize: 28 }}>{owaspCoverage.size}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{owaspCoverage.size} of 20 ASVS categories</div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><AlertTriangle size={16} color="#f97316" /> OWASP Top 10 — 2021</div>
                            <a href="https://owasp.org/Top10/" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#f97316', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                owasp.org <ExternalLink size={10} />
                            </a>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                            {OWASP_TOP10.map(item => {
                                const isCovered = owaspCoverage.has(item.id)
                                return (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isCovered ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: 6, border: `1px solid ${isCovered ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                                        <span style={{ fontSize: 18 }}>{isCovered ? '✅' : '❌'}</span>
                                        <div>
                                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: isCovered ? '#34d399' : '#64748b', marginBottom: 2 }}>{item.id}</div>
                                            <div style={{ fontSize: 12, color: isCovered ? '#f0f4ff' : '#94a3b8', fontWeight: 500 }}>{item.name}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
