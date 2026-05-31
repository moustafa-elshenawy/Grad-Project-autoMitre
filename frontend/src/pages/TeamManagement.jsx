import { useState, useEffect, useCallback } from 'react'
import { Users, UserPlus, Trash2, Shield, ShieldAlert, LogOut, Building2, RefreshCw, Copy, ChevronDown, Check, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const API = 'http://127.0.0.1:8000'

const roleColors = {
    admin: { bg: 'rgba(14,165,233,0.12)', text: '#0077BC', border: '1px solid rgba(14,165,233,0.25)' },
    analyst: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' },
}

function RoleBadge({ role }) {
    const style = roleColors[role] || roleColors.analyst
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em', ...style }}>
            {role}
        </span>
    )
}

export default function TeamManagement() {
    const { user } = useAuth()
    const token = localStorage.getItem('token')

    const [groupData, setGroupData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [inviteInput, setInviteInput] = useState('')
    const [inviteLoading, setInviteLoading] = useState(false)
    const [inviteMsg, setInviteMsg] = useState(null) // { type: 'success'|'error', text }
    const [actionMsg, setActionMsg] = useState(null)
    const [createMode, setCreateMode] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupDesc, setNewGroupDesc] = useState('')
    const [creating, setCreating] = useState(false)
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        onConfirm: null,
        loading: false,
        error: null,
        confirmBtnText: 'Confirm',
        isDanger: false
    })

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const fetchGroup = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API}/api/groups/mine`, { headers })
            const data = await res.json()
            setGroupData(data)
        } catch (e) {
            setGroupData(null)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { fetchGroup() }, [fetchGroup])

    const flash = (setter, msg) => {
        setter(msg)
        setTimeout(() => setter(null), 4000)
    }

    const handleCreateGroup = async (e) => {
        e.preventDefault()
        if (!newGroupName.trim()) return
        setCreating(true)
        try {
            const res = await fetch(`${API}/api/groups/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDesc.trim() || null })
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail) }
            await fetchGroup()
            setCreateMode(false)
        } catch (e) {
            flash(setActionMsg, { type: 'error', text: e.message })
        } finally {
            setCreating(false)
        }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        if (!inviteInput.trim()) return
        setInviteLoading(true)
        try {
            const res = await fetch(`${API}/api/groups/${groupData.group.id}/invite`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ identifier: inviteInput.trim() })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail)
            flash(setInviteMsg, { type: 'success', text: data.message })
            setInviteInput('')
            fetchGroup()
        } catch (e) {
            flash(setInviteMsg, { type: 'error', text: e.message })
        } finally {
            setInviteLoading(false)
        }
    }

    const handleConfirmModalAction = async () => {
        if (!confirmModal.onConfirm) return
        setConfirmModal(prev => ({ ...prev, loading: true, error: null }))
        try {
            await confirmModal.onConfirm()
            setConfirmModal({ show: false, title: '', message: '', onConfirm: null, loading: false, error: null, confirmBtnText: 'Confirm', isDanger: false })
        } catch (e) {
            setConfirmModal(prev => ({ ...prev, loading: false, error: e.message || 'Operation failed.' }))
        }
    }

    const triggerRemoveMemberConfirm = (userId, username) => {
        setConfirmModal({
            show: true,
            title: 'Remove Team Member',
            message: `Are you sure you want to remove ${username} from the team?`,
            confirmBtnText: 'Remove Member',
            isDanger: true,
            loading: false,
            error: null,
            onConfirm: async () => {
                const res = await fetch(`${API}/api/groups/${groupData.group.id}/members/${userId}`, {
                    method: 'DELETE', headers
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.detail)
                flash(setActionMsg, { type: 'success', text: data.message })
                fetchGroup()
            }
        })
    }

    const handleChangeRole = async (userId, newRole) => {
        try {
            const res = await fetch(`${API}/api/groups/${groupData.group.id}/members/${userId}/role`, {
                method: 'PATCH', headers,
                body: JSON.stringify({ role: newRole })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail)
            flash(setActionMsg, { type: 'success', text: `Role updated to ${newRole}.` })
            fetchGroup()
        } catch (e) {
            flash(setActionMsg, { type: 'error', text: e.message })
        }
    }

    const triggerLeaveConfirm = () => {
        setConfirmModal({
            show: true,
            title: 'Leave Team Workspace',
            message: 'Are you sure you want to leave this team workspace? You will lose access to all shared records.',
            confirmBtnText: 'Leave Workspace',
            isDanger: true,
            loading: false,
            error: null,
            onConfirm: async () => {
                const res = await fetch(`${API}/api/groups/leave`, { method: 'POST', headers })
                const data = await res.json()
                if (!res.ok) throw new Error(data.detail)
                fetchGroup()
            }
        })
    }

    const triggerDeleteGroupConfirm = () => {
        setConfirmModal({
            show: true,
            title: 'Delete Team Workspace',
            message: 'Permanently delete this workspace and remove all members? This action is permanent and cannot be undone.',
            confirmBtnText: 'Delete Workspace',
            isDanger: true,
            loading: false,
            error: null,
            onConfirm: async () => {
                const res = await fetch(`${API}/api/groups/${groupData.group.id}`, { method: 'DELETE', headers })
                const data = await res.json()
                if (!res.ok) throw new Error(data.detail)
                fetchGroup()
            }
        })
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(14,165,233,0.3)', borderTopColor: '#0077BC', animation: 'spin 0.8s linear infinite' }} />
        </div>
    )

    // ── No group ──────────────────────────────────────────────────────────────
    if (!groupData?.group) return (
        <div style={{ maxWidth: 600 }}>
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Building2 size={28} color="#0077BC" />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff', margin: '0 0 8px' }}>No Team Workspace</h3>
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>
                        You are not part of any team. Create a workspace to collaborate with analysts, or wait for an admin to invite you.
                    </p>
                    {!createMode ? (
                        <button className="btn btn-primary" onClick={() => setCreateMode(true)}>
                            <Building2 size={14} /> Create Workspace
                        </button>
                    ) : (
                        <form onSubmit={handleCreateGroup} style={{ textAlign: 'left' }}>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Workspace Name <span style={{ color: '#ef4444' }}>*</span></label>
                                <input className="form-input" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. ACME SOC Team" required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Description <span style={{ color: '#475569', fontSize: 10 }}>(optional)</span></label>
                                <input className="form-input" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Security operations team" />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setCreateMode(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Workspace'}</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )

    const { group, my_role, members, pending_invitations } = groupData
    const isAdmin = my_role === 'admin'
    const isOwner = group.owner_id === user?.id

    return (
        <div style={{ maxWidth: 740 }}>

            {/* Flash messages */}
            {actionMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: actionMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${actionMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                    {actionMsg.type === 'success' ? <Check size={14} color="#10b981" /> : <ShieldAlert size={14} color="#ef4444" />}
                    <span style={{ fontSize: 12, color: actionMsg.type === 'success' ? '#10b981' : '#ef4444' }}>{actionMsg.text}</span>
                </div>
            )}

            {/* Workspace header */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Building2 size={22} color="#0077BC" />
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>{group.name}</div>
                            {group.description && <div style={{ fontSize: 12, color: '#64748b' }}>{group.description}</div>}
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                                <span style={{ marginRight: 12 }}><Users size={11} style={{ display: 'inline', marginRight: 4 }} />{members.length} member{members.length !== 1 ? 's' : ''}</span>
                                <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button className="btn btn-secondary" onClick={fetchGroup} title="Refresh" style={{ padding: '6px 10px' }}>
                            <RefreshCw size={14} />
                        </button>
                        {isAdmin && <RoleBadge role="admin" />}
                        {!isAdmin && <RoleBadge role="analyst" />}
                    </div>
                </div>
            </div>

            {/* Invite panel (admin only) */}
            {isAdmin && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header" style={{ marginBottom: 16 }}>
                        <div className="card-title"><UserPlus size={15} color="#0077BC" /> Invite Analyst</div>
                    </div>
                    <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10 }}>
                        <input
                            className="form-input"
                            style={{ flex: 1 }}
                            value={inviteInput}
                            onChange={e => setInviteInput(e.target.value)}
                            placeholder="Enter username or email address..."
                        />
                        <button type="submit" className="btn btn-primary" disabled={inviteLoading} style={{ whiteSpace: 'nowrap' }}>
                            <UserPlus size={14} /> {inviteLoading ? 'Sending...' : 'Send Invite'}
                        </button>
                    </form>
                    {inviteMsg && (
                        <div style={{ marginTop: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: inviteMsg.type === 'success' ? '#10b981' : '#ef4444' }}>
                            {inviteMsg.type === 'success' ? <Check size={12} /> : <X size={12} />} {inviteMsg.text}
                        </div>
                    )}

                    {/* Pending invites */}
                    {pending_invitations?.length > 0 && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Pending Invitations ({pending_invitations.length})</div>
                            {pending_invitations.map(inv => (
                                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{inv.invitee_identifier}</span>
                                    <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 20 }}>Pending</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Members list */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ marginBottom: 16 }}>
                    <div className="card-title"><Users size={15} color="#0077BC" /> Team Members</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {members.map(m => (
                        <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: m.user_id === user?.id ? 'rgba(14,165,233,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: m.user_id === user?.id ? '1px solid rgba(14,165,233,0.15)' : '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                                    {m.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>
                                        {m.username} {m.user_id === user?.id && <span style={{ fontSize: 10, color: '#0077BC' }}>(you)</span>}
                                    </div>
                                    {m.full_name && <div style={{ fontSize: 11, color: '#64748b' }}>{m.full_name}</div>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <RoleBadge role={m.role} />
                                {/* Admin controls (can't act on yourself) */}
                                {isAdmin && m.user_id !== user?.id && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            onClick={() => handleChangeRole(m.user_id, m.role === 'admin' ? 'analyst' : 'admin')}
                                            className="btn btn-secondary"
                                            title={m.role === 'admin' ? 'Demote to Analyst' : 'Promote to Admin'}
                                            style={{ padding: '4px 8px', fontSize: 11 }}
                                        >
                                            {m.role === 'admin' ? '↓ Analyst' : '↑ Admin'}
                                        </button>
                                        <button
                                            onClick={() => triggerRemoveMemberConfirm(m.user_id, m.username)}
                                            className="btn btn-secondary"
                                            title="Remove from team"
                                            style={{ padding: '4px 8px', color: '#ef4444' }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Action buttons directly on the page, without the Danger Zone card wrapper */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24, marginBottom: 24 }}>
                {!isOwner && (
                    <button className="btn btn-secondary" onClick={triggerLeaveConfirm} style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}>
                        <LogOut size={14} /> Leave Team
                    </button>
                )}
                {isOwner && (
                    <button className="btn btn-secondary" onClick={triggerDeleteGroupConfirm} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                        <Trash2 size={14} /> Delete Workspace
                    </button>
                )}
            </div>

            {/* Custom confirm modal overlay */}
            {confirmModal.show && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div className="card" style={{
                        maxWidth: 420,
                        width: '90%',
                        padding: '24px 28px',
                        border: `2px solid ${confirmModal.isDanger ? '#ef4444' : 'var(--bold-primary, #00ff41)'}`,
                        boxShadow: `8px 8px 0 0 ${confirmModal.isDanger ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 255, 65, 0.25)'}`,
                        background: '#0c0f12',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: confirmModal.isDanger ? '#ef4444' : 'var(--bold-primary, #00ff41)' }}>
                            <ShieldAlert size={24} />
                            <h3 style={{ margin: 0, fontFamily: 'Archivo Black, sans-serif', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {confirmModal.title}
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary, #9CA3AF)', lineHeight: 1.6 }}>
                            {confirmModal.message}
                        </p>
                        {confirmModal.error && (
                            <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                                {confirmModal.error}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button
                                onClick={handleConfirmModalAction}
                                className="btn btn-primary"
                                disabled={confirmModal.loading}
                                style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    background: confirmModal.isDanger ? '#ef4444' : 'var(--bold-primary, #00ff41)',
                                    borderColor: confirmModal.isDanger ? '#dc2626' : 'var(--bold-primary-deep, #00cc33)',
                                    color: confirmModal.isDanger ? '#ffffff' : '#020202',
                                    boxShadow: `4px 4px 0 0 ${confirmModal.isDanger ? '#7f1d1d' : 'var(--bold-surface)'}`
                                }}
                            >
                                {confirmModal.loading ? 'Processing...' : confirmModal.confirmBtnText}
                            </button>
                            <button
                                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, loading: false, error: null, confirmBtnText: 'Confirm', isDanger: false })}
                                className="btn btn-secondary"
                                disabled={confirmModal.loading}
                                style={{ flex: 1, padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
