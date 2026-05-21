import { useState, useEffect } from 'react'
import { Download, FileJson, FileText, Database, Zap, CheckCircle, Briefcase, ShieldAlert, BarChart, AlertCircle, Info, Loader } from 'lucide-react'
import axios from 'axios'
import { useDataView } from '../contexts/DataViewContext'

const API = 'http://127.0.0.1:8000'

const EXPORT_FORMATS = [
    {
        id: 'executive', isPdf: true,
        icon: <Briefcase size={22} />,
        name: 'Executive PDF',
        color: '#f43f5e',
        endpoint: '/api/export/pdf',
        contains: ['Business risk summary', 'Threat severity breakdown', 'Top vulnerabilities', 'Recommended actions for leadership'],
    },
    {
        id: 'managerial', isPdf: true,
        icon: <BarChart size={22} />,
        name: 'Managerial PDF',
        color: '#3b82f6',
        endpoint: '/api/export/pdf',
        contains: ['Team-level risk posture', 'Mitigation effort tracking', 'ATT&CK tactic coverage', 'Resource allocation view'],
    },
    {
        id: 'technical', isPdf: true,
        icon: <ShieldAlert size={22} />,
        name: 'Technical PDF',
        color: '#d946ef',
        endpoint: '/api/export/pdf',
        contains: ['Full IOC lists', 'MITRE ATT&CK technique mappings', 'D3FEND defensive mappings', 'Raw telemetry and indicators'],
    },
    {
        id: 'stix',
        icon: <Database size={22} />,
        name: 'STIX 2.1',
        color: '#0077BC',
        endpoint: '/api/export/stix',
        contains: ['STIX 2.1 bundle format', 'Compatible with TAXII servers', 'Threat actor objects', 'Indicator & relationship objects'],
    },
    {
        id: 'json',
        icon: <FileJson size={22} />,
        name: 'JSON Export',
        color: '#8b5cf6',
        endpoint: '/api/export/json',
        contains: ['Structured threat records', 'Technique & tactic metadata', 'Risk scores & severities', 'Mitigation recommendations'],
    },
    {
        id: 'csv',
        icon: <FileText size={22} />,
        name: 'CSV Report',
        color: '#10b981',
        endpoint: '/api/export/csv',
        contains: ['Excel-compatible format', 'All threat fields as columns', 'Technique IDs and tactics', 'Timestamps and risk scores'],
    },
    {
        id: 'splunk',
        icon: <Zap size={22} />,
        name: 'Splunk HEC',
        color: '#f97316',
        endpoint: '/api/export/splunk',
        contains: ['Pre-formatted Splunk events', 'HTTP Event Collector ready', 'Indexed threat data', 'Direct SIEM ingestion'],
    },
]

