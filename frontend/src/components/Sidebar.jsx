import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Search, Map, Grid, MessageSquare,
  Rss, FileText, Settings, Shield, Wifi, AlertTriangle,
  User, LogOut, Database, ShieldCheck, Users, ClipboardList
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDataView } from '../contexts/DataViewContext'

const navItems = [
  {
    group: 'MAIN', items: [
      { to: '/', icon: LayoutDashboard, label: 'Overview' },
      { to: '/analyze', icon: Search, label: 'AI Insights' },
      { to: '/heatmap', icon: Map, label: 'Analytics' },
    ]
  },
  {
    group: 'OTHERS', items: [
      { to: '/feed', icon: Rss, label: 'Threat Feed' },
      { to: '/saved-threats', icon: Database, label: 'Saved Threats' },
      { to: '/coverage', icon: Grid, label: 'Frameworks' },
      { to: '/chat', icon: MessageSquare, label: 'AI Assistant' },
      { to: '/reports', icon: FileText, label: 'Reports' },
      { to: '/team', icon: Users, label: 'Team' },
      { to: '/audit', icon: ClipboardList, label: 'Audit Log', adminOnly: true },
      { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
      { to: '/profile', icon: User, label: 'Profile' },
    ]
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isContextualAdmin } = useDataView();

  const filteredNavItems = navItems.map(group => {
    if (group.group === 'System') {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.adminOnly) return isContextualAdmin
          return true
        })
      }
    }
    return group
  })

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Shield size={20} color="#111" fill="url(#lime-gradient)" />
          <svg width="0" height="0">
            <linearGradient id="lime-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop stopColor="#84CC16" offset="0%" />
              <stop stopColor="#14B8A6" offset="100%" />
            </linearGradient>
          </svg>
        </div>
        <div className="logo-text">
          <h2>autoMITRE</h2>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredNavItems.map(group => (
          <div key={group.group}>
            <div className="nav-section-label">{group.group}</div>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="nav-icon" />
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #84CC16, #14B8A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#111' }}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.username || 'User'}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isContextualAdmin && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(20,184,166,0.2)', color: '#14B8A6', textTransform: 'uppercase', flexShrink: 0 }}>Admin</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
              </div>
            </div>
          </div>
          <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: '4px', flexShrink: 0 }} title="Logout" aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
        <div className="api-status">
          <Wifi size={14} color="#10b981" />
          <div className="api-status-text">
            API: <strong>Online</strong> &nbsp;·&nbsp; ATT&CK v14
          </div>
        </div>
      </div>
    </aside>
  )
}
