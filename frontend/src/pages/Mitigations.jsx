import { useState, useEffect } from 'react'
import { ShieldCheck, Search, Activity, ShieldAlert, Clock, Info, Copy, Check } from 'lucide-react'
import { useDataView } from '../contexts/DataViewContext'

export default function Mitigations() {
    const [threats, setThreats] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedThreat, setSelectedThreat] = useState(null)
    const { viewParam, viewMode } = useDataView()

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                // Re-use the existing history endpoint which returns detailed AI analyses
                const res = await fetch(`http://localhost:8000/api/users/history${viewParam}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setThreats(data.items || [])
                }
            } catch (error) {
                console.error("Failed to load history:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchHistory()
    }, [viewMode])

    const filteredThreats = threats.filter(t =>
        t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatTime = (ts) => {
        try {
            return new Date(ts).toLocaleString()
        } catch {
            return ts
        }
    }

    return (
        <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
            <div className="page-header" style={{ marginBottom: 20, flexShrink: 0 }}>
                <h1><ShieldCheck size={24} color="var(--accent-green)" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 10 }} /> Mitigations & Predictions</h1>
                <p>Review the predictive analysis and actionable defense strategies for your previously analyzed threats.</p>
            </div>

            <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
                {/* Left Pane: Threat List */}
                <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                    <div className="card" style={{ padding: 16, flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: 40, width: '100%' }}
                                placeholder="Search analyses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="card" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                        {loading ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : filteredThreats.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No threats found.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {filteredThreats.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedThreat(t)}
                                        style={{
                                            background: selectedThreat?.id === t.id ? 'var(--bg-hover)' : 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            padding: '12px 16px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 4,
                                            transition: 'background 0.2s',
                                            borderLeft: selectedThreat?.id === t.id ? '3px solid var(--accent-green)' : '3px solid transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedThreat?.id !== t.id) e.currentTarget.style.background = 'var(--bg-hover)'
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedThreat?.id !== t.id) e.currentTarget.style.background = 'transparent'
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                            {t.title}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={10} /> {formatTime(t.timestamp).split(',')[0]}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane: Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {!selectedThreat ? (
                        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <div>Select a threat from the list to view its mitigations and predictions.</div>
                        </div>
                    ) : (
                        <div className="card" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                            {/* Header */}
                            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-dim)' }}>
                                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    {selectedThreat.id}
                                </div>
                                <h2 style={{ margin: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {selectedThreat.title}
                                    <span className={`badge badge-${selectedThreat.risk_score?.severity?.toLowerCase() || 'unknown'}`}>
                                        {selectedThreat.risk_score?.severity || 'Unknown'} ({selectedThreat.risk_score?.score || 0}/10)
                                    </span>
                                </h2>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Clock size={14} /> Analyzed on {formatTime(selectedThreat.timestamp)}
                                </div>
                            </div>

                            {/* Mitigations */}
                            <div style={{ marginBottom: 32 }}>
                                <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ShieldAlert size={18} color="var(--accent-green)" /> Recommended Mitigations
                                </h3>
                                {(!selectedThreat.mitigations || selectedThreat.mitigations.length === 0) ? (
                                    <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 14 }}>
                                        No specific mitigations generated for this threat.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {selectedThreat.mitigations.map((mitigation, idx) => (
                                            <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 16, borderRadius: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)' }}>
                                                        {mitigation.title || mitigation.strategy}
                                                    </div>
                                                    <span className={`badge badge-${mitigation.priority?.toLowerCase() || 'high'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                                                        {mitigation.priority} Priority
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: mitigation.iac_snippet ? 16 : 0 }}>
                                                    {mitigation.description}
                                                </div>

                                                {/* IaC Snippet Block */}
                                                {mitigation.iac_snippet && (
                                                    <div style={{ background: '#1e1e1e', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <div style={{ background: '#2d2d2d', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: 11, color: '#a0a0a0', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                                                {mitigation.iac_type || 'code'}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    navigator.clipboard.writeText(mitigation.iac_snippet);
                                                                    const btn = e.currentTarget;
                                                                    const originalHTML = btn.innerHTML;
                                                                    btn.innerHTML = '<span style="color:var(--accent-green); display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied</span>';
                                                                    setTimeout(() => btn.innerHTML = originalHTML, 2000);
                                                                }}
                                                                style={{ background: 'transparent', border: 'none', color: '#a0a0a0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                                                            >
                                                                <Copy size={12} /> Copy
                                                            </button>
                                                        </div>
                                                        <pre style={{ margin: 0, padding: 12, overflowX: 'auto', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#d4d4d4', whiteSpace: 'pre-wrap' }}>
                                                            <code>{mitigation.iac_snippet}</code>
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Predictions (Description & Techniques) */}
                            <div>
                                <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Info size={18} color="var(--accent-blue)" /> Predictive Analysis
                                </h3>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                                    {selectedThreat.description || "No detailed prediction available."}
                                </div>

                                {selectedThreat.attack_techniques && selectedThreat.attack_techniques.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Predicted ATT&CK Techniques
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                                            {selectedThreat.attack_techniques.map((tech, idx) => (
                                                <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: 12, borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                    <Activity size={14} color="var(--accent-red)" style={{ marginTop: 2, flexShrink: 0 }} />
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{tech.technique}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tech.tactic}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
