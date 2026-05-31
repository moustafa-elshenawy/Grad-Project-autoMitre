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
                    ? `http://127.0.0.1:8000/api/users/history${viewParam}`
                    : `http://127.0.0.1:8000/api/intelligence/osint-history${viewParam}`

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

    const [deleteModal, setDeleteModal] = useState({ show: false, recordId: null, loading: false, error: null })

    const triggerDeleteConfirm = (e, id) => {
        e.preventDefault()
        e.stopPropagation()
        setDeleteModal({ show: true, recordId: id, loading: false, error: null })
    }

    const confirmDelete = async () => {
        const id = deleteModal.recordId
        if (!id) return

        setDeleteModal(prev => ({ ...prev, loading: true, error: null }))
        try {
            const token = localStorage.getItem('token')
            const endpoint = threatSource === 'my_threats'
                ? `http://127.0.0.1:8000/api/analyze/threats/${id}`
                : `http://127.0.0.1:8000/api/intelligence/osint/${id}`

            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (res.ok) {
                setThreats(prev => prev.filter(t => t.id !== id))
                setDeleteModal({ show: false, recordId: null, loading: false, error: null })
            } else {
                const err = await res.json()
                setDeleteModal(prev => ({ ...prev, loading: false, error: err.detail || 'Failed to delete record' }))
            }
        } catch (error) {
            console.error("Deletion failed:", error)
            setDeleteModal(prev => ({ ...prev, loading: false, error: 'Network error occurred during deletion.' }))
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
        <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto' }}>

            <div className="card" style={{ marginBottom: 20, padding: 12, maxWidth: 550, margin: '0 auto 20px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, borderBottom: '1px solid var(--border-dim)', paddingBottom: 12 }}>
                    <button
                        className={`btn btn-sm ${threatSource === 'my_threats' ? 'btn-primary' : 'btn-secondary'}`}
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
                        className={`btn btn-sm ${threatSource === 'osint' ? 'btn-primary' : 'btn-secondary'}`}
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
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: 34, width: '100%', height: 34, minHeight: 34, fontSize: 13 }}
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
                            <div key={t.id} className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                                            {isOsint ? t.source : displayId}
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
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

                                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                                            onClick={(e) => triggerDeleteConfirm(e, t.id)}
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

            {deleteModal.show && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(2, 2, 2, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div className="card" style={{
                        maxWidth: 420,
                        width: '90%',
                        padding: '24px 28px',
                        border: '2px solid var(--bold-primary, #00ff41)',
                        boxShadow: '8px 8px 0 0 rgba(0, 255, 65, 0.25)',
                        background: '#0c0f12',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--bold-primary, #00ff41)' }}>
                            <ShieldAlert size={24} />
                            <h3 style={{ margin: 0, fontFamily: 'Archivo Black, sans-serif', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirm Deletion</h3>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary, #9CA3AF)', lineHeight: 1.6 }}>
                            Are you sure you want to delete this record? This action is permanent and cannot be undone.
                        </p>
                        {deleteModal.error && (
                            <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                                {deleteModal.error}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button
                                onClick={confirmDelete}
                                className="btn btn-primary"
                                disabled={deleteModal.loading}
                                style={{ flex: 1, padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#dc2626', borderColor: '#b91c1c', color: '#ffffff', boxShadow: '4px 4px 0 0 #7f1d1d' }}
                            >
                                {deleteModal.loading ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                                onClick={() => setDeleteModal({ show: false, recordId: null, loading: false, error: null })}
                                className="btn btn-secondary"
                                disabled={deleteModal.loading}
                                style={{ flex: 1, padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
