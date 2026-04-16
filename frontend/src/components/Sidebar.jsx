import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Search, Map, Grid, MessageSquare,
  Rss, FileText, Settings, Shield, Wifi, AlertTriangle,
  User, LogOut, Database, ShieldCheck, Users
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDataView } from '../contexts/DataViewContext'

const navItems = [
  {
    group: 'Overview', items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/feed', icon: Rss, label: 'Threat Feed' },
      { to: '/saved-threats', icon: Database, label: 'Saved Threats' },
    ]
  },
  {
    group: 'Analysis', items: [
      { to: '/analyze', icon: Search, label: 'Threat Analysis' },
      { to: '/heatmap', icon: Map, label: 'Risk Heatmap' },
      { to: '/chat', icon: MessageSquare, label: 'AI Risk Chat' },
    ]
  },
  {
    group: 'Frameworks', items: [
      { to: '/coverage', icon: Grid, label: 'Framework Coverage' },
      { to: '/reports', icon: FileText, label: 'Reports & Export' },
    ]
  },
  {
    group: 'System', items: [
      { to: '/team', icon: Users, label: 'Team' },
      { to: '/settings', icon: Settings, label: 'Settings' },
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
           if (item.to === '/settings') return isContextualAdmin
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
          <Shield size={22} color="white" />
        </div>
        <div className="logo-text">
          <h2>autoMITRE</h2>
          <p>v1.2 · CTI Platform</p>
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
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.username || 'User'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 }}>
                {isContextualAdmin && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', textTransform: 'uppercase' }}>Admin</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
              </div>
            </div>
          </div>
          <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', flexShrink: 0 }} title="Logout">
            <LogOut size={16} />
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
