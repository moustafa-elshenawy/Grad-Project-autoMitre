import { useState, useEffect, useCallback } from 'react'
import { Shield, Search, Filter, RefreshCw, Download, Activity,
         LogIn, LogOut, Upload, FileText, Settings, Users, Trash2,
         AlertTriangle, CheckCircle, XCircle, Clock, ShieldAlert } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'

const API = 'http://127.0.0.1:8000'

// ── Visual config per category ────────────────────────────────────────────────
const CATEGORY_CONFIG = {
    AUTH:     { icon: LogIn,    color: '#38bdf8', label: 'Authentication' },
    ANALYSIS: { icon: Activity, color: '#a78bfa', label: 'Analysis'       },
    EXPORT:   { icon: Download, color: '#34d399', label: 'Export'          },
    SETTINGS: { icon: Settings, color: '#fbbf24', label: 'Settings'        },
    USER:     { icon: Users,    color: '#fb923c', label: 'User'            },
    TEAM:     { icon: Users,    color: '#0077BC', label: 'Team'            },
    ADMIN:    { icon: Shield,   color: '#f472b6', label: 'Admin'           },
    THREAT:   { icon: Trash2,   color: '#ef4444', label: 'Threat'          },
}

const STATUS_CONFIG = {
    success: { icon: CheckCircle, color: '#10b981', label: 'Success' },
    failure: { icon: XCircle,     color: '#ef4444', label: 'Failure' },
    warning: { icon: AlertTriangle, color: '#f59e0b', label: 'Warning' },
}

function StatCard({ label, value, color, icon: Icon }) {
    return (
        <div className="card" style={{ padding: '16px 20px', borderColor: `${color}25` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>{value}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color={color} />
                </div>
            </div>
        </div>
    )
}

function CategoryBar({ byCategory }) {
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0) || 1
    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map(([cat, count]) => {
                const cfg = CATEGORY_CONFIG[cat] || { color: '#64748b', label: cat }
                const pct = Math.round((count / total) * 100)
                return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 92, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{cfg.label}</span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 100, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 100, transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ width: 32, fontSize: 11, color: '#64748b', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                    </div>
                )
            })}
        </div>
    )
}

function LogRow({ log }) {
    const catCfg  = CATEGORY_CONFIG[log.category] || { icon: Shield, color: '#64748b', label: log.category }
    const statCfg = STATUS_CONFIG[log.status]       || { icon: CheckCircle, color: '#10b981' }
    const CatIcon  = catCfg.icon
    const StatIcon = statCfg.icon

    const ts = new Date(log.timestamp)
    const timeStr = ts.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })

    return (
        <tr style={{ transition: 'background 0.15s' }}>
            <td>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#475569' }}>
                    {log.id.slice(0, 8)}
                </span>
            </td>
            <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${catCfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CatIcon size={12} color={catCfg.color} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: catCfg.color }}>{log.category}</span>
                </div>
            </td>
            <td>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#94a3b8' }}>{log.action}</span>
            </td>
            <td>
                <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{log.username || '—'}</span>
            </td>
            <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StatIcon size={12} color={statCfg.color} />
                    <span style={{ fontSize: 11, color: statCfg.color, fontWeight: 600 }}>{log.status}</span>
                </div>
            </td>
            <td>
                <div style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {Object.entries(log.details || {}).map(([k, v]) => (
                        <span key={k} style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 5px', marginRight: 4, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                            {k}={String(v)}
                        </span>
                    ))}
                </div>
            </td>
            <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: 11 }}>
                    <Clock size={10} />
                    {timeStr}
                </div>
            </td>
        </tr>
    )
}

const CATEGORIES = ['', 'AUTH', 'ANALYSIS', 'EXPORT', 'SETTINGS', 'USER', 'TEAM', 'ADMIN', 'THREAT']
const STATUSES   = ['', 'success', 'failure', 'warning']

