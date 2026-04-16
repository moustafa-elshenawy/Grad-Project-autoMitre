import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, Settings2, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader, Shield, AlertTriangle, Wifi, Database } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'

const API = 'http://localhost:8000'

const SEV_COLOR = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#22c55e', Informational: '#64748b' }
const SEV_CLASS = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' }

const SOURCE_META = {
    misp: { label: 'MISP', color: '#f59e0b', icon: '🧩' },
    urlhaus: { label: 'URLhaus', color: '#10b981', icon: '🔗' },
    bazaar: { label: 'MalwareBazaar', color: '#3b82f6', icon: '🦠' },
    otx: { label: 'AlienVault OTX', color: '#a855f7', icon: '🛰' },
    db: { label: 'autoMITRE', color: '#0ea5e9', icon: '🎯' },
}

function authHeader() {
    const t = localStorage.getItem('token')
    return t ? { Authorization: `Bearer ${t}` } : {}
}

// ── Source Status Badge ───────────────────────────────────────────────────────
function SourceBadge({ sourceKey, status, configured }) {
    const meta = SOURCE_META[sourceKey] || { label: sourceKey, color: '#94a3b8', icon: '•' }
    const active = status === 'active'
    const err = status === 'error'
    const notConfigured = configured === false

    let dot = '●'
    let dotColor = active ? '#10b981' : err ? '#ef4444' : notConfigured ? '#475569' : '#f59e0b'
    let opacity = notConfigured ? 0.5 : 1

    return (
        <div
            title={notConfigured ? `${meta.label}: not configured` : `${meta.label}: ${status || 'pending'}`}
            style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                borderRadius: 100, fontSize: 11, fontWeight: 600,
                background: `${meta.color}12`, border: `1px solid ${meta.color}30`,
                color: meta.color, opacity,
                cursor: 'default',
            }}
        >
            <span style={{ color: dotColor, fontSize: 9 }}>⬤</span>
            {meta.icon} {meta.label}
        </div>
    )
}

