import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Search, Map, Grid, MessageSquare,
  Rss, FileText, Settings, Shield, Wifi, AlertTriangle,
  User, LogOut, Database, ShieldCheck, Users, ClipboardList,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDataView } from '../contexts/DataViewContext'

const navItems = [
  {
    group: 'Overview', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
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

export default function TopNav({ rightElements }) {
  const { user, logout } = useAuth()
  const { isContextualAdmin } = useDataView()

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
    <nav className="topnav">
      {/* Logo */}
      <div className="topnav-logo">
        <Shield size={20} color="#00ff41" stroke="#00ff41" fill="rgba(0,255,65,0.1)" />
        <span className="logo-text">autoMITRE</span>
      </div>

      {/* Main Categories & Dropdowns */}
      <div className="topnav-menu">
        {filteredNavItems.map(group => (
          <div key={group.group} className="nav-group">
            <div className="nav-group-label">
              [+] {group.group}
            </div>
            {/* Dropdown Menu */}
            <div className="nav-dropdown">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={16} className="nav-icon" />
                  {item.label}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right Section: API Status & Profile */}
      <div className="topnav-right">
        <div className="api-status-pill">
          <Wifi size={12} color="#00ff41" />
          <span>API: <strong>ONLINE</strong></span>
        </div>

        {rightElements}

        <div className="user-profile-menu">
          <div className="user-avatar">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="username">{user?.username || 'User'}</div>
            <div className="user-role">
              {isContextualAdmin && <span className="admin-badge">Admin</span>}
            </div>
          </div>
          <button onClick={logout} className="logout-btn" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  )
}
