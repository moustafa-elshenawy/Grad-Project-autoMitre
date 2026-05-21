import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, LogOut, Save, AlertCircle, CheckCircle, Activity, Calendar, Clock } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function Profile() {
    const { user, token, logout, updateUser } = useAuth();

    // Profile edit state
    const [form, setForm] = useState({
        full_name: '',
        bio: '',
        organization: '',
        avatar_url: '',
    });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState(null); // { type: 'success'|'error', text }

    // Password change state
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMessage, setPwMessage] = useState(null);

    // Stats state
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // Populate form from user on load
    useEffect(() => {
        if (user) {
            setForm({
                full_name: user.full_name || '',
                bio: user.bio || '',
                organization: user.organization || '',
                avatar_url: user.avatar_url || '',
            });
        }
    }, [user]);

    // Load stats
    useEffect(() => {
        if (!token) return;
        setStatsLoading(true);
        fetch(`${API_BASE}/api/users/stats`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => setStats(data))
            .catch(() => { })
            .finally(() => setStatsLoading(false));
    }, [token]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileMessage(null);
        try {
            const res = await fetch(`${API_BASE}/api/users/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Save failed');
            const updated = await res.json();
            updateUser(updated);
            setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setProfileMessage({ type: 'error', text: err.message });
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwMessage(null);
        if (pwForm.new_password !== pwForm.confirm_password) {
            setPwMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }
        setPwSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/users/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    current_password: pwForm.current_password,
                    new_password: pwForm.new_password,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Failed to change password');
            setPwMessage({ type: 'success', text: 'Password changed successfully!' });
            setPwForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            setPwMessage({ type: 'error', text: err.message });
        } finally {
            setPwSaving(false);
        }
    };

    const avatarLetter = (user?.full_name || user?.username || 'U')[0].toUpperCase();

    const formatDate = (isoStr) => {
        if (!isoStr) return '—';
        try {
            return new Date(isoStr).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
            });
        } catch { return '—'; }
    };

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1>User Profile</h1>
                <p>Manage your account settings, profile data, and security</p>
            </div>

            {/* ── Account Overview ── */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    {/* Avatar */}
                    {user?.avatar_url ? (
                        <img
                            src={user.avatar_url}
                            alt="avatar"
                            style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,212,255,0.3)' }}
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {avatarLetter}
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {user?.full_name || user?.username}
                        </h2>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>@{user?.username} · {user?.email}</p>
                        {user?.organization && (
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>{user.organization}</p>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <span className="badge badge-info">{user?.role || 'analyst'}</span>
                            {user?.is_active && <span className="badge badge-success">Active</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center', padding: '8px 16px', background: 'rgba(0,212,255,0.05)', borderRadius: 8, border: '1px solid rgba(0,212,255,0.1)' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-blue)' }}>{stats?.total_analyses ?? '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analyses</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px 16px', background: 'rgba(0,212,255,0.05)', borderRadius: 8, border: '1px solid rgba(0,212,255,0.1)' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-blue)' }}>{stats?.avg_risk_score ?? '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Risk</div>
                        </div>
                    </div>
                </div>

                {user?.bio && (
                    <p style={{ marginTop: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                        {user.bio}
                    </p>
                )}

                {/* Timestamps */}
                <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                        <Calendar size={13} /> Member since {formatDate(user?.created_at)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                        <Clock size={13} /> Last login {formatDate(user?.last_login_at)}
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ gap: 20 }}>
                {/* ── Edit Profile ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><User size={16} color="var(--accent-blue)" /> Edit Profile</div>
                        </div>

                        {profileMessage && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: profileMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${profileMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: profileMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 14 }}>
                                {profileMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                                {profileMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleProfileSave}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="form-input" type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your full name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Organization</label>
                                <input className="form-input" type="text" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} placeholder="Company or team name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bio</label>
                                <textarea className="form-input" rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Short bio or description..." style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Avatar URL</label>
                                <input className="form-input" type="url" value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} placeholder="https://example.com/avatar.png" />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={profileSaving} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <Save size={14} /> {profileSaving ? 'Saving...' : 'Save Profile'}
                            </button>
                        </form>
                    </div>

                    {/* ── Change Password ── */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><Key size={16} color="var(--accent-blue)" /> Change Password</div>
                        </div>

                        {pwMessage && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: pwMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${pwMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: pwMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 14 }}>
                                {pwMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                                {pwMessage.text}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange}>
                            <div className="form-group">
                                <label className="form-label">Current Password</label>
                                <input className="form-input" type="password" value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input className="form-input" type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm New Password</label>
                                <input className="form-input" type="password" value={pwForm.confirm_password} onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} required />
                            </div>
                            <button type="submit" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }} disabled={pwSaving}>
                                <Key size={14} /> {pwSaving ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── Right column: stats + account info + sign out ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Activity Stats */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><Activity size={16} color="var(--accent-blue)" /> Activity Statistics</div>
                        </div>
                        {statsLoading ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading stats...</p>
                        ) : stats ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {[
                                    { label: 'Total Analyses', value: stats.total_analyses, color: 'var(--accent-blue)' },
                                    { label: 'Avg Risk Score', value: stats.avg_risk_score, color: '#f59e0b' },
                                    { label: 'Critical', value: stats.critical_count, color: '#ef4444' },
                                    { label: 'High', value: stats.high_count, color: '#f97316' },
                                    { label: 'Medium', value: stats.medium_count, color: '#f59e0b' },
                                    { label: 'Low', value: stats.low_count, color: '#10b981' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{label}</span>
                                        <span style={{ color, fontWeight: 700, fontSize: 16 }}>{value ?? 0}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Could not load stats.</p>
                        )}
                    </div>

                    {/* Account Details */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><Shield size={16} color="var(--accent-blue)" /> Account Details</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { label: 'Username', value: user?.username },
                                { label: 'Email', value: user?.email },
                                { label: 'Role', value: user?.role || 'analyst' },
                                { label: 'Status', value: user?.is_active ? 'Active' : 'Inactive' },
                                { label: 'User ID', value: user?.id?.slice(0, 8) + '...', mono: true },
                            ].map(({ label, value, mono }) => (
                                <div key={label}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit' }}>{value || '—'}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sign Out */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><LogOut size={16} color="#ef4444" /> Session</div>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                            You are signed in as <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong>. Signing out will clear your session.
                        </p>
                        <button
                            className="btn"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', width: '100%', display: 'flex', justifyContent: 'center', gap: 8 }}
                            onClick={logout}
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