export default function AuditLog() {
    const [logs,   setLogs]   = useState([])
    const [stats,  setStats]  = useState(null)
    const [total,  setTotal]  = useState(0)
    const [loading, setLoading] = useState(true)
    const [error,  setError]  = useState(null)

    const [filterCat,    setFilterCat]    = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [search,       setSearch]       = useState('')
    const [offset,       setOffset]       = useState(0)
    const LIMIT = 50

    const { isContextualAdmin } = useDataView()

    const fetchLogs = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const token = localStorage.getItem('token')
            const headers = { Authorization: `Bearer ${token}` }
            const params = { limit: LIMIT, offset }
            if (filterCat)    params.category = filterCat
            if (filterStatus) params.status   = filterStatus

            const [logsRes, statsRes] = await Promise.all([
                axios.get(`${API}/api/audit-logs`,       { headers, params }),
                axios.get(`${API}/api/audit-logs/stats`, { headers }),
            ])
            setLogs(logsRes.data.logs)
            setTotal(logsRes.data.total)
            setStats(statsRes.data)
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to load audit logs — admin access required')
        }
        setLoading(false)
    }, [filterCat, filterStatus, offset])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const filteredLogs = search
        ? logs.filter(l =>
            l.action.includes(search.toLowerCase()) ||
            (l.username || '').toLowerCase().includes(search.toLowerCase()) ||
            l.category.toLowerCase().includes(search.toLowerCase())
          )
        : logs

    const totalPages = Math.ceil(total / LIMIT)
    const currentPage = Math.floor(offset / LIMIT) + 1

    if (!isContextualAdmin) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <ShieldAlert size={48} style={{ margin: '0 auto 20px', color: '#ef4444' }} />
                <h3>Administrator Access Required</h3>
                <p>You must either switch to Private view mode or be promoted to an Admin <br /> within your active team to view the audit log.</p>
            </div>
        )
    }

    return (
        <div>
            {/* Redundant local header removed; page-level title is rendered globally by AppLayout */}

            {error && (
                <div className="alert alert-critical" style={{ marginBottom: 20 }}>
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Stats row */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    <StatCard label="Events (30d)" value={stats.total} color="#0077BC" icon={Activity} />
                    <StatCard label="Successful"   value={stats.by_status?.success || 0} color="#10b981" icon={CheckCircle} />
                    <StatCard label="Failures"     value={stats.by_status?.failure || 0} color="#ef4444" icon={XCircle} />
                    <StatCard label="Warnings"     value={stats.by_status?.warning || 0} color="#f59e0b" icon={AlertTriangle} />
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 20 }}>
                {/* Filters */}
                <div className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Search */}
                        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                            <input
                                className="form-input"
                                placeholder="Search action, user, category…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 32, height: 36, fontSize: 12 }}
                            />
                        </div>
                        {/* Category filter */}
                        <select className="form-input" value={filterCat} onChange={e => { setFilterCat(e.target.value); setOffset(0) }}
                            style={{ width: 150, height: 36, fontSize: 12 }}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c || 'All Categories'}</option>)}
                        </select>
                        {/* Status filter */}
                        <select className="form-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setOffset(0) }}
                            style={{ width: 130, height: 36, fontSize: 12 }}>
                            {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
                        </select>
                        <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap', marginRight: 'auto' }}>
                            {total} total events
                        </span>
                        <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading} style={{ height: 36, minHeight: 36 }}>
                            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Category breakdown */}
                {stats?.by_category && (
                    <div className="card" style={{ padding: 16 }}>
                        <div className="card-title" style={{ marginBottom: 12, fontSize: 12 }}>
                            <Filter size={13} color="var(--accent-blue)" /> Category Breakdown
                        </div>
                        <CategoryBar byCategory={stats.by_category} />
                    </div>
                )}
            </div>

            {/* Log table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={14} color="var(--accent-blue)" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Event Timeline</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
                        Page {currentPage} of {totalPages || 1}
                    </span>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px' }} />
                        Loading audit events…
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
                        <Shield size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                        No audit events found
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Category</th>
                                    <th>Action</th>
                                    <th>User</th>
                                    <th>Status</th>
                                    <th>Details</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map(log => <LogRow key={log.id} log={log} />)}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {total > LIMIT && (
                    <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}>
                            ← Prev
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total}>
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
