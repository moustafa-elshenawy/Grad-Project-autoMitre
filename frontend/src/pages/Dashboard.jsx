import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { AlertTriangle, Shield, Activity, TrendingUp, Zap, Globe, Lock, Clock, Target, Crosshair, Compass, Layers, List, Play, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
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
    const [allThreats, setAllThreats] = useState([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(new Date())
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
            setAllThreats(r.data.threats || [])
        }).catch(() => { })

        axios.get(`${API}/api/dashboard/trends${viewParam}`, { headers }).then(r => {
            setTrends(r.data)
        }).catch(() => { })

        axios.get(`${API}/api/framework/coverage`, { headers }).then(r => {
            const byTactic = r.data.attack?.by_tactic || {}
            const formatted = Object.entries(byTactic).map(([name, val]) => ({
                name,
                covered: val.covered,
                total: val.total,
                percentage: val.total > 0 ? (val.covered / val.total) * 100 : 0
            })).sort((a, b) => b.covered - a.covered || b.percentage - a.percentage).slice(0, 4)
            setTacticCoverage(formatted)
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
            {/* Dynamic summary table under the centered page header */}
            <div className="card" style={{
                padding: '20px',
                marginBottom: 24,
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace", color: '#fff' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.35)', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em', color: '#00ff41', textShadow: '0 0 6px rgba(0, 255, 65, 0.3)' }}>
                            <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'left' }}>Total Threats</th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'left' }}>Avg Risk Score</th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'left' }}>Attack Techniques</th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'left' }}>Active Frameworks</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                            <td style={{ padding: '18px 16px', textAlign: 'left' }}>
                                <span style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>{stats.total_threats}</span>
                            </td>
                            <td style={{ padding: '18px 16px', textAlign: 'left', color: stats.risk_score_avg >= 7 ? '#ef4444' : stats.risk_score_avg >= 4 ? '#f59e0b' : '#10b981' }}>
                                <span style={{ textShadow: '0 0 10px currentColor' }}>{stats.risk_score_avg.toFixed(1)}/10</span>
                            </td>
                            <td style={{ padding: '18px 16px', textAlign: 'left' }}>
                                <span style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>{stats.techniques_covered}</span>
                            </td>
                            <td style={{ padding: '18px 16px', textAlign: 'left', fontSize: 13, color: '#9CA3AF', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                                {stats.active_framework_names && stats.active_framework_names.length 
                                    ? stats.active_framework_names.join(' · ') 
                                    : 'MITRE ATT&CK · D3FEND · NIST · OWASP'}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="dashboard-grid">
                
                {/* 1. Welcome Card (Span 3) */}
                <div className="card col-span-3" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em', textTransform: 'none' }}>
                            Welcome back, {user?.username || 'Analyst'}!
                        </h2>
                        <p style={{ color: '#9CA3AF', fontSize: 14 }}>
                            Your environment is calibrated. The AI has refined your threat landscape.
                        </p>
                    </div>

                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 20, border: '1px solid rgba(0, 255, 65, 0.15)' }}>
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


                {/* 3. Severity Distribution (Span 1) */}
                <div className="card col-span-1" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <AlertTriangle size={15} color="#00ff41" /> Severity Distribution
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {severityDist.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No threats analyzed</div>
                        ) : (
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1 }}>
                                {/* Left side: Doughnut Chart */}
                                <div style={{ width: '40%', height: 130, position: 'relative' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={severityDist} cx="50%" cy="50%" innerRadius={34} outerRadius={48} paddingAngle={4} dataKey="value" strokeWidth={0}>
                                                {severityDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Right side: Progress bars */}
                                <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {(() => {
                                        const totalSeverities = severityDist.reduce((acc, curr) => acc + curr.value, 0) || 1;
                                        return severityDist.map(s => {
                                            const pct = (s.value / totalSeverities) * 100;
                                            return (
                                                <div key={s.name}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                                                        <span>{s.name}</span>
                                                        <span style={{ color: '#fff' }}>{s.value}</span>
                                                    </div>
                                                    <div style={{ height: 6, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${pct}%`,
                                                            background: s.color,
                                                            borderRadius: 3,
                                                            boxShadow: `0 0 8px ${s.color}60`,
                                                            transition: 'width 0.8s ease'
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                {/* 4. ATT&CK Tactic Coverage (Span 2) */}
                <div className="card col-span-2" style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Compass size={15} color="#00ff41" /> ATT&CK Tactic Coverage
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
                        {tacticCoverage.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No tactic data available</div>
                        ) : (
                            tacticCoverage.map(t => (
                                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: '30%', color: '#D1D5DB', fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>
                                        {t.name}
                                    </div>
                                    <div style={{ flex: 1, height: 8, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${t.percentage}%`,
                                            background: '#3b82f6',
                                            borderRadius: 4,
                                            boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                                            transition: 'width 0.8s ease'
                                        }} />
                                    </div>
                                    <div style={{ width: '15%', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                                        {t.covered}/{t.total}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
                                <tr style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.18)', color: '#6B7280' }}>
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
                                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.1)', transition: 'background 0.2s' }}>
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

                {/* 6. SOC Event Calendar (Span 4) */}
                <div className="card col-span-4" style={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Calendar size={15} color="#00ff41" /> SOC Event Calendar
                    </div>
                    
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', flex: 1 }}>
                        {/* Calendar Grid Side */}
                        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column' }}>
                            {/* Calendar Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                                    {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                                </span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button 
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <button 
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Weekday Labels */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => <div key={d}>{d}</div>)}
                            </div>
                            
                            {/* Days Grid */}
                            <div className="calendar-grid">
                                {(() => {
                                    const y = currentDate.getFullYear();
                                    const m = currentDate.getMonth();
                                    const firstDayIdx = new Date(y, m, 1).getDay();
                                    const totalDays = new Date(y, m + 1, 0).getDate();
                                    const prevTotalDays = new Date(y, m, 0).getDate();
                                    
                                    const cells = [];
                                    
                                    for (let i = firstDayIdx - 1; i >= 0; i--) {
                                        const dayVal = prevTotalDays - i;
                                        cells.push({
                                            date: new Date(y, m - 1, dayVal),
                                            isCurrentMonth: false,
                                            label: dayVal
                                        });
                                    }
                                    
                                    for (let i = 1; i <= totalDays; i++) {
                                        cells.push({
                                            date: new Date(y, m, i),
                                            isCurrentMonth: true,
                                            label: i
                                        });
                                    }
                                    
                                    const remaining = 42 - cells.length;
                                    for (let i = 1; i <= remaining; i++) {
                                        cells.push({
                                            date: new Date(y, m + 1, i),
                                            isCurrentMonth: false,
                                            label: i
                                        });
                                    }
                                    
                                    return cells.map((cell, idx) => {
                                        const threatsOnDay = allThreats.filter(t => {
                                            if (!t.timestamp) return false;
                                            const yStr = cell.date.getFullYear();
                                            const mStr = String(cell.date.getMonth() + 1).padStart(2, '0');
                                            const dStr = String(cell.date.getDate()).padStart(2, '0');
                                            return t.timestamp.startsWith(`${yStr}-${mStr}-${dStr}`);
                                        });
                                        
                                        const isSelected = selectedDate && 
                                            cell.date.getDate() === selectedDate.getDate() &&
                                            cell.date.getMonth() === selectedDate.getMonth() &&
                                            cell.date.getFullYear() === selectedDate.getFullYear();
                                            
                                        const isToday = (() => {
                                            const today = new Date();
                                            return cell.date.getDate() === today.getDate() &&
                                                cell.date.getMonth() === today.getMonth() &&
                                                cell.date.getFullYear() === today.getFullYear();
                                        })();
                                        
                                        let severityColor = '';
                                        if (threatsOnDay.length > 0) {
                                            if (threatsOnDay.some(t => t.severity === 'Critical')) severityColor = '#ef4444';
                                            else if (threatsOnDay.some(t => t.severity === 'High')) severityColor = '#f97316';
                                            else if (threatsOnDay.some(t => t.severity === 'Medium')) severityColor = '#f59e0b';
                                            else if (threatsOnDay.some(t => t.severity === 'Low')) severityColor = '#10b981';
                                            else severityColor = '#64748b';
                                        }
                                        
                                        return (
                                            <div 
                                                key={idx}
                                                onClick={() => setSelectedDate(cell.date)}
                                                className={`calendar-day-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                                            >
                                                {cell.label}
                                                {threatsOnDay.length > 0 && (
                                                    <span 
                                                        className="calendar-threat-dot"
                                                        style={{ 
                                                            color: severityColor, 
                                                            background: severityColor,
                                                            bottom: isSelected ? '6px' : '4px'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        
                        {/* Threat Details Side */}
                        <div style={{ flex: '1 1 350px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, marginBottom: 12 }}>
                                Active Footprint: {selectedDate ? selectedDate.toLocaleDateString('default', { dateStyle: 'medium' }) : 'Select a date'}
                            </div>
                            
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(() => {
                                    if (!selectedDate) {
                                        return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>Select a date on the calendar to inspect threats.</div>;
                                    }
                                    
                                    const yStr = selectedDate.getFullYear();
                                    const mStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                    const dStr = String(selectedDate.getDate()).padStart(2, '0');
                                    const selectedDateStr = `${yStr}-${mStr}-${dStr}`;
                                    
                                    const filteredThreats = allThreats.filter(t => t.timestamp && t.timestamp.startsWith(selectedDateStr));
                                    
                                    if (filteredThreats.length === 0) {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: 'rgba(255,255,255,0.4)' }}>
                                                <Shield size={32} color="#10b981" style={{ opacity: 0.8, filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.3))' }} />
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>System Fully Secure</div>
                                                <div style={{ fontSize: 11, textAlign: 'center' }}>No threat events recorded on this day.</div>
                                            </div>
                                        );
                                    }
                                    
                                    return filteredThreats.map(t => {
                                        const sevColor = t.severity === 'Critical' ? '#ef4444' : t.severity === 'High' ? '#f97316' : t.severity === 'Medium' ? '#f59e0b' : '#10b981';
                                        return (
                                            <div 
                                                key={t.id}
                                                style={{ 
                                                    background: 'rgba(255,255,255,0.02)', 
                                                    border: '1px solid rgba(255,255,255,0.05)', 
                                                    borderLeft: `3px solid ${sevColor}`,
                                                    borderRadius: 6,
                                                    padding: '10px 12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 6
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                                        {t.title}
                                                    </span>
                                                    <span style={{ fontSize: 9, padding: '1px 6px', background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}30`, borderRadius: 3, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {t.severity.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                                                    <span>{t.tactic !== 'Unknown' ? t.tactic : 'General'}</span>
                                                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Historical Pattern Analysis (30-Day Trends) */}
            <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <Layers size={18} color="#3b82f6" /> Historical Pattern Analysis (30-Day Trends)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {/* Card 1: Most Targeted Assets */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 340 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <Crosshair size={15} color="#ef4444" /> Most Targeted Assets
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
                            {!trends?.top_targets?.length ? (
                                <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No asset targeting recorded.</div>
                            ) : (
                                trends.top_targets.slice(0, 6).map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: idx < Math.min(trends.top_targets.length, 6) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', fontSize: 12 }}>
                                        <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: "'JetBrains Mono', monospace" }}>
                                            <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 6 }}>[{item.type.toUpperCase()}]</span>
                                            {item.value}
                                        </span>
                                        <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{item.count}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Card 2: Emerging Threats (Top Techniques) */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 340 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <Activity size={15} color="#f97316" /> Emerging Threats (Top Techniques)
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                            {!trends?.top_techniques?.length ? (
                                <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No techniques recorded.</div>
                            ) : (
                                (() => {
                                    const maxTechCount = Math.max(...trends.top_techniques.map(t => t.count)) || 1;
                                    return trends.top_techniques.slice(0, 5).map((t, idx) => (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#D1D5DB', marginBottom: 4 }}>
                                                <span style={{ maxWidth: '80%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                                                <span style={{ color: '#f97316', fontFamily: "'JetBrains Mono', monospace" }}>{t.count}</span>
                                            </div>
                                            <div style={{ height: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${(t.count / maxTechCount) * 100}%`,
                                                    background: '#f97316',
                                                    borderRadius: 3,
                                                    boxShadow: '0 0 8px rgba(249, 115, 22, 0.4)',
                                                    transition: 'width 0.8s ease'
                                                }} />
                                            </div>
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                    </div>

                    {/* Card 3: Aggregate Prediction Patterns */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 340 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D1D5DB', fontSize: 13, fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <Compass size={15} color="#10b981" /> Aggregate Prediction Patterns
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(() => {
                                const pred1 = trends?.top_predictions?.[0]?.title || 'Final Objective Containment';
                                const pred2 = trends?.top_predictions?.[1]?.title || 'Exfiltrate Data';
                                const pred3 = trends?.top_predictions?.[2]?.title || 'Establish Persistence';
                                return (
                                    <div style={{
                                        background: 'rgba(16, 185, 129, 0.04)',
                                        border: '1px solid rgba(16, 185, 129, 0.28)',
                                        borderRadius: 12,
                                        padding: '20px 24px',
                                        fontSize: 13,
                                        lineHeight: 1.8,
                                        color: 'rgba(255, 255, 255, 0.65)',
                                        fontFamily: "'Inter', sans-serif"
                                    }}>
                                        Based on the collective patterns observed in the current active footprint, the attacker will most likely prioritize <strong style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }}>{pred1}</strong> as their core tactical objective. Subsequently, it is highly probable the progression will navigate towards <strong style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }}>{pred2}</strong> and <strong style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }}>{pred3}</strong> to achieve full exploitation.
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
