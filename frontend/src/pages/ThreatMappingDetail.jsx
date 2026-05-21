import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft, Loader2, AlertTriangle, FileText } from 'lucide-react'
import { ThreatResultPanel } from './ThreatAnalysis'

export default function ThreatMappingDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [threat, setThreat] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchThreat = async () => {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                const res = await fetch(`http://127.0.0.1:8000/api/analyze/threats/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })

                if (res.ok) {
                    const data = await res.json()
                    setThreat(data)
                } else {
                    const errData = await res.json()
                    setError(errData.detail || 'Failed to fetch threat details.')
                }
            } catch (err) {
                console.error("Error fetching threat:", err)
                setError('Network error. Please ensure the backend is running.')
            } finally {
                setLoading(false)
            }
        }

        if (id) fetchThreat()
    }, [id])

    return (
        <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => navigate('/saved-threats')}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <ArrowLeft size={16} /> Back to Saved Threats
                </button>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                        ID: {id}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ marginBottom: 16 }} />
                    <p>Loading deep analysis results from database...</p>
                </div>
            ) : error ? (
                <div className="alert alert-error" style={{ padding: 24, textAlign: 'center' }}>
                    <AlertTriangle size={32} style={{ marginBottom: 12, margin: '0 auto' }} />
                    <h2 style={{ marginBottom: 8 }}>Analysis Not Found</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate('/saved-threats')} className="btn btn-primary" style={{ marginTop: 24 }}>
                        Return to Dashboard
                    </button>
                </div>
            ) : (
                <div className="threat-detail-container">
                    <ThreatResultPanel result={threat} />
                </div>
            )}
        </div>
    )
}
