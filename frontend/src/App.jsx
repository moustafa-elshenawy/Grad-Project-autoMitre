import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataViewProvider, useDataView } from './contexts/DataViewContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import SavedThreats from './pages/SavedThreats'
import ThreatAnalysis from './pages/ThreatAnalysis'
import RiskHeatmap from './pages/RiskHeatmap'
import FrameworkCoverage from './pages/FrameworkCoverage'
import AIChat from './pages/AIChat'
import ThreatFeed from './pages/ThreatFeed'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Register from './pages/Register'
import ThreatMappingDetail from './pages/ThreatMappingDetail'
import TeamManagement from './pages/TeamManagement'
import AuditLog from './pages/AuditLog'
import { useTheme } from './contexts/ThemeContext'
import { Sun, Moon, Bell, X, Check, Lock, Users } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import './index.css'

function NotificationBell() {
  const { user } = useAuth()
  const token = localStorage.getItem('token')
  const [invitations, setInvitations] = useState([])
  const [open, setOpen] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)
  const ref = useRef(null)

  const fetchInvites = async () => {
    if (!token) return
    try {
      const res = await fetch('http://localhost:8000/api/groups/invitations', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setInvitations(data.invitations || [])
      }
    } catch (e) {}
  }

  useEffect(() => {
    fetchInvites()
    const t = setInterval(fetchInvites, 30000) // poll every 30s
    return () => clearInterval(t)
  }, [token])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const respond = async (invId, action) => {
    const res = await fetch(`http://localhost:8000/api/groups/invitations/${invId}/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setActionMsg({ type: res.ok ? 'success' : 'error', text: data.message || data.detail })
    fetchInvites()
    setTimeout(() => setActionMsg(null), 3000)
  }

  const count = invitations.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-icon btn-secondary"
        title="Team Invitations"
        style={{ width: 40, height: 40, position: 'relative' }}
      >
        <Bell size={18} />
        {count > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 4, background: '#DC2626', border: '2px solid #111111', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 48, right: 0, width: 340, background: '#FFFFFF', color: '#111827', border: '2px solid #111111', borderRadius: 8, boxShadow: '6px 6px 0 0 #0077BC', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '2px solid #111111', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 13, fontWeight: 900, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team Invitations</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: 2 }} aria-label="Close"><X size={16} /></button>
          </div>
          {actionMsg && (
            <div style={{ padding: '10px 16px', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, color: actionMsg.type === 'success' ? '#16A34A' : '#DC2626', background: actionMsg.type === 'success' ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)', borderBottom: '2px solid currentColor' }}>
              {actionMsg.text}
            </div>
          )}
          {invitations.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>No pending invitations</div>
          ) : (
            invitations.map(inv => (
              <div key={inv.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(17,17,17,0.10)' }}>
                <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 14, fontWeight: 900, color: '#111827', marginBottom: 2, textTransform: 'uppercase' }}>{inv.group_name}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 500, color: '#6B7280', marginBottom: 10 }}>Invited by <strong style={{ color: '#0077BC', fontWeight: 700 }}>{inv.inviter_username}</strong></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => respond(inv.id, 'accept')} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    <Check size={12} /> Accept
                  </button>
                  <button onClick={() => respond(inv.id, 'deny')} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                    <X size={12} /> Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Workspace Switcher ────────────────────────────────────────────────────────
function DataViewSwitcher() {
  const { viewMode, setViewMode, hasGroup, groupName } = useDataView()
  
  const isPrivate = viewMode === 'personal' || !hasGroup
  const isTeam = viewMode === 'team'
  const isBoth = viewMode === 'both'

  return (
    <div 
      className="workspace-switcher"
      title={!hasGroup ? 'Join or create a team to unlock Team & Both views' : undefined}
    >
      {/* Private */}
      <button
        className={`workspace-btn ${isPrivate ? 'active-private' : ''}`}
        title="View and save only your private records"
        onClick={() => setViewMode('personal')}
      >
        <Lock size={11} /> Private
      </button>

      {/* Team */}
      <button
        className={`workspace-btn ${isTeam ? 'active-team' : ''}`}
        title={hasGroup ? `View and save only shared ${groupName || 'Team'} records` : 'Join a team to enable team view'}
        onClick={hasGroup ? () => setViewMode('team') : undefined}
        disabled={!hasGroup}
      >
        <Users size={11} /> {groupName || 'Team'}
      </button>

      {/* Both */}
      <button
        className={`workspace-btn ${isBoth ? 'active-both' : ''}`}
        title={hasGroup ? "View both private and team records (saved records go to Team)" : 'Join a team to enable both view'}
        onClick={hasGroup ? () => setViewMode('both') : undefined}
        disabled={!hasGroup}
      >
        Both
      </button>
    </div>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ title, subtitle }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="topbar">
      <div className="topbar-content">
        <h1>{title}</h1>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <DataViewSwitcher />
        <NotificationBell />
        <button
          onClick={toggleTheme}
          className="btn btn-icon btn-secondary"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{ borderRadius: '50%', width: '40px', height: '40px' }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  )
}

const pages = {
  '/': { title: 'Dashboard', subtitle: 'Threat intelligence overview and real-time monitoring' },
  '/saved-threats': { title: 'Saved Threats', subtitle: 'Historical archive of processed analyses' },
  '/analyze': { title: 'Threat Analysis', subtitle: 'Analyze threats with AI-powered MITRE ATT&CK mapping' },
  '/heatmap': { title: 'Risk Heatmap', subtitle: 'Interactive risk matrix visualization' },
  '/threat-mapping': { title: 'Mapping, Mitigation and Prediction', subtitle: 'Detailed historical threat intelligence report' },
  '/chat': { title: 'AI Risk Assessment', subtitle: 'Conversational AI threat analyst' },
  '/feed': { title: 'Threat Intelligence Feed', subtitle: 'Live cyber threat intelligence' },
  '/reports': { title: 'Reports & Export', subtitle: 'Generate STIX 2.1, JSON, CSV, and SIEM exports' },
  '/settings': { title: 'Settings', subtitle: 'Configure APIs, integrations, and preferences' },
  '/profile': { title: 'User Profile', subtitle: 'Manage your account settings and preferences' },
  '/team': { title: 'Team Management', subtitle: 'Manage your workspace, invite analysts, and collaborate' },
}

function AppLayout({ children }) {
  const path = window.location.pathname
  const page = pages[path] || (path.startsWith('/threat-mapping/') ? pages['/threat-mapping'] : { title: '404', subtitle: 'Not Found' })
  const { theme } = useTheme()

  return (
    <div className={`app-layout ${theme}-theme`}>
      <div className="scan-line" />
      <Sidebar />
      <div className="main-content">
        <Topbar title={page.title} subtitle={page.subtitle} />
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <DataViewProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/saved-threats" element={<AppLayout><SavedThreats /></AppLayout>} />
              <Route path="/analyze" element={<AppLayout><ThreatAnalysis /></AppLayout>} />
              <Route path="/heatmap" element={<AppLayout><RiskHeatmap /></AppLayout>} />
              <Route path="/threat-mapping/:id" element={<AppLayout><ThreatMappingDetail /></AppLayout>} />
              <Route path="/coverage" element={<AppLayout><FrameworkCoverage /></AppLayout>} />
              <Route path="/chat" element={<AppLayout><AIChat /></AppLayout>} />
              <Route path="/feed" element={<AppLayout><ThreatFeed /></AppLayout>} />
              <Route path="/reports" element={<AppLayout><Reports /></AppLayout>} />
              <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
              <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
              <Route path="/team" element={<AppLayout><TeamManagement /></AppLayout>} />
              <Route path="/audit" element={<AppLayout><AuditLog /></AppLayout>} />
            </Route>
          </Routes>
        </Router>
      </DataViewProvider>
    </AuthProvider>
  )
}

export default App
