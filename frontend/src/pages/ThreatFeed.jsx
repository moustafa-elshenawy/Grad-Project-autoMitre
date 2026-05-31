import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, Settings2, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader, Shield, AlertTriangle, Wifi, Database } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'

const API = 'http://127.0.0.1:8000'

const SEV_COLOR = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#22c55e', Informational: '#64748b' }
const SEV_CLASS = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' }

const SOURCE_META = {
    misp: { label: 'MISP', color: '#f59e0b', icon: '•' },
    urlhaus: { label: 'URLhaus', color: '#10b981', icon: '•' },
    bazaar: { label: 'MalwareBazaar', color: '#3b82f6', icon: '•' },
    otx: { label: 'AlienVault OTX', color: '#a855f7', icon: '•' },
    db: { label: 'AutoMITRE', color: '#00ff41', icon: '•' },
}

function authHeader() {
    const t = localStorage.getItem('token')
    return t ? { Authorization: `Bearer ${t}` } : {}
}

function getFrameworkBadgeStyle(f) {
    const fUpper = f.toUpperCase()
    if (fUpper.includes('ATTACK') || fUpper.includes('ATT&CK')) {
        return { background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.25)' }
    }
    if (fUpper.includes('DEFEND')) {
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }
    }
    if (fUpper.includes('NIST')) {
        return { background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)' }
    }
    if (fUpper.includes('OWASP')) {
        return { background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.25)' }
    }
    return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.1)' }
}

function formatFeedTime(ts) {
    if (!ts) return ''
    try {
        const date = new Date(ts)
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch {
        return ts
    }
}

// ── Source Status Badge ───────────────────────────────────────────────────────
function SourceBadge({ sourceKey, status, configured }) {
    const meta = SOURCE_META[sourceKey] || { label: sourceKey, color: '#94a3b8', icon: '•' }
    const active = status === 'active'
    const err = status === 'error'
    const notConfigured = configured === false

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
            <span style={{ color: dotColor, fontSize: 8, display: 'inline-block', lineHeight: 1 }}>⬤</span>
            {meta.label}
        </div>
    )
}

