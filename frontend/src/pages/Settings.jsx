import { useState, useEffect } from 'react'
import { Key, Globe, Shield, Save, CheckCircle, Database, Lock, ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDataView } from '../contexts/DataViewContext'

export default function Settings() {
    const { user } = useAuth()
    const { viewParam, isContextualAdmin } = useDataView()
    const isAdmin = user?.role === 'admin'
    const [saved, setSaved] = useState(false)
    const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000')
    const [attackVersion, setAttackVersion] = useState('v14')

    // API Keys Settings
    const [mispUrl, setMispUrl] = useState('')
    const [mispApiKey, setMispApiKey] = useState('')
    const [otxApiKey, setOtxApiKey] = useState('')
    const [vtApiKey, setVtApiKey] = useState('')

    // OSINT Settings
    const [osintLimit, setOsintLimit] = useState(50)
    const [osintMinSeverity, setOsintMinSeverity] = useState('Low')
    const [osintStoreLocally, setOsintStoreLocally] = useState(false)

    // Framework Toggles
    const [attackEnabled, setAttackEnabled] = useState(true)
    const [defendEnabled, setDefendEnabled] = useState(true)
    const [nistEnabled, setNistEnabled] = useState(true)
    const [owaspEnabled, setOwaspEnabled] = useState(true)

    useEffect(() => {
        if (!isContextualAdmin) return
        const token = localStorage.getItem('token')
        fetch(`${backendUrl}/api/settings/osint${viewParam}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                if (data.misp_url) setMispUrl(data.misp_url)
                if (data.misp_api_key) setMispApiKey(data.misp_api_key)
                if (data.otx_api_key) setOtxApiKey(data.otx_api_key)
                if (data.virustotal_api_key) setVtApiKey(data.virustotal_api_key)

                if (data.osint_limit) setOsintLimit(data.osint_limit)
                if (data.osint_min_severity) setOsintMinSeverity(data.osint_min_severity)
                if (data.osint_store_locally !== undefined) setOsintStoreLocally(data.osint_store_locally)
                
                if (data.framework_attack !== undefined) setAttackEnabled(data.framework_attack)
                if (data.framework_defend !== undefined) setDefendEnabled(data.framework_defend)
                if (data.framework_nist !== undefined) setNistEnabled(data.framework_nist)
                if (data.framework_owasp !== undefined) setOwaspEnabled(data.framework_owasp)
            })
            .catch(console.error)
    }, [backendUrl, viewParam, isContextualAdmin])
    const handleSave = async () => {
        const token = localStorage.getItem('token')
        try {
            const response = await fetch(`${backendUrl}/api/settings/osint${viewParam}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    misp_url: mispUrl,
                    misp_api_key: mispApiKey,
                    otx_api_key: otxApiKey,
                    virustotal_api_key: vtApiKey,
                    osint_limit: parseInt(osintLimit, 10) || 50,
                    osint_min_severity: osintMinSeverity,
                    osint_store_locally: osintStoreLocally,
                    framework_attack: attackEnabled,
                    framework_defend: defendEnabled,
                    framework_nist: nistEnabled,
                    framework_owasp: owaspEnabled
                })
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Failed to save settings')
            }
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (error) {
            console.error('Error saving:', error.message)
            alert(error.message)
        }
    }

    if (!isContextualAdmin) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <ShieldAlert size={48} style={{ margin: '0 auto 20px', color: '#ef4444' }} />
                <h3>Administrator Access Required</h3>
                <p>You must either switch to Private view mode or be promoted to an Admin <br /> within your active team to view and change system configurations.</p>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 700 }}>
            {/* Role Access Banner */}
            {!isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                    <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>Read-Only Mode — Analyst Access</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>You can view system settings, but only an <strong style={{ color: '#f59e0b' }}>Administrator</strong> can modify them.</div>
                    </div>
                </div>
            )}

            {/* API Keys */}
            <div className="card" style={{ marginBottom: 20, opacity: isAdmin ? 1 : 0.65, pointerEvents: isAdmin ? 'auto' : 'none' }}>
                <div className="card-header" style={{ marginBottom: 20 }}>
                    <div className="card-title"><Key size={16} color="#0077BC" /> API Keys & Integrations{!isAdmin && <Lock size={12} style={{ marginLeft: 6, color: '#f59e0b' }} />}</div>
                </div>

                <div className="form-group">
                    <label className="form-label">Backend API URL</label>
                    <input className="form-input" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} disabled={!isAdmin} />
                    <span style={{ fontSize: 11, color: '#475569' }}>Default: http://127.0.0.1:8000 — change for remote deployment</span>
                </div>

                <div className="form-group" style={{ marginTop: 15 }}>
                    <label className="form-label">MISP URL</label>
                    <input className="form-input" placeholder="e.g. https://misp.local" value={mispUrl} onChange={e => setMispUrl(e.target.value)} disabled={!isAdmin} />
                    <span style={{ fontSize: 11, color: '#475569' }}>Malware Information Sharing Platform instance URL.</span>
                </div>

                <div className="form-group">
                    <label className="form-label">MISP API Key</label>
                    <input className="form-input" type="password" placeholder="••••••••••••••••" value={mispApiKey} onChange={e => setMispApiKey(e.target.value)} disabled={!isAdmin} />
                </div>

                <div className="form-group">
                    <label className="form-label">AlienVault OTX API Key</label>
                    <input className="form-input" type="password" placeholder="••••••••••••••••" value={otxApiKey} onChange={e => setOtxApiKey(e.target.value)} disabled={!isAdmin} />
                    <span style={{ fontSize: 11, color: '#475569' }}>Free account at https://otx.alienvault.com</span>
                </div>

                <div className="form-group">
                    <label className="form-label">VirusTotal API Key</label>
                    <input className="form-input" type="password" placeholder="••••••••••••••••" value={vtApiKey} onChange={e => setVtApiKey(e.target.value)} disabled={!isAdmin} />
                    <span style={{ fontSize: 11, color: '#475569' }}>Free account at https://www.virustotal.com</span>
                </div>
            </div>

            {/* Framework Settings */}
            <div className="card" style={{ marginBottom: 20, opacity: isAdmin ? 1 : 0.65, pointerEvents: isAdmin ? 'auto' : 'none' }}>
                <div className="card-header" style={{ marginBottom: 20 }}>
                    <div className="card-title"><Shield size={16} color="#0077BC" /> Framework Configuration{!isAdmin && <Lock size={12} style={{ marginLeft: 6, color: '#f59e0b' }} />}</div>
                </div>
                <div className="form-group">
                    <label className="form-label">MITRE ATT&CK Version</label>
                    <select className="form-input" value={attackVersion} onChange={e => setAttackVersion(e.target.value)}>
                        <option value="v14">v14 (Current — 2023)</option>
                        <option value="v13">v13</option>
                        <option value="v12">v12</option>
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                        { id: 'attack', label: 'MITRE ATT&CK', desc: 'Map threats to ATT&CK techniques and tactics', enabled: attackEnabled, set: setAttackEnabled },
                        { id: 'defend', label: 'MITRE D3FEND', desc: 'Map to D3FEND countermeasures', enabled: defendEnabled, set: setDefendEnabled },
                        { id: 'nist', label: 'NIST SP 800-53', desc: 'Map to NIST security controls', enabled: nistEnabled, set: setNistEnabled },
                        { id: 'owasp', label: 'OWASP Top 10 & ASVS', desc: 'Map to OWASP application security requirements', enabled: owaspEnabled, set: setOwaspEnabled },
                    ].map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>{f.label}</div>
                                <div style={{ fontSize: 11, color: '#475569' }}>{f.desc}</div>
                            </div>
                            <div 
                                onClick={() => f.set(!f.enabled)}
                                style={{ width: 36, height: 20, borderRadius: 100, background: f.enabled ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                            >
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: f.enabled ? 18 : 3, transition: 'left 0.2s ease' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* OSINT Settings */}
            <div className="card" style={{ marginBottom: 20, opacity: isAdmin ? 1 : 0.65, pointerEvents: isAdmin ? 'auto' : 'none' }}>
                <div className="card-header" style={{ marginBottom: 20 }}>
                    <div className="card-title"><Database size={16} color="#0077BC" /> OSINT Data Collection{!isAdmin && <Lock size={12} style={{ marginLeft: 6, color: '#f59e0b' }} />}</div>
                </div>

                <div className="form-group">
                    <label className="form-label">Data Fetch Limit (Per Source)</label>
                    <input
                        className="form-input"
                        type="number"
                        min="1" max="1000"
                        value={osintLimit === '' ? '' : osintLimit}
                        onChange={e => {
                            const val = e.target.value
                            if (val === '') setOsintLimit('')
                            else setOsintLimit(parseInt(val, 10))
                        }}
                        disabled={!isAdmin}
                    />
                    <span style={{ fontSize: 11, color: '#475569' }}>Controls how many records to pull from each external OSINT feed at once.</span>
                </div>

                <div className="form-group">
                    <label className="form-label">Minimum Severity Filter</label>
                    <select className="form-input" value={osintMinSeverity} onChange={e => setOsintMinSeverity(e.target.value)} disabled={!isAdmin}>
                        <option value="Low">Low (Show all noise)</option>
                        <option value="Medium">Medium and above</option>
                        <option value="High">High and above</option>
                        <option value="Critical">Critical only</option>
                    </select>
                </div>

                <div className="form-group" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>Store OSINT Locally (SQLite)</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Save fetched feed items to the database persistently. Ensures rapid load times.</div>
                        </div>
                        <div onClick={() => setOsintStoreLocally(!osintStoreLocally)} style={{ width: 40, height: 22, borderRadius: 100, background: osintStoreLocally ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: osintStoreLocally ? 21 : 3, transition: 'left 0.2s ease' }} />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                    {saved && <div style={{ color: '#10b981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Settings Saved!</div>}
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={handleSave}>
                            <Save size={16} /> Save Configurations
                        </button>
                    )}
                    {!isAdmin && (
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Lock size={12} /> Contact an Administrator to make changes
                        </div>
                    )}
                </div>
            </div>

            {/* About */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ marginBottom: 16 }}>
                    <div className="card-title"><Globe size={16} color="#0077BC" /> About autoMITRE</div>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
                    <p><strong style={{ color: '#f0f4ff' }}>autoMITRE v1.2</strong> — AI-Driven Cyber Threat Intelligence Platform</p>
                    <p>Developed as part of a BSc Cybersecurity thesis on automating threat modeling through AI.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                        {[
                            ['Frontend', 'React 18 + Vite 5 + Recharts'],
                            ['Backend', 'Python 3.11 + FastAPI'],
                            ['AI/ML', 'scikit-learn + NLTK + NLP'],
                            ['Frameworks', 'ATT&CK v14 · D3FEND · NIST 800-53 · OWASP'],
                            ['Export', 'STIX 2.1 · JSON · CSV · Splunk HEC'],
                            ['Integration', 'VirusTotal · TAXII · SIEM'],
                        ].map(([k, v]) => (
                            <div key={k} style={{ fontSize: 11 }}>
                                <span style={{ color: '#475569' }}>{k}: </span>
                                <span style={{ color: '#94a3b8' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
