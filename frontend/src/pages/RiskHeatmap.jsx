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

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                {/* Y-axis label */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 0, paddingTop: 40 }}>
                    <span style={{ fontSize: 11, color: '#475569', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Impact →</span>
                </div>

                <div style={{ flex: 1 }}>
                    {/* Y-axis labels + grid */}
                    {impacts.map(impact => (
                        <div key={impact} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 90, textAlign: 'right', fontSize: 11, color: '#475569', flexShrink: 0 }}>
                                {impact} — {impactLabels[impact]}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
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
                                                border: `2px solid ${isSelected ? border : 'transparent'}`,
                                                boxShadow: isSelected ? `0 0 20px ${border}60` : 'none',
                                                flex: 1,
                                                minHeight: 70,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: 'white',
                                                flexDirection: 'column',
                                                gap: 4,
                                                padding: 8,
                                                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setSelected(isSelected ? null : key)}
                                        >
                                            <span style={{ fontSize: 16, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                                {likelihood * impact}
                                            </span>
                                            <span style={{ fontSize: 8, letterSpacing: 0.5, opacity: 0.8 }}>{label}</span>
                                            {cellThreats.length > 0 && (
                                                <span style={{ fontSize: 8, opacity: 0.7 }}>{cellThreats.length} threat{cellThreats.length > 1 ? 's' : ''}</span>
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
                            <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#475569', marginTop: 6 }}>
                                <div style={{ fontWeight: 700, color: '#94a3b8' }}>{l}</div>
                                <div style={{ fontSize: 9, marginTop: 2 }}>{likelihoodLabels[l]}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ textAlign: 'center', paddingLeft: 98, fontSize: 11, color: '#475569', marginTop: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
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
            </div>
        </div>
    )
}