function authHeader() {
    const t = localStorage.getItem('token')
    return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function Reports() {
    const [exporting, setExporting] = useState({})
    const [exported, setExported] = useState({})
    const [exportError, setExportError] = useState({})
    const [threats, setThreats] = useState([])
    const [loadingThreats, setLoadingThreats] = useState(true)
    const { viewParam, viewMode } = useDataView()

    // Fetch user's analyzed threats to get real IDs
    useEffect(() => {
        const fetchHistory = async () => {
            setLoadingThreats(true)
            try {
                const r = await axios.get(`${API}/api/users/history${viewParam}`, { headers: authHeader() })
                const items = r.data?.items || r.data?.history || r.data || []
                setThreats(Array.isArray(items) ? items : [])
            } catch (e) {
                setThreats([])
            } finally {
                setLoadingThreats(false)
            }
        }
        fetchHistory()
    }, [viewMode, viewParam])

    const threatIds = threats.map(t => t.id || t.threat_id).filter(Boolean)
    const hasThreats = threatIds.length > 0

    // Get token for native links
    const token = localStorage.getItem('token') || ''


    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Export Threat Intelligence</h2>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>
                    Export your analyzed threats to STIX 2.1, JSON, CSV, PDF reports, or SIEM-ready formats.
                </p>
            </div>

            {/* Threat count banner */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderRadius: 10, marginBottom: 24,
                background: hasThreats ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${hasThreats ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: hasThreats ? '#10b981' : '#ef4444', fontSize: 13,
            }}>
                {loadingThreats
                    ? <><Loader size={14} className="spinning" /> Loading your threats...</>
                    : hasThreats
                        ? <><CheckCircle size={14} /> {threatIds.length} analyzed threat{threatIds.length > 1 ? 's' : ''} ready to export</>
                        : <><AlertCircle size={14} /> No analyzed threats yet — run a Threat Analysis first to generate exportable data</>
                }
            </div>

            {/* Export Cards */}
            <div className="grid-2" style={{ marginBottom: 28 }}>
                {EXPORT_FORMATS.map(fmt => {
                    // Force the browser to recognize the correct file extension cross-origin by putting it in the URL
                    let ext = '.json';
                    if (fmt.isPdf) ext = '.pdf';
                    else if (fmt.id === 'csv') ext = '.csv';
                    
                    const filename = `autoMITRE_${fmt.id}_export${ext}`;
                    const downloadUrl = `${API}/api/export/download/${fmt.id}/${filename}?token=${token}`;

                    return (
                        <div key={fmt.id} className="card" style={{ borderTop: `2px solid ${fmt.color}` }}>
                            {/* Card header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 10,
                                    background: `${fmt.color}18`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, color: fmt.color,
                                }}>
                                    {fmt.icon}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>
                                        {fmt.name}
                                    </h3>
                                    {/* What's included */}
                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                        {fmt.contains.map((item, i) => (
                                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                                                <span style={{ color: fmt.color, fontSize: 8 }}>⬤</span> {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Native HTML link - impenetrable to popup blockers */}
                            {(!hasThreats || loadingThreats) ? (
                                <button
                                    className="btn btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center', border: `1px solid ${fmt.color}33`, opacity: 0.5 }}
                                    disabled={true}
                                >
                                    <Download size={14} /> Export {fmt.name}
                                </button>
                            ) : (
                                <button
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        setExporting(prev => ({ ...prev, [fmt.id]: true }));
                                        try {
                                            const response = await axios.get(downloadUrl, {
                                                responseType: 'blob', // Force Axios to parse response as a Blob
                                                headers: authHeader()
                                            });
                                            // Synthesize a blob URL within the same origin to bypass Chrome's cross-origin drop policy
                                            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
                                            const link = document.createElement('a');
                                            link.href = blobUrl;
                                            link.setAttribute('download', filename);
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            window.URL.revokeObjectURL(blobUrl);
                                        } catch (err) {
                                            console.error("Export download failed:", err);
                                        } finally {
                                            setExporting(prev => ({ ...prev, [fmt.id]: false }));
                                        }
                                    }}
                                    className="btn btn-secondary"
                                    style={{ 
                                        width: '100%', 
                                        justifyContent: 'center', 
                                        border: `1px solid ${fmt.color}33`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {exporting[fmt.id] ? <div className="spinner-small" /> : <Download size={14} />}
                                    {exporting[fmt.id] ? 'Downloading...' : `Export ${fmt.name}`}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* SIEM Integration Guide */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title"><Zap size={15} color="#0077BC" /> SIEM Platform Integration Guide</div>
                </div>
                <div className="grid-3">
                    {[
                        { name: 'Splunk', steps: ['Export Splunk HEC format above', 'Configure HEC token in Splunk', 'POST events to /services/collector', 'Build ATT&CK dashboards'], color: '#f97316' },
                        { name: 'Microsoft Sentinel', steps: ['Export STIX 2.1 bundle', 'Use Logic Apps TAXII connector', 'Map IoCs to Sentinel watchlists', 'Enable ATT&CK analytics rules'], color: '#0077BC' },
                        { name: 'IBM QRadar', steps: ['Export JSON format', 'Use QRadar REST API /api/data_exports', 'Map fields to QRadar categories', 'Configure offense detection rules'], color: '#009866' },
                    ].map(siem => (
                        <div key={siem.name} style={{ padding: 14, background: 'rgba(255,255,255,0.02)', border: `1px solid ${siem.color}22`, borderRadius: 8 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: siem.color, marginBottom: 10 }}>{siem.name}</h4>
                            <ol style={{ paddingLeft: 16, listStyleType: 'decimal' }}>
                                {siem.steps.map((s, i) => (
                                    <li key={i} style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 5, lineHeight: 1.4 }}>{s}</li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>
            </div>

            {/* What's in each report info box */}
            <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 10, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', display: 'flex', gap: 10 }}>
                <Info size={15} color="#0077BC" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                    <strong style={{ color: '#94a3b8' }}>Reports are built from your analyzed threats.</strong> To get more data in your exports, run Threat Analysis on more inputs (text, CVEs, PCAPs) — each analysis adds a record to your export pool. The <strong style={{ color: '#d946ef' }}>Technical PDF</strong> includes the most detail; the <strong style={{ color: '#f43f5e' }}>Executive PDF</strong> is best for sharing with leadership.
                </p>
            </div>
        </div>
    )
}
