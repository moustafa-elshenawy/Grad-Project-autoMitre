import { useState, useEffect } from 'react'
import { Info, Clock } from 'lucide-react'
import { useDataView } from '../contexts/DataViewContext'

function getCellColor(likelihood, impact) {
    const risk = likelihood * impact
    if (risk >= 16) return { bg: 'rgba(239,68,68,0.85)', label: 'CRITICAL', border: '#ef4444' }
    if (risk >= 9) return { bg: 'rgba(249,115,22,0.75)', label: 'HIGH', border: '#f97316' }
    if (risk >= 4) return { bg: 'rgba(245,158,11,0.65)', label: 'MED', border: '#f59e0b' }
    return { bg: 'rgba(34,197,94,0.5)', label: 'LOW', border: '#22c55e' }
}

export default function RiskHeatmap() {
    const [selected, setSelected] = useState(null)
    const [threats, setThreats] = useState({})
    const [loading, setLoading] = useState(true)
    const { viewParam, viewMode } = useDataView()

    const likelihoods = [1, 2, 3, 4, 5]
    const impacts = [5, 4, 3, 2, 1] // top to bottom

    const impactLabels = { 5: 'Catastrophic', 4: 'Critical', 3: 'Major', 2: 'Minor', 1: 'Negligible' }
    const likelihoodLabels = { 1: 'Rare', 2: 'Unlikely', 3: 'Possible', 4: 'Likely', 5: 'Almost Certain' }

    useEffect(() => {
        const fetchThreats = async () => {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                const res = await fetch(`http://127.0.0.1:8000/api/users/history${viewParam}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    const items = data.items || []

                    // Group threats by rounded likelihood and impact
                    const grouped = {}
                    items.forEach(threat => {
                        if (!threat.risk_score) return

                        // Map continuous 1-5 scale to discrete grid cells
                        const l = Math.min(5, Math.max(1, Math.round(threat.risk_score.likelihood || 1)))
                        const i = Math.min(5, Math.max(1, Math.round(threat.risk_score.impact || 1)))

                        const key = `${l}-${i}`
                        if (!grouped[key]) grouped[key] = []
                        grouped[key].push(threat)
                    })
                    setThreats(grouped)
                }
            } catch (error) {
                console.error("Failed to load history:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchThreats()
    }, [viewMode])

    const formatTime = (ts) => {
        try {
            return new Date(ts).toLocaleString()
        } catch {
            return ts
        }
    }

    const getTopTechniques = () => {
        const allThreats = Object.values(threats).flat()
        const counts = {}
        allThreats.forEach(t => {
            if (t.attack_techniques && Array.isArray(t.attack_techniques)) {
                t.attack_techniques.forEach(tech => {
                    const key = tech.id
                    if (!counts[key]) {
                        counts[key] = { id: tech.id, name: tech.name, tactic: tech.tactic, count: 0 }
                    }
                    counts[key].count += 1
                })
            }
        })
        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
    }

    const topTechs = getTopTechniques()


    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                {loading ? (
                    <div className="alert alert-info">
                        <Info size={14} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12 }}>Loading dynamic threat history mapping...</span>
                    </div>
                ) : (
                    <div className="alert alert-info">
                        <Info size={14} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12 }}>Click any cell to see associated analyzed threats. Likelihood (X-axis) × Impact (Y-axis) = Risk Score.</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                {/* Y-axis label */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 532, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Impact →</span>
                </div>

                <div style={{ flexShrink: 0 }}>
                    {/* Y-axis labels + grid */}
                    {impacts.map(impact => (
                        <div key={impact} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 90, textAlign: 'right', fontSize: 11, color: '#94a3b8', flexShrink: 0, fontWeight: 600 }}>
                                {impact} — {impactLabels[impact]}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {likelihoods.map(likelihood => {
                                    const key = `${likelihood}-${impact}`
                                    const cellThreats = threats[key] || []
                                    const { bg, label, border } = getCellColor(likelihood, impact)
                                    const isSelected = selected === key
                                    return (
                                        <div
                                            key={likelihood}
                                            className="heatmap-cell"
                                            style={{
                                                background: bg,
                                                border: `2px solid ${isSelected ? border : 'rgba(255, 255, 255, 0.08)'}`,
                                                boxShadow: isSelected ? `0 0 18px ${border}b0` : 'none',
                                                width: 100,
                                                height: 100,
                                                color: 'white',
                                                flexDirection: 'column',
                                                gap: 4,
                                                padding: '8px',
                                                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => setSelected(isSelected ? null : key)}
                                        >
                                            <span style={{ fontSize: 24, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                                {likelihood * impact}
                                            </span>
                                            <span style={{ fontSize: 9, letterSpacing: 0.5, opacity: 0.85, textTransform: 'uppercase' }}>{label}</span>
                                            {cellThreats.length > 0 && (
                                                <span style={{
                                                    position: 'absolute',
                                                    top: 4,
                                                    right: 4,
                                                    background: 'rgba(0, 0, 0, 0.65)',
                                                    padding: '2px 5px',
                                                    borderRadius: 4,
                                                    fontSize: 9,
                                                    fontFamily: 'JetBrains Mono, monospace',
                                                    color: '#38bdf8',
                                                    fontWeight: 600,
                                                    border: '1px solid rgba(255, 255, 255, 0.15)'
                                                }}>
                                                    {cellThreats.length}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    {/* X-axis labels */}
                    <div style={{ display: 'flex', paddingLeft: 98 }}>
                        {likelihoods.map(l => (
                            <div key={l} style={{ width: 100, marginRight: 8, textAlign: 'center', fontSize: 10, color: '#475569', marginTop: 6, flexShrink: 0 }}>
                                <div style={{ fontWeight: 700, color: '#94a3b8' }}>{l}</div>
                                <div style={{ fontSize: 9, marginTop: 2, color: 'rgba(255, 255, 255, 0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={likelihoodLabels[l]}>
                                    {likelihoodLabels[l]}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ textAlign: 'center', paddingLeft: 98, fontSize: 11, color: '#94a3b8', marginTop: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>
                        Likelihood →
                    </div>
                </div>

                {/* Legend + selected details */}
                <div style={{ width: 220, flexShrink: 0 }}>
                    <div className="card" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Risk Legend</div>
                        {[
                            { color: '#ef4444', label: 'Critical (16–25)' },
                            { color: '#f97316', label: 'High (9–15)' },
                            { color: '#f59e0b', label: 'Medium (4–8)' },
                            { color: '#22c55e', label: 'Low (1–3)' },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 14, height: 14, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {selected && (
                        <div className="card">
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                Cell {selected} Threats ({threats[selected]?.length || 0})
                            </div>

                            {(!threats[selected] || threats[selected].length === 0) ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', fontStyle: 'italic' }}>
                                    No analyzed threats fall into this risk profile.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '400px', overflowY: 'auto' }}>
                                    {threats[selected].map((t) => (
                                        <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                                                {t.title}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Clock size={10} /> {formatTime(t.timestamp).split(',')[0]}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Top MITRE Techniques */}
                <div style={{ flex: 1, minWidth: 280, maxWidth: 450, display: 'flex', flexDirection: 'column', height: 532, marginLeft: 'auto' }}>
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Top Mapped MITRE Techniques
                        </div>

                        {topTechs.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'rgba(255,255,255,0.3)', gap: 8, padding: 24, textAlign: 'center' }}>
                                <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>No Mapped Techniques Found</span>
                                <span style={{ fontSize: 11 }}>Analyze threat data to view active techniques.</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                                {topTechs.map(tech => (
                                    <div key={tech.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, transition: 'all 0.2s ease' }} className="tech-item-hover">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                                                    {tech.id}
                                                </span>
                                                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {tech.tactic}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tech.name}>
                                                {tech.name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, minWidth: 42, padding: '4px 6px', flexShrink: 0 }}>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                                                {tech.count}
                                            </span>
                                            <span style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Hits</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

