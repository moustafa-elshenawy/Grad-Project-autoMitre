import { useEffect, useState } from 'react'

/**
 * AIPipelineAnimation — SOTA Pipeline Visualizer
 * Shows the live stages of the AI threat analysis pipeline while loading.
 * Stages mirror the actual backend pipeline:
 *   1. Input Normalization
 *   2. Entity Extraction (NER/Regex)
 *   3. SecBERT Classification (Stage 1 ML)
 *   4. Semantic Embedding (MPNet)
 *   5. Adaptive-K Filtering
 *   6. CVSS Severity Regression
 *   7. Framework Mapping (ATT&CK, D3FEND, NIST, OWASP)
 *   8. Report Assembly
 */

const PIPELINE_STAGES = [
    {
        id: 'input',
        label: 'Input Normalization',
        sublabel: 'Tokenizing & cleaning threat text',
        icon: '01',
        color: '#00ff41',
        duration: 800,
    },
    {
        id: 'ner',
        label: 'Entity Extraction',
        sublabel: 'Running NER — IPs, CVEs, domains, tools',
        icon: '02',
        color: '#a78bfa',
        duration: 900,
    },
    {
        id: 'secbert',
        label: 'SecBERT Classification',
        sublabel: 'Stage 1 ML — TTP mapping via TRAM dataset',
        icon: '03',
        color: '#f472b6',
        duration: 1400,
    },
    {
        id: 'mpnet',
        label: 'MPNet Semantic Embedder',
        sublabel: 'Computing cosine similarity against ATT&CK v14',
        icon: '04',
        color: '#34d399',
        duration: 1200,
    },
    {
        id: 'adaptivek',
        label: 'Adaptive-K Filtering',
        sublabel: 'Pruning low-confidence noise techniques',
        icon: '05',
        color: '#fbbf24',
        duration: 600,
    },
    {
        id: 'cvss',
        label: 'CVSS Severity Regression',
        sublabel: 'Scoring via ML model trained on 277k CVEs',
        icon: '06',
        color: '#fb923c',
        duration: 800,
    },
    {
        id: 'frameworks',
        label: 'Framework Mapping',
        sublabel: 'Cross-referencing D3FEND · NIST 800-53 · OWASP',
        icon: '07',
        color: '#00ff41',
        duration: 900,
    },
    {
        id: 'assembly',
        label: 'Report Assembly',
        sublabel: 'Generating mitigations & kill-chain predictions',
        icon: '08',
        color: '#10b981',
        duration: 700,
    },
]

function PulsingDot({ color }) {
    return (
        <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
            <span style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: color,
                opacity: 0.4,
                animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
            }} />
            <span style={{
                position: 'relative',
                borderRadius: '50%',
                width: 10,
                height: 10,
                background: color,
            }} />
        </span>
    )
}