// ── MISP Config Panel ─────────────────────────────────────────────────────────
function MispConfigPanel({ onSaved }) {
    const [form, setForm] = useState({ misp_url: '', misp_api_key: '', otx_api_key: '' })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        axios.get(`${API}/api/settings/osint`, { headers: authHeader() })
            .then(r => setForm({
                misp_url: r.data.misp_url || '',
                misp_api_key: r.data.misp_api_key || '',
                otx_api_key: r.data.otx_api_key || '',
            }))
            .catch(() => { })
    }, [])

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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, boxSizing: 'border-box', flex: 1, minHeight: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                <Settings2 size={16} color="var(--bold-primary)" />
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>OSINT Source Configuration</h3>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                Free feeds (URLhaus, MalwareBazaar) are active. Configure optional sources below to enrich threat profiles.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
                <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>MISP URL</label>
                    <input
                        className="form-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
                        value={form.misp_url}
                        onChange={e => setForm(f => ({ ...f, misp_url: e.target.value }))}
                        placeholder="https://your-misp-instance.com"
                    />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>MISP API Key</label>
                        <input
                            className="form-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
                            type="password"
                            value={form.misp_api_key}
                            onChange={e => setForm(f => ({ ...f, misp_api_key: e.target.value }))}
                            placeholder="API Key"
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OTX API Key</label>
                        <input
                            className="form-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
                            type="password"
                            value={form.otx_api_key}
                            onChange={e => setForm(f => ({ ...f, otx_api_key: e.target.value }))}
                            placeholder="OTX Key"
                        />
                    </div>
                </div>
            </div>

            {message && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: message.ok ? '#10b981' : '#ef4444', marginTop: 4 }}>
                    {message.ok ? <CheckCircle size={12} /> : <XCircle size={12} />} {message.text}
                </div>
            )}

            <button
                className="btn btn-primary" style={{ fontSize: 12, padding: '10px 16px', width: '100%', marginTop: 4, justifyContent: 'center' }}
                onClick={save} disabled={saving}
            >
                {saving ? 'Saving...' : 'Save Configuration'}
            </button>
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
            {/* Header Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: '#00ff41', boxShadow: '0 0 8px #00ff41' }}></span>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>
                        OSINT Feeds: <strong style={{ color: '#00ff41' }}>Active</strong> 
                        {lastUpdated && ` · Sync: ${new Date(lastUpdated).toLocaleTimeString()}`}
                    </span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchFeed} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={12} className={loading ? 'spinning' : ''} /> Refresh Feeds
                </button>
            </div>

            {/* Config & Severity Container */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24, alignItems: 'stretch' }}>
                {isContextualAdmin && <MispConfigPanel onSaved={fetchFeed} />}
                
                {/* Threat Severity Stats */}
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={16} color="var(--bold-primary)" />
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Severity Metrics</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, flex: 1 }}>
                        {['Critical', 'High', 'Medium', 'Low'].map(s => {
                            const isActive = sevFilter === s
                            const color = SEV_COLOR[s]
                            return (
                                <div
                                    key={s}
                                    onClick={() => setSev(sevFilter === s ? 'all' : s)}
                                    style={{
                                        background: isActive ? `${color}15` : 'rgba(255,255,255,0.01)',
                                        border: isActive ? `2px solid ${color}` : '2px solid var(--bold-surface)',
                                        borderRadius: 8,
                                        padding: '12px 14px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: isActive ? `0 0 12px ${color}15` : 'none',
                                    }}
                                >
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                                            {loading ? '—' : counts[s]}
                                        </div>
                                        <div style={{ fontSize: 9, fontWeight: 600, color: isActive ? color : 'var(--text-muted)', opacity: isActive ? 1 : 0.6 }}>
                                            {isActive ? 'ACTIVE' : 'FILTER'}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Source Status Bar & Filters Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20, borderBottom: '1px solid var(--bold-surface)', paddingBottom: 16 }}>
                {Object.keys(sources).length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status:</span>
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

                {/* Source filter dropdown */}
                {activeSources.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            Filter Source:
                        </label>
                        <select
                            className="form-input"
                            value={srcFilter}
                            onChange={(e) => setSrc(e.target.value)}
                            style={{
                                padding: '6px 12px',
                                minHeight: '32px',
                                height: '32px',
                                width: 'auto',
                                minWidth: '160px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                background: 'var(--bg-card)',
                                borderColor: 'var(--border-dim)',
                                color: '#fff',
                                fontWeight: 600,
                                borderRadius: '4px',
                            }}
                        >
                            <option value="all" style={{ background: '#111', color: '#fff' }}>All Sources</option>
                            {activeSources.map(([key, meta]) => (
                                <option key={key} value={key} style={{ background: '#111', color: meta.color || '#fff' }}>
                                    {meta.label}
                                </option>
                            ))}
                        </select>
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
                                style={{
                                    borderLeft: `4px solid ${sevColor}`,
                                    transition: 'all 0.2s ease',
                                    padding: '16px 20px',
                                    background: 'var(--bg-card)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span className={`badge badge-${SEV_CLASS[t.severity] || 'info'}`}>{t.severity}</span>
                                        {t.is_historic && (
                                            <span title="Loaded from local database storage" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--bold-primary)', background: 'rgba(0,255,65,0.05)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(0,255,65,0.15)', gap: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                                                <Database size={11} /> CACHED
                                            </span>
                                        )}
                                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff', margin: 0 }}>{t.title}</h3>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, background: `${srcMeta.color}15`, color: srcMeta.color, border: `1px solid ${srcMeta.color}25`, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                                            {srcMeta.label}
                                        </span>
                                        <span>•</span>
                                        <span>{formatFeedTime(t.timestamp)}</span>
                                    </div>
                                </div>

                                {t.description && (
                                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                                        {t.description}
                                    </p>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12, marginTop: 4 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: '240px' }}>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                            {t.technique && (
                                                <span className="badge badge-attack" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                                                    {t.technique}
                                                </span>
                                            )}
                                            {t.tactic && t.tactic !== 'Unknown' && (
                                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    Tactic: <strong>{t.tactic}</strong>
                                                </span>
                                            )}
                                        </div>

                                        {t.iocs?.length > 0 && (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                                {t.iocs.map((ioc, i) => (
                                                    <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ioc}>
                                                        {ioc}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {t.tags?.length > 0 && (
                                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                {t.tags.map((tag, i) => (
                                                    <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {t.frameworks?.map(f => {
                                                const badgeStyle = getFrameworkBadgeStyle(f)
                                                return (
                                                    <span
                                                        key={f}
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            padding: '3px 8px',
                                                            borderRadius: 4,
                                                            ...badgeStyle
                                                        }}
                                                    >
                                                        {f}
                                                    </span>
                                                )
                                            })}
                                        </div>

                                        {t.frameworks?.length > 0 && (t.technique || t.external_url) && (
                                            <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 12 }}>|</span>
                                        )}

                                        <div style={{ display: 'flex', gap: 12 }}>
                                            {t.technique && (
                                                <a
                                                    href={`https://attack.mitre.org/techniques/${t.technique.replace('.', '/')}`}
                                                    target="_blank" rel="noreferrer"
                                                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: 'var(--bold-primary)' }}
                                                    className="auth-link"
                                                >
                                                    ATT&CK <ExternalLink size={10} />
                                                </a>
                                            )}
                                            {t.external_url && (
                                                <a
                                                    href={t.external_url}
                                                    target="_blank" rel="noreferrer"
                                                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: srcMeta.color }}
                                                    className="auth-link"
                                                >
                                                    Details <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
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
        flexShrink: 0,
    }
}
