import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { AlertTriangle, Shield, Activity, TrendingUp, Zap, Globe, Lock, Clock } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'

const API = 'http://localhost:8000'

const TACTIC_COLORS = {
    'Initial Access': '#ef4444',
    'Execution': '#f97316',
    'Persistence': '#f59e0b',
    'Privilege Escalation': '#eab308',
    'Defense Evasion': '#84cc16',
    'Credential Access': '#10b981',
    'Discovery': '#06b6d4',
    'Lateral Movement': '#3b82f6',
    'Collection': '#6366f1',
    'Command and Control': '#8b5cf6',
    'Exfiltration': '#a855f7',
    'Impact': '#ec4899',
    'Resource Development': '#64748b',
    'Reconnaissance': '#94a3b8'
}

const TACTIC_DISPLAY_NAMES = {
    'Command and Control': 'C2',
    'Privilege Escalation': 'Priv. Escalation'
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'rgba(6,11,24,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                <p style={{ fontWeight: 600, marginBottom: 6, color: '#f0f4ff' }}>{label}</p>
                {payload.map(p => (
                    <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                        <span>{p.name}:</span><span style={{ fontWeight: 700 }}>{p.value}</span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

export default function Dashboard() {
    const [stats, setStats] = useState({
        total_threats: 0, critical_threats: 0, high_threats: 0,
        medium_threats: 0, low_threats: 0, techniques_covered: 0,
        frameworks_mapped: 0, risk_score_avg: 0.0,
        active_framework_names: []
    })
    const [activity, setActivity] = useState([])
    const [recentThreats, setRecentThreats] = useState([])
    const [tacticCoverage, setTacticCoverage] = useState([])
    const { viewParam, viewParamAmp, viewMode } = useDataView()

    useEffect(() => {
        const token = localStorage.getItem('token')
        const headers = token ? { Authorization: `Bearer ${token}` } : {}

        axios.get(`${API}/api/dashboard/stats${viewParam}`, { headers }).then(r => setStats(r.data)).catch(() => { })

        axios.get(`${API}/api/dashboard/activity${viewParam}`, { headers }).then(r => {
            const data = r.data;
            const formatted = data.labels.map((day, idx) => ({
                day,
                critical: data.datasets.find(d => d.label === 'Critical')?.data[idx] || 0,
                high: data.datasets.find(d => d.label === 'High')?.data[idx] || 0,
                medium: data.datasets.find(d => d.label === 'Medium')?.data[idx] || 0,
                low: data.datasets.find(d => d.label === 'Low')?.data[idx] || 0,
            }))
            setActivity(formatted)
        }).catch(() => { })

        axios.get(`${API}/api/intelligence/feed${viewParam}`, { headers }).then(r => {
            setRecentThreats(r.data.threats.slice(0, 5))
        }).catch(() => { })

        axios.get(`${API}/api/framework/coverage${viewParam}`, { headers }).then(r => {
            if (r.data.attack && r.data.attack.by_tactic) {
                const tactics = Object.entries(r.data.attack.by_tactic).map(([name, stats]) => ({
                    name: TACTIC_DISPLAY_NAMES[name] || name,
                    fullName: name,
                    covered: stats.covered,
                    total: stats.total,
                    color: TACTIC_COLORS[name] || '#64748b'
                }))
                // Sort by standard kill chain order if possible, or alphabetically
                const sortOrder = [
                    'Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 
                    'Persistence', 'Priv. Escalation', 'Defense Evasion', 'Credential Access', 
                    'Discovery', 'Lateral Movement', 'Collection', 'C2', 'Exfiltration', 'Impact'
                ]
                tactics.sort((a, b) => {
                    const idxA = sortOrder.indexOf(a.name)
                    const idxB = sortOrder.indexOf(b.name)
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB
                    return a.name.localeCompare(b.name)
                })
                setTacticCoverage(tactics)
            }
        }).catch(() => { })

    }, [viewMode])

    const severityDist = [
        { name: 'Critical', value: stats.critical_threats, color: '#ef4444' },
        { name: 'High', value: stats.high_threats, color: '#f97316' },
        { name: 'Medium', value: stats.medium_threats, color: '#f59e0b' },
        { name: 'Low', value: stats.low_threats, color: '#22c55e' },
    ].filter(s => s.value > 0)

    const sevClass = (s) => ({ 'Critical': 'critical', 'High': 'high', 'Medium': 'medium', 'Low': 'low' }[s] || 'info')

    return (
        <div>
            {/* Stat Cards */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="stat-card critical">
                    <div className="stat-icon-bg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <AlertTriangle size={18} color="#ef4444" />
                    </div>
                    <div className="stat-label">Total Threats</div>
                    <div className="stat-number">{stats.total_threats.toLocaleString()}</div>
                    <div className="stat-change" style={{ color: '#ef4444' }}>
                        <TrendingUp size={11} /> +12% this week
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-bg" style={{ background: 'rgba(0,212,255,0.1)' }}>
                        <Zap size={18} color="#00d4ff" />
                    </div>
                    <div className="stat-label">Avg Risk Score</div>
                    <div className="stat-number" style={{ background: 'linear-gradient(135deg,#00d4ff,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {stats.risk_score_avg}
                    </div>
                    <div className="stat-change" style={{ color: '#f97316' }}>
                        <TrendingUp size={11} /> HIGH severity
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-bg" style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <Shield size={18} color="#10b981" />
                    </div>
                    <div className="stat-label">ATT&CK Techniques</div>
                    <div className="stat-number">{stats.techniques_covered}</div>
                    <div className="stat-change" style={{ color: '#10b981' }}>
                        <Activity size={11} /> {stats.techniques_covered} of {stats.total_techniques || stats.total_techniques_framework || 635} mapped
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-bg" style={{ background: 'rgba(124,58,237,0.1)' }}>
                        <Globe size={18} color="#7c3aed" />
                    </div>
                    <div className="stat-label">Frameworks Active</div>
                    <div className="stat-number">{stats.frameworks_mapped}</div>
                    <div className="stat-change" style={{ color: '#a78bfa' }}>
                        <Lock size={11} /> {stats.active_framework_names?.length > 0 ? stats.active_framework_names.join(' · ') : 'No frameworks active'}
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
                {/* Threat Activity Chart */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><Activity size={16} color="#00d4ff" /> Threat Activity (7-Day)</div>
                        <span className="badge badge-info">Live</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={activity}>
                            <defs>
                                <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fill="url(#gCrit)" strokeWidth={2} />
                            <Area type="monotone" dataKey="high" name="High" stroke="#f97316" fill="url(#gHigh)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Severity Distribution */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><AlertTriangle size={16} color="#00d4ff" /> Severity Distribution</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {severityDist.length === 0 ? (
                            <div style={{ width: '100%', padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                No threats analyzed yet. Get started in Threat Analysis.
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width={140} height={140}>
                                    <PieChart>
                                        <Pie data={severityDist} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                                            {severityDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ flex: 1 }}>
                                    {severityDist.map(s => (
                                        <div key={s.name} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                                <span style={{ color: s.color, fontWeight: 600 }}>{s.name}</span>
                                                <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div className="progress-bar-fill" style={{ width: `${(s.value / Math.max(stats.total_threats, 1)) * 100}%`, background: s.color }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid-2">
                {/* Recent Threats */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><Clock size={16} color="#00d4ff" /> Recent Threats</div>
                        <a href="/feed" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</a>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentThreats.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                                No recent threats. Analysis feed is clear.
                            </div>
                        ) : recentThreats.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.severity === 'Critical' ? '#ef4444' : '#f97316', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#f0f4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.tactic}</div>
                                </div>
                                <span className={`badge badge-attack`} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, flexShrink: 0 }}>{t.technique}</span>
                                <span className={`badge badge-${sevClass(t.severity)}`} style={{ flexShrink: 0 }}>{t.severity}</span>
                                <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ATT&CK Tactic Coverage */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><Shield size={16} color="#00d4ff" /> ATT&CK Tactic Coverage</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {tacticCoverage.map(t => (
                            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                                <span style={{ width: 110, color: '#94a3b8', flexShrink: 0 }}>{t.name}</span>
                                <div className="progress-bar" style={{ flex: 1 }}>
                                    <div className="progress-bar-fill" style={{ width: `${(t.covered / t.total) * 100}%`, background: t.color }} />
                                </div>
                                <span style={{ width: 40, textAlign: 'right', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{t.covered}/{t.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
