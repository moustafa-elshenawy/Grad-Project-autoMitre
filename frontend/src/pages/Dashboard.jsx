import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { AlertTriangle, Shield, Activity, TrendingUp, Zap, Globe, Lock, Clock, Target, Crosshair, Compass, Layers, List } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'
import { useAuth } from '../contexts/AuthContext'

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
    const { user } = useAuth()
    const [stats, setStats] = useState({
        total_threats: 0, critical_threats: 0, high_threats: 0,
        medium_threats: 0, low_threats: 0, techniques_covered: 0,
        frameworks_mapped: 0, risk_score_avg: 0.0,
        active_framework_names: []
    })
    const [activity, setActivity] = useState([])
    const [recentThreats, setRecentThreats] = useState([])
    const [tacticCoverage, setTacticCoverage] = useState([])
    const [trends, setTrends] = useState(null)
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

        axios.get(`${API}/api/dashboard/trends${viewParam}`, { headers }).then(r => {
            setTrends(r.data)
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
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>Welcome back, {user?.username || 'Analyst'}!</h2>
                    <p style={{ color: '#94a3b8', fontSize: 14 }}>Here's what's happening with your security posture today.</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', borderRadius: 10, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                        <Clock size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} /> Last 7 Days
                    </div>
                    <button className="btn btn-primary" onClick={() => window.location.href = '/analyze'}>
                        <Activity size={16} /> Run New Analysis
                    </button>
                </div>
            </div>

            <div className="bento-grid">
                {/* 1. Threat Activity (Wide) */}
                <div className="card col-span-8" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header">
                        <div className="card-title"><Activity size={16} color="var(--bold-primary)" /> Threat Activity (7-Day)</div>
                        <span className="badge badge-info">Live</span>
                    </div>
                    <div style={{ flex: 1, minHeight: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
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
                </div>

                {/* 2. Stat Cards (Compact 2x2 grid) */}
                <div className="col-span-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                    <div className="stat-card critical" style={{ padding: '16px' }}>
                        <div className="stat-label">Total Threats</div>
                        <div className="stat-number" style={{ fontSize: 32 }}>{stats.total_threats.toLocaleString()}</div>
                        <div className="stat-change" style={{ color: '#ef4444' }}>
                            <TrendingUp size={11} /> +12% this week
                        </div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px' }}>
                        <div className="stat-label">Avg Risk Score</div>
                        <div className="stat-number" style={{ fontSize: 32, background: 'linear-gradient(135deg, var(--bold-primary), var(--bold-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {stats.risk_score_avg}
                        </div>
                        <div className="stat-change" style={{ color: '#f97316' }}>
                            <TrendingUp size={11} /> HIGH severity
                        </div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px' }}>
                        <div className="stat-label">Frameworks</div>
                        <div className="stat-number" style={{ fontSize: 32 }}>{stats.frameworks_mapped}</div>
                        <div className="stat-change" style={{ color: 'var(--bold-primary)' }}>
                            <Lock size={11} /> Active
                        </div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px' }}>
                        <div className="stat-label">ATT&CK Map</div>
                        <div className="stat-number" style={{ fontSize: 32 }}>{stats.techniques_covered}</div>
                        <div className="stat-change" style={{ color: '#10b981' }}>
                            <Shield size={11} /> Techniques
                        </div>
                    </div>
                </div>

                {/* 3. Recent Threats Table (Wide) */}
                <div className="card col-span-8">
                    <div className="card-header">
                        <div className="card-title"><Clock size={16} color="var(--bold-primary)" /> Recent Threats</div>
                        <a href="/feed" style={{ fontSize: 11, color: 'var(--bold-primary)', textDecoration: 'none' }}>View all →</a>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentThreats.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                                No recent threats. Analysis feed is clear.
                            </div>
                        ) : recentThreats.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.severity === 'Critical' ? '#ef4444' : '#f97316', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.tactic}</div>
                                </div>
                                <span className="badge badge-attack" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, flexShrink: 0 }}>{t.technique}</span>
                                <span className={`badge badge-${sevClass(t.severity)}`} style={{ flexShrink: 0 }}>{t.severity}</span>
                                <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0, width: 60, textAlign: 'right' }}>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Severity Distribution (Narrow) */}
                <div className="card col-span-4" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header">
                        <div className="card-title"><AlertTriangle size={16} color="var(--bold-primary)" /> Severity Distribution</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {severityDist.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                No threats analyzed yet. Get started in Threat Analysis.
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                                    <ResponsiveContainer width={160} height={160}>
                                        <PieChart>
                                            <Pie data={severityDist} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0}>
                                                {severityDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div>
                                    {severityDist.map(s => (
                                        <div key={s.name} style={{ marginBottom: 12 }}>
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

                {/* 5. Tactic Coverage (Narrow) */}
                <div className="card col-span-4">
                    <div className="card-header">
                        <div className="card-title"><Shield size={16} color="var(--bold-primary)" /> ATT&CK Coverage</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {tacticCoverage.slice(0, 10).map(t => (
                            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                                <span style={{ width: 110, color: '#94a3b8', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                                <div className="progress-bar" style={{ flex: 1, height: 8 }}>
                                    <div className="progress-bar-fill" style={{ width: `${(t.covered / t.total) * 100}%`, background: t.color }} />
                                </div>
                                <span style={{ width: 35, textAlign: 'right', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{t.covered}/{t.total}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. AI Predictions (Narrow) */}
                <div className="card col-span-4">
                    <div className="card-header">
                        <div className="card-title"><Compass size={16} color="var(--bold-primary)" /> AI Insights</div>
                        <span className="badge badge-info">AutoMITRE</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {trends?.top_predictions?.length ? (
                            <div style={{ background: 'linear-gradient(135deg, rgba(132, 204, 22, 0.05), rgba(20, 184, 166, 0.05))', border: '1px solid rgba(132, 204, 22, 0.1)', padding: 20, borderRadius: 12 }}>
                                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(132, 204, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Zap size={16} color="var(--bold-primary)" />
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Threat Trajectory</div>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: '1.6', margin: 0 }}>
                                    Based on active footprints, attackers will most likely prioritize 
                                    <span style={{ color: 'var(--bold-primary)', fontWeight: 600 }}> {trends.top_predictions[0].title} </span> 
                                    as their core objective. 
                                    
                                    {trends.top_predictions.length >= 3 && (
                                        <span> Subsequently, progression will navigate towards <span style={{ color: 'var(--bold-secondary)', fontWeight: 600 }}>{trends.top_predictions[1].title}</span> and <span style={{ color: 'var(--bold-secondary)', fontWeight: 600 }}>{trends.top_predictions[2].title}</span>.</span>
                                    )}
                                    
                                    {trends.top_predictions.length === 2 && (
                                        <span> Subsequently, progression will navigate towards <span style={{ color: 'var(--bold-secondary)', fontWeight: 600 }}>{trends.top_predictions[1].title}</span>.</span>
                                    )}
                                </p>
                            </div>
                        ) : (
                            <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                                Analyzing telemetry for predictive modeling...
                            </div>
                        )}
                    </div>
                </div>

                {/* 7. Emerging Threats (Wide) */}
                <div className="card col-span-8">
                    <div className="card-header">
                        <div className="card-title"><Crosshair size={16} color="var(--bold-primary)" /> Emerging Threats (Top Techniques)</div>
                    </div>
                    {trends?.top_techniques?.length ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                            {trends.top_techniques.slice(0, 6).map(t => (
                                <div key={t.name} style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                                        <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10, fontWeight: 500 }}>{t.name}</span>
                                        <span style={{ color: 'var(--bold-warning)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{t.count}</span>
                                    </div>
                                    <div className="progress-bar" style={{ background: 'rgba(245, 158, 11, 0.1)', border: 'none' }}>
                                        <div className="progress-bar-fill" style={{ width: `${(t.count / trends.top_techniques[0].count) * 100}%`, background: 'var(--bold-warning)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Not enough historical data collected.</div>
                    )}
                </div>

                {/* 8. Top Targeted Assets (Narrow) */}
                <div className="card col-span-4">
                    <div className="card-header">
                        <div className="card-title"><Target size={16} color="var(--bold-primary)" /> Most Targeted Assets</div>
                    </div>
                    {trends?.top_targets?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {trends.top_targets.map((t, idx) => (
                                <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#f0f4ff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: 13, fontWeight: 600 }}>{t.value}</span>
                                        <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>{t.type}</span>
                                    </div>
                                    <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>{t.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Not enough historical data.</div>
                    )}
                </div>

            </div>
        </div>
    )
}
