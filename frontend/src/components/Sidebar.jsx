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
      { to: '/team',     icon: Users,         label: 'Team' },
      { to: '/audit',    icon: ClipboardList,  label: 'Audit Log',  adminOnly: true },
      { to: '/settings', icon: Settings,       label: 'Settings',   adminOnly: true },
      { to: '/profile',  icon: User,           label: 'Profile' },
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
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 4, background: '#0077BC', border: '2px solid #111111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Archivo Black, sans-serif', fontWeight: 900, fontSize: 16, color: '#FFFFFF' }}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          <div style={{ overflow: 'hidden' }}>
              <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 13, fontWeight: 900, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{user?.username || 'User'}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 500, color: '#D1D5DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isContextualAdmin && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#009866', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Admin</span>}
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