export default function AIPipelineAnimation({ visible }) {
    const [activeStage, setActiveStage] = useState(0)
    const [completedStages, setCompletedStages] = useState(new Set())
    const [dataPackets, setDataPackets] = useState([])
    const [packetId, setPacketId] = useState(0)

    // Advance through pipeline stages with timing from the config
    useEffect(() => {
        if (!visible) {
            setActiveStage(0)
            setCompletedStages(new Set())
            setDataPackets([])
            return
        }

        let stageIndex = 0
        let timeout

        const advance = () => {
            if (stageIndex >= PIPELINE_STAGES.length) return

            setActiveStage(stageIndex)

            // Spawn a data packet for this stage
            setPacketId(pid => {
                setDataPackets(prev => [
                    ...prev.slice(-5),
                    { id: pid, stageId: PIPELINE_STAGES[stageIndex].id, ts: Date.now() }
                ])
                return pid + 1
            })

            timeout = setTimeout(() => {
                setCompletedStages(prev => new Set([...prev, stageIndex]))
                stageIndex++
                advance()
            }, PIPELINE_STAGES[stageIndex]?.duration || 1000)
        }

        advance()
        return () => clearTimeout(timeout)
    }, [visible])

    if (!visible) return null

    const totalDuration = PIPELINE_STAGES.reduce((s, x) => s + x.duration, 0)
    const elapsed = PIPELINE_STAGES.slice(0, activeStage + 1).reduce((s, x) => s + x.duration, 0)
    const progress = Math.min(100, (elapsed / totalDuration) * 100)

    return (
        <>
            {/* Inject keyframes */}
            <style>{`
                @keyframes ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
                @keyframes slide-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes flow-right {
                    0%   { transform: translateX(-100%); opacity: 0; }
                    30%  { opacity: 1; }
                    100% { transform: translateX(100%); opacity: 0; }
                }
                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 6px 0px currentColor; }
                    50%      { box-shadow: 0 0 18px 4px currentColor; }
                }
                @keyframes scan-line {
                    0%   { top: -2px; }
                    100% { top: 100%; }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
            `}</style>

            <div style={{
                animation: 'fade-in 0.3s ease',
                marginTop: 20,
                background: 'linear-gradient(135deg, rgba(12,20,14,0.97) 0%, rgba(8,14,10,0.97) 100%)',
                border: '1px solid rgba(0,255,65,0.25)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 0 40px rgba(0, 255, 65, 0.08)',
                position: 'relative',
            }}>

                {/* Animated scan line */}
                <div style={{
                    position: 'absolute',
                    left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.45), transparent)',
                    animation: 'scan-line 2.5s linear infinite',
                    zIndex: 2,
                    pointerEvents: 'none',
                }} />

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(0,255,65,0.04)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <PulsingDot color="#00ff41" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', letterSpacing: 0.5 }}>
                            AI Pipeline — Live Processing
                        </span>
                        <span style={{
                            fontSize: 9, padding: '2px 8px', background: 'rgba(0,255,65,0.12)',
                            color: '#00ff41', borderRadius: 100, border: '1px solid rgba(0,255,65,0.25)',
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                        }}>
                            SOTA
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                            Stage {Math.min(activeStage + 1, PIPELINE_STAGES.length)}/{PIPELINE_STAGES.length}
                        </span>
                        <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 13, fontWeight: 700,
                            color: '#00ff41',
                        }}>
                            {Math.round(progress)}%
                        </span>
                    </div>
                </div>

                {/* Global progress bar */}
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #00cc33, #00ff41)',
                        borderRadius: 100,
                        transition: 'width 0.5s ease',
                        boxShadow: '0 0 12px rgba(0,255,65,0.6)',
                    }} />
                    {/* shimmer */}
                    <div style={{
                        position: 'absolute', top: 0, height: '100%', width: 60,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                        animation: 'flow-right 1.5s linear infinite',
                    }} />
                </div>

                {/* Stage list */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {PIPELINE_STAGES.map((stage, index) => {
                        const isDone = completedStages.has(index)
                        const isActive = activeStage === index && !isDone
                        const isPending = !isDone && !isActive

                        return (
                            <div
                                key={stage.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: isActive
                                        ? `1px solid ${stage.color}50`
                                        : isDone
                                        ? '1px solid rgba(16,185,129,0.2)'
                                        : '1px solid rgba(255,255,255,0.04)',
                                    background: isActive
                                        ? `linear-gradient(135deg, ${stage.color}10, ${stage.color}06)`
                                        : isDone
                                        ? 'rgba(16,185,129,0.04)'
                                        : 'rgba(255,255,255,0.01)',
                                    transition: 'all 0.3s ease',
                                    animation: isActive ? 'slide-in 0.25s ease' : undefined,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Active row shimmer */}
                                {isActive && (
                                    <div style={{
                                        position: 'absolute', top: 0, bottom: 0, width: 80,
                                        background: `linear-gradient(90deg, transparent, ${stage.color}15, transparent)`,
                                        animation: 'flow-right 1.2s linear infinite',
                                    }} />
                                )}

                                {/* Stage indicator */}
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                    background: isDone
                                        ? 'rgba(16,185,129,0.15)'
                                        : isActive
                                        ? `${stage.color}20`
                                        : 'rgba(255,255,255,0.04)',
                                    border: isDone
                                        ? '1px solid rgba(16,185,129,0.4)'
                                        : isActive
                                        ? `1px solid ${stage.color}60`
                                        : '1px solid rgba(255,255,255,0.06)',
                                    transition: 'all 0.3s',
                                }}>
                                    {isDone ? '✓' : stage.icon}
                                </div>

                                {/* Labels */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 12, fontWeight: 600,
                                        color: isDone ? '#10b981' : isActive ? stage.color : '#475569',
                                        transition: 'color 0.3s',
                                    }}>
                                        {stage.label}
                                    </div>
                                    <div style={{
                                        fontSize: 10, color: isPending ? '#2d3748' : '#64748b',
                                        marginTop: 1, transition: 'color 0.3s',
                                    }}>
                                        {stage.sublabel}
                                    </div>
                                </div>

                                {/* Right indicator */}
                                <div style={{ flexShrink: 0 }}>
                                    {isDone && (
                                        <span style={{
                                            fontSize: 10, padding: '2px 8px',
                                            background: 'rgba(16,185,129,0.12)',
                                            color: '#10b981',
                                            borderRadius: 100,
                                            border: '1px solid rgba(16,185,129,0.3)',
                                            fontWeight: 600,
                                        }}>
                                            Done
                                        </span>
                                    )}
                                    {isActive && <PulsingDot color={stage.color} />}
                                    {isPending && (
                                        <span style={{ fontSize: 10, color: '#2d3748', fontWeight: 500 }}>
                                            Queued
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer — model cards */}
                <div style={{
                    padding: '10px 20px 14px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                }}>
                    {[
                        { label: 'SecBERT', desc: 'jackaduma/SecBERT · TRAM', color: '#f472b6' },
                        { label: 'MPNet', desc: 'all-mpnet-base-v2 · 420MB', color: '#34d399' },
                        { label: 'CVSS ML', desc: 'RF Regressor · 277k CVEs', color: '#fb923c' },
                        { label: 'ATT&CK v14', desc: 'MITRE Enterprise Matrix', color: '#00ff41' },
                    ].map(m => (
                        <div key={m.label} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 6,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{m.label}</span>
                            <span style={{ fontSize: 9, color: '#334155' }}>{m.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
