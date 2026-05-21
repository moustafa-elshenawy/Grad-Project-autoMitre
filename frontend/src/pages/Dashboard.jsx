import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { AlertTriangle, Shield, Activity, TrendingUp, Zap, Globe, Lock, Clock, Target, Crosshair, Compass, Layers, List, Play } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'
import { useAuth } from '../contexts/AuthContext'

const API = 'http://127.0.0.1:8000'

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

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'rgba(10, 15, 20, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px', fontSize: 12 }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#f0f4ff' }}>{label}</p>
                {payload.map(p => (
                    <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                            {p.name}
                        </span>
                        <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{p.value}</span>
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
    const [trends, setTrends] = useState(null)
    const { viewParam, viewMode } = useDataView()
    const { user } = useAuth()

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

        axios.get(`${API}/api/dashboard/trends${viewParam}`, { headers }).then(r => {
            setTrends(r.data)
        }).catch(() => { })

    }, [viewMode])

    const severityDist = [
        { name: 'Critical', value: stats.critical_threats, color: '#ef4444' },
        { name: 'High', value: stats.high_threats, color: '#f97316' },
        { name: 'Medium', value: stats.medium_threats, color: '#f59e0b' },
        { name: 'Low', value: stats.low_threats, color: '#10b981' },
    ].filter(s => s.value > 0)

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div className="dashboard-grid">
                
                {/* 1. Welcome Card (Span 2) */}
                <div className="card col-span-2" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em', textTransform: 'none' }}>
                            Welcome back, {user?.username || 'Analyst'}!
                        </h2>
                        <p style={{ color: '#9CA3AF', fontSize: 14 }}>
                            Your environment is calibrated. The AI has refined your threat landscape.
                        </p>
                    </div>

                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 14, fontWeight: 600 }}>
                                <Zap size={16} color="#00ff41" />
                                Threat Activity (7-Day)
                            </div>
                            <span style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                                {stats.total_threats} <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Threats this week</span>
                            </span>
                        </div>
                        <div style={{ height: 160 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activity} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <XAxis dataKey="day" hide />
                                    <Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="high" stackId="a" fill="#f97316" />
                                    <Bar dataKey="medium" stackId="a" fill="#f59e0b" />
                                    <Bar dataKey="low" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: '#6B7280', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                        </div>
                    </div>
                </div>

                {/* 2. Global Risk Score (Span 1) */}
                <div className="card col-span-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 'auto' }}>
                        <Target size={15} color="#00ff41" /> Global Risk Score
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ color: '#10b981', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                            Awaiting Assessment
                        </div>
                        <div style={{ 
                            fontSize: 56, 
                            fontWeight: 900, 
                            fontFamily: "'JetBrains Mono', monospace", 
                            color: '#fff',
                            textShadow: '0 0 30px rgba(0, 255, 65, 0.4)',
                            lineHeight: 1
                        }}>
                            {stats.risk_score_avg.toFixed(1)}
                        </div>
                        <div style={{ marginTop: 24 }}>
                            <button style={{ 
                                background: 'transparent', 
                                border: '1px solid rgba(0,255,65,0.3)', 
                                color: '#00ff41', 
                                padding: '8px 16px', 
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,65,0.1)'; e.currentTarget.style.borderColor = '#00ff41' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(0,255,65,0.3)' }}
                            >
                                <Play size={12} fill="#00ff41" /> Start Risk Tracker
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Severity Distribution (Span 1) */}
                <div className="card col-span-1" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                        <Layers size={15} color="#00ff41" /> Severity Summary
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {severityDist.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No threats analyzed</div>
                        ) : (
                            <>
                                <div style={{ height: 160, position: 'relative' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={severityDist} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" strokeWidth={0}>
                                                {severityDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {severityDist.map(s => (
                                        <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
                                                <span style={{ color: '#D1D5DB' }}>{s.name}</span>
                                            </div>
                                            <span style={{ color: '#fff', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 4. AI Assistant / Prediction (Span 2) */}
                <div className="card col-span-2" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 24, zIndex: 2 }}>
                        <Compass size={15} color="#00ff41" /> AI Assistant
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        {/* CSS 3D Glass Sphere */}
                        <div style={{
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 30% 30%, rgba(0, 255, 65, 0.4), rgba(0, 50, 20, 0.8), rgba(0,0,0,0.9))',
                            boxShadow: '0 0 60px rgba(0, 255, 65, 0.2), inset -10px -10px 30px rgba(0, 0, 0, 0.8), inset 10px 10px 20px rgba(255,255,255,0.1)',
                            position: 'relative',
                            marginBottom: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {/* Inner reflection */}
                            <div style={{
                                position: 'absolute',
                                top: '15%',
                                left: '20%',
                                width: '35%',
                                height: '35%',
                                background: 'radial-gradient(circle, rgba(255,255,255,0.6), transparent 60%)',
                                borderRadius: '50%',
                                transform: 'rotate(-45deg)'
                            }} />
                            {/* Inner swirl lines (pseudo-complex) */}
                            <div style={{
                                width: '110%',
                                height: '110%',
                                borderRadius: '50%',
                                border: '1px solid rgba(0,255,65,0.3)',
                                position: 'absolute',
                                transform: 'rotateX(60deg) rotateY(20deg)',
                                boxShadow: '0 0 10px rgba(0,255,65,0.2)'
                            }} />
                            <div style={{
                                width: '110%',
                                height: '110%',
                                borderRadius: '50%',
                                border: '1px solid rgba(0,255,65,0.3)',
                                position: 'absolute',
                                transform: 'rotateX(60deg) rotateY(-40deg)',
                                boxShadow: '0 0 10px rgba(0,255,65,0.2)'
                            }} />
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>Primary Threat Prediction</div>
                            <div style={{ fontSize: 16, color: '#fff', fontWeight: 700, padding: '0 20px', lineHeight: 1.4 }}>
                                {trends?.top_predictions?.length ? trends.top_predictions[0].title : 'System monitoring active. No anomalies detected.'}
                            </div>
                        </div>
                    </div>
                    
                    {/* Background glowing line */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top, rgba(0,255,65,0.05), transparent)', zIndex: 1 }} />
                </div>

                {/* 5. Recent Threats Table (Span 2) */}
                <div className="card col-span-2" style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600 }}>
                            <Clock size={15} color="#00ff41" /> Threat History
                        </div>
                        <a href="/feed" style={{ fontSize: 12, color: '#00ff41', textDecoration: 'none', fontWeight: 600 }}>View all</a>
                    </div>
                    
                    <div style={{ flex: 1, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#6B7280' }}>
                                    <th style={{ padding: '0 12px 12px 0', fontWeight: 500 }}>Target / Indicator</th>
                                    <th style={{ padding: '0 12px 12px 12px', fontWeight: 500 }}>Tactic</th>
                                    <th style={{ padding: '0 12px 12px 12px', fontWeight: 500 }}>Severity</th>
                                    <th style={{ padding: '0 0 12px 12px', fontWeight: 500, textAlign: 'right' }}>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentThreats.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ padding: '32px 0', textAlign: 'center', color: '#6B7280' }}>No recent threats recorded.</td>
                                    </tr>
                                ) : recentThreats.map(t => (
                                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '16px 12px 16px 0', color: '#fff', fontWeight: 500, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {t.title}
                                        </td>
                                        <td style={{ padding: '16px 12px' }}>
                                            <span style={{ 
                                                background: 'rgba(255,255,255,0.05)', 
                                                color: '#D1D5DB', 
                                                padding: '4px 10px', 
                                                borderRadius: 12, 
                                                fontSize: 11,
                                                border: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                {t.tactic}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 12px' }}>
                                            <span style={{ 
                                                color: t.severity === 'Critical' ? '#ef4444' : t.severity === 'High' ? '#f97316' : t.severity === 'Medium' ? '#f59e0b' : '#10b981',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }} />
                                                {t.severity}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 0 16px 12px', textAlign: 'right', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                                            {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    )
}