// ── MISP Config Panel ─────────────────────────────────────────────────────────
function MispConfigPanel({ onSaved }) {
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ misp_url: '', misp_api_key: '', otx_api_key: '' })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        if (!open) return
        axios.get(`${API}/api/settings/osint`, { headers: authHeader() })
            .then(r => setForm({
                misp_url: r.data.misp_url || '',
                misp_api_key: r.data.misp_api_key || '',
                otx_api_key: r.data.otx_api_key || '',
            }))
            .catch(() => { })
    }, [open])

    const save = async () => {
        setSaving(true)
        setMessage(null)
        try {
            await axios.patch(`${API}/api/settings/osint`, form, { headers: authHeader() })
            setMessage({ ok: true, text: 'Saved! Refresh the feed to apply.' })
            onSaved?.()
        } catch (e) {
            setMessage({ ok: false, text: e.response?.data?.detail || 'Save failed' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}
            >
                <Settings2 size={15} color="#0ea5e9" />
                OSINT Source Configuration
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
            </button>

            {open && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>
                        Free feeds (URLhaus, MalwareBazaar) are always active. Configure optional sources below.
                    </p>

                    <div style={{ display: 'grid', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>MISP URL</label>
                            <input
                                className="form-input" style={{ fontSize: 13 }}
                                value={form.misp_url}
                                onChange={e => setForm(f => ({ ...f, misp_url: e.target.value }))}
                                placeholder="https://your-misp-instance.com"
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>MISP API Key</label>
                            <input
                                className="form-input" style={{ fontSize: 13 }}
                                type="password"
                                value={form.misp_api_key}
                                onChange={e => setForm(f => ({ ...f, misp_api_key: e.target.value }))}
                                placeholder="Your MISP automation API key"
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>AlienVault OTX API Key <span style={{ color: '#475569' }}>(free at otx.alienvault.com)</span></label>
                            <input
                                className="form-input" style={{ fontSize: 13 }}
                                type="password"
                                value={form.otx_api_key}
                                onChange={e => setForm(f => ({ ...f, otx_api_key: e.target.value }))}
                                placeholder="Your OTX API key"
                            />
                        </div>
                    </div>

                    {message && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: message.ok ? '#10b981' : '#ef4444' }}>
                            {message.ok ? <CheckCircle size={13} /> : <XCircle size={13} />} {message.text}
                        </div>
                    )}

                    <button
                        className="btn btn-primary" style={{ marginTop: 14, fontSize: 12 }}
                        onClick={save} disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ThreatFeed() {
    const [threats, setThreats] = useState([])
    const [sources, setSources] = useState({})
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLast] = useState(null)
    const [sevFilter, setSev] = useState('all')
    const [srcFilter, setSrc] = useState('all')
    const [error, setError] = useState(null)
    const { viewParam, viewMode, isContextualAdmin } = useDataView()

    const fetchFeed = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const r = await axios.get(`${API}/api/intelligence/feed${viewParam}`, { headers: authHeader() })
            setThreats(r.data.threats || [])
            setSources(r.data.sources || {})
            setLast(r.data.last_updated)
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to load feed')
        } finally {
            setLoading(false)
        }
    }, [viewParam])

    useEffect(() => { fetchFeed() }, [fetchFeed, viewMode])

    // Apply filters
    const filtered = threats.filter(t => {
        if (sevFilter !== 'all' && t.severity !== sevFilter) return false
        if (srcFilter !== 'all' && t.source_key !== srcFilter) return false
        return true
    })

    // Severity counts
    const counts = {}
        ;['Critical', 'High', 'Medium', 'Low'].forEach(s => {
            counts[s] = threats.filter(t => t.severity === s).length
        })

    // Active source keys for filter options
    const activeSources = Object.entries(SOURCE_META).filter(([key]) =>
        threats.some(t => t.source_key === key)
    )

    return (
        <div>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Wifi size={20} color="#0ea5e9" />
                    <div>
                        <h1 style={{ margin: 0 }}>Live Threat Feed</h1>
                        <p style={{ margin: 0, fontSize: 12 }}>
                            Real-time OSINT from URLhaus, MalwareBazaar, OTX &amp; MISP
                            {lastUpdated && <span style={{ color: '#475569' }}> · Updated {new Date(lastUpdated).toLocaleTimeString()}</span>}
                        </p>
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchFeed} disabled={loading}>
                    <RefreshCw size={13} className={loading ? 'spinning' : ''} /> Refresh
                </button>
            </div>

            {/* OSINT Config */}
            {isContextualAdmin && <MispConfigPanel onSaved={fetchFeed} />}

            {/* Source Status Bar */}
            {Object.keys(sources).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {Object.entries(SOURCE_META).map(([key]) => (
                        <SourceBadge
                            key={key}
                            sourceKey={key}
                            status={sources[key]}
                            configured={key === 'misp' ? Boolean(sources.misp) : key === 'otx' ? Boolean(sources.otx) : true}
                        />
                    ))}
                </div>
            )}

            {/* Severity Stats */}
            <div className="grid-4" style={{ marginBottom: 20 }}>
                {['Critical', 'High', 'Medium', 'Low'].map(s => (
                    <div
                        key={s}
                        onClick={() => setSev(sevFilter === s ? 'all' : s)}
                        style={{ background: 'var(--bg-card)', border: `1px solid ${SEV_COLOR[s]}22`, borderRadius: 10, padding: '12px 16px', borderTop: `2px solid ${SEV_COLOR[s]}`, cursor: 'pointer', opacity: sevFilter === 'all' || sevFilter === s ? 1 : 0.4, transition: 'opacity 0.15s' }}
                    >
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{s}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: SEV_COLOR[s] }}>
                            {loading ? '—' : counts[s]}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                {/* Source filter */}
                {activeSources.length > 1 && (
                    <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => setSrc('all')} style={btnStyle(srcFilter === 'all', '#0ea5e9')}>All Sources</button>
                        {activeSources.map(([key, meta]) => (
                            <button key={key} onClick={() => setSrc(srcFilter === key ? 'all' : key)} style={btnStyle(srcFilter === key, meta.color)}>
                                {meta.icon} {meta.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', marginBottom: 20 }}>
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Loader size={20} className="spinning" /> Fetching live threat intelligence…
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Shield size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                    <p>No threats match the current filters.</p>
                </div>
            )}

            {/* Threat Cards */}
            {!loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map(t => {
                        const srcMeta = SOURCE_META[t.source_key] || { label: t.source, color: '#94a3b8', icon: '•' }
                        const sevColor = SEV_COLOR[t.severity] || '#94a3b8'
                        return (
                            <div
                                key={t.id}
                                className="card"
                                style={{ borderLeft: `3px solid ${sevColor}`, transition: 'all 0.2s ease', padding: '14px 16px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Title row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                            <span className={`badge badge-${SEV_CLASS[t.severity] || 'info'}`}>{t.severity}</span>
                                            {t.is_historic && (
                                                <span title="Loaded from local database storage" style={{ display: 'flex', alignItems: 'center', color: '#0ea5e9' }}>
                                                    <Database size={13} />
                                                </span>
                                            )}
                                            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', margin: 0 }}>{t.title}</h3>
                                        </div>

                                        {/* Meta row */}
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: t.iocs?.length > 0 ? 8 : 0 }}>
                                            {t.technique && <span className="badge badge-attack">{t.technique}</span>}
                                            {t.tactic && t.tactic !== 'Unknown' && (
                                                <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>🎯 {t.tactic}</span>
                                            )}
                                            <span
                                                style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: `${srcMeta.color}15`, color: srcMeta.color, border: `1px solid ${srcMeta.color}30` }}
                                            >
                                                {srcMeta.icon} {srcMeta.label}
                                            </span>
                                            <span style={{ fontSize: 11, color: '#475569' }}>🕐 {t.timestamp}</span>
                                        </div>

                                        {/* Description */}
                                        {t.description && (
                                            <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 6px', lineHeight: 1.5 }}>
                                                {t.description}
                                            </p>
                                        )}

                                        {/* IoCs */}
                                        {t.iocs?.length > 0 && (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {t.iocs.map((ioc, i) => (
                                                    <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ioc}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tags */}
                                        {t.tags?.length > 0 && (
                                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                                                {t.tags.map((tag, i) => (
                                                    <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                                        {t.frameworks?.map(f => (
                                            <span key={f} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}>{f}</span>
                                        ))}
                                        {t.technique && (
                                            <a
                                                href={`https://attack.mitre.org/techniques/${t.technique.replace('.', '/')}`}
                                                target="_blank" rel="noreferrer"
                                                style={{ fontSize: 11, color: '#00d4ff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginTop: 4 }}
                                            >
                                                ATT&CK <ExternalLink size={10} />
                                            </a>
                                        )}
                                        {t.external_url && (
                                            <a
                                                href={t.external_url}
                                                target="_blank" rel="noreferrer"
                                                style={{ fontSize: 11, color: srcMeta.color, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                            >
                                                Details <ExternalLink size={10} />
                                            </a>
                                        )}
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

function btnStyle(active, color) {
    return {
        padding: '4px 11px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${active ? color + '44' : 'transparent'}`,
        background: active ? color + '18' : 'rgba(255,255,255,0.04)',
        color: active ? color : '#94a3b8',
    }
}
