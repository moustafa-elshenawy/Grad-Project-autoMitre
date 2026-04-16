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
        style={{ borderRadius: '50%', width: 40, height: 40, position: 'relative' }}
      >
        <Bell size={18} />
        {count > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', fontSize: 9, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 48, right: 0, width: 320, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f4ff' }}>Team Invitations</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
          </div>
          {actionMsg && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: actionMsg.type === 'success' ? '#10b981' : '#ef4444', background: actionMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
              {actionMsg.text}
            </div>
          )}
          {invitations.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#475569' }}>No pending invitations</div>
          ) : (
            invitations.map(inv => (
              <div key={inv.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4ff', marginBottom: 2 }}>{inv.group_name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>Invited by <strong style={{ color: '#94a3b8' }}>{inv.inviter_username}</strong></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => respond(inv.id, 'accept')} className="btn btn-primary" style={{ flex: 1, fontSize: 11, padding: '6px 0' }}>
                    <Check size={11} /> Accept
                  </button>
                  <button onClick={() => respond(inv.id, 'deny')} className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '6px 0', color: '#ef4444' }}>
                    <X size={11} /> Decline
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
  if (!hasGroup) return null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24, padding: '3px', gap: 2,
      }}
    >
      {/* Private button */}
      <button
        title="View and save only your private records"
        onClick={() => setViewMode('personal')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
          background: viewMode === 'personal' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'transparent',
          color: viewMode === 'personal' ? '#fff' : '#64748b',
          boxShadow: viewMode === 'personal' ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
        }}
      >
        <Lock size={11} /> Private
      </button>

      {/* Team button */}
      <button
        title={`View and save only shared ${groupName || 'Team'} records`}
        onClick={() => setViewMode('team')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
          background: viewMode === 'team' ? 'linear-gradient(135deg,#0ea5e9,#06b6d4)' : 'transparent',
          color: viewMode === 'team' ? '#fff' : '#64748b',
          boxShadow: viewMode === 'team' ? '0 2px 8px rgba(14,165,233,0.4)' : 'none',
        }}
      >
        <Users size={11} /> {groupName || 'Team'}
      </button>
      
      {/* Both button */}
      <button
        title="View both private and team records (saved records go to Team)"
        onClick={() => setViewMode('both')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
          background: viewMode === 'both' ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'transparent',
          color: viewMode === 'both' ? '#fff' : '#64748b',
          boxShadow: viewMode === 'both' ? '0 2px 8px rgba(245,158,11,0.4)' : 'none',
        }}
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
            </Route>
          </Routes>
        </Router>
      </DataViewProvider>
    </AuthProvider>
  )
}

export default App
