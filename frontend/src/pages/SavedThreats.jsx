import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Database, Search, Clock, ShieldAlert, Activity, ArrowRight, ExternalLink, Trash2 } from 'lucide-react'
import { useDataView } from '../contexts/DataViewContext'

export default function SavedThreats() {
    const [threats, setThreats] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [threatSource, setThreatSource] = useState('my_threats')
    const { viewParam, viewParamAmp, viewMode } = useDataView()

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                const endpoint = threatSource === 'my_threats'
                    ? `http://localhost:8000/api/users/history${viewParam}`
                    : `http://localhost:8000/api/intelligence/osint-history${viewParam}`

                const res = await fetch(endpoint, {
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
    }, [threatSource, viewMode])

    const handleDelete = async (e, id) => {
        e.preventDefault()
        e.stopPropagation()

        if (!window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
            return
        }

        try {
            const token = localStorage.getItem('token')
            const endpoint = threatSource === 'my_threats'
                ? `http://localhost:8000/api/analyze/threats/${id}`
                : `http://localhost:8000/api/intelligence/osint/${id}`

            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (res.ok) {
                setThreats(prev => prev.filter(t => t.id !== id))
            } else {
                const err = await res.json()
                alert(`Error: ${err.detail || 'Failed to delete record'}`)
            }
        } catch (error) {
            console.error("Deletion failed:", error)
            alert("Network error occurred during deletion.")
        }
    }

    const filteredThreats = threats.filter(t => {
        const term = searchTerm.toLowerCase()
        const titleMatch = t.title ? t.title.toLowerCase().includes(term) : false
        const idMatch = t.id ? t.id.toLowerCase().includes(term) : false
        const descMatch = t.description ? t.description.toLowerCase().includes(term) : false
        const iocMatch = t.iocs ? t.iocs.some(ioc => ioc.toLowerCase().includes(term)) : false
        return titleMatch || idMatch || descMatch || iocMatch
    })

    const formatTime = (ts) => {
        try {
            return new Date(ts).toLocaleString()
        } catch {
            return ts
        }
    }

    return (
        <div className="page-content" style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div className="page-header" style={{ marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1><Database size={24} color="var(--accent-blue)" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 10 }} /> Saved Threats</h1>
                    <p>Historical archive of all your previously processed threat analyses and downloaded OSINT feeds.</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 24, padding: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--border-dim)', paddingBottom: 16 }}>
                    <button
                        className={`btn ${threatSource === 'my_threats' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                            if (threatSource !== 'my_threats') {
                                setThreats([])
                                setThreatSource('my_threats')
                            }
                        }}
                    >
                        My Threats
                    </button>
                    <button
                        className={`btn ${threatSource === 'osint' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                            if (threatSource !== 'osint') {
                                setThreats([])
                                setThreatSource('osint')
                            }
                        }}
                    >
                        OSINT Feeds
                    </button>
                </div>

                <div style={{ position: 'relative' }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: 40, width: '100%' }}
                        placeholder="Search by threat title, IOA/IOC, or internal ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <div className="status-dot" style={{ margin: '0 auto 16px', width: 12, height: 12 }} />
                    Loading database records...
                </div>
            ) : filteredThreats.length === 0 ? (
                <div className="upload-zone" style={{ padding: '80px 20px' }}>
                    <Database size={48} className="upload-zone-icon" />
                    <div className="upload-zone-title">No matching threats found</div>
                    <div className="upload-zone-sub">Analyze a new threat pattern to populate the database.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {filteredThreats.map(t => {
                        // Normalize the schema differences between My Threats and OSINT
                        const isOsint = threatSource === 'osint';
                        const displayId = t.id ? t.id.split('-')[0] : 'unknown';
                        const displaySeverity = (isOsint ? t.severity : t.risk_score?.severity) || 'Unknown';
                        const displayScore = isOsint ? '' : ` (${t.risk_score?.score || 0}/10)`;

                        return (
                            <div key={t.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                                            {isOsint ? t.source : displayId}
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {t.title}
                                            <span className={`badge badge-${displaySeverity.toLowerCase()}`}>
                                                {displaySeverity}{displayScore}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Clock size={14} /> {formatTime(t.timestamp)}
                                    </div>
                                </div>

                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {t.description || "No description generated."}
                                </div>

                                <div style={{ display: 'flex', gap: 16, marginTop: 8, borderTop: '1px solid var(--border-dim)', paddingTop: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        {!isOsint && t.attack_techniques?.length > 0 && (
                                            <div className="badge badge-attack">
                                                <Activity size={12} /> {t.attack_techniques.length} Techniques
                                            </div>
                                        )}
                                        {isOsint && t.technique && (
                                            <div className="badge badge-attack">
                                                <Activity size={12} /> {t.technique}
                                            </div>
                                        )}
                                        {!isOsint && t.mitigations?.length > 0 && (
                                            <div className="badge badge-defend">
                                                <ShieldAlert size={12} /> {t.mitigations.length} Mitigations
                                            </div>
                                        )}
                                        {isOsint && t.iocs?.length > 0 && (
                                            <div className="badge badge-defend">
                                                <ShieldAlert size={12} /> {t.iocs.length} IOCs
                                            </div>
                                        )}
                                        {!isOsint && t.entities?.length > 0 && (
                                            <div className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                {t.entities.length} Entities
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        {isOsint && t.external_url && (
                                            <a href={t.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                <ExternalLink size={14} /> View Source
                                            </a>
                                        )}
                                        {!isOsint && (
                                            <Link to={`/threat-mapping/${t.id}`} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
                                                View Full Analysis <ArrowRight size={14} />
                                            </Link>
                                        )}
                                        <button 
                                            onClick={(e) => handleDelete(e, t.id)}
                                            className="btn btn-secondary" 
                                            style={{ 
                                                padding: '6px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                color: 'var(--accent-red, #ff4d4d)',
                                                borderColor: 'rgba(255, 77, 77, 0.2)',
                                                background: 'rgba(255, 77, 77, 0.05)'
                                            }}
                                            title="Delete Record"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
