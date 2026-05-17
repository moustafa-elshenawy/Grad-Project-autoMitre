import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, Mail, Users, ShieldCheck, ShieldAlert, Building2 } from 'lucide-react';

const Register = () => {
    const [step, setStep] = useState(1); // 1 = credentials, 2 = group option
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [groupChoice, setGroupChoice] = useState('none'); // 'create' | 'none'
    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleCredentialsNext = (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (groupChoice === 'create' && !groupName.trim()) {
            setError('Please enter a workspace name.');
            return;
        }
        setIsLoading(true);
        try {
            // 1. Register account
            const regResponse = await fetch('http://localhost:8000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            if (!regResponse.ok) {
                const errData = await regResponse.json();
                throw new Error(errData.detail || 'Registration failed');
            }

            // 2. Auto-login
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            const loginResponse = await fetch('http://localhost:8000/api/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });
            if (!loginResponse.ok) throw new Error('Auto-login failed. Please log in manually.');
            const data = await loginResponse.json();

            const userResponse = await fetch('http://localhost:8000/api/auth/me', {
                headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            if (!userResponse.ok) throw new Error('Failed to fetch user profile');
            const userData = await userResponse.json();

            // 3. Create group if requested
            if (groupChoice === 'create' && groupName.trim()) {
                await fetch('http://localhost:8000/api/groups/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${data.access_token}`,
                    },
                    body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() || null }),
                });
            }

            login(userData, data.access_token);
            navigate('/');
        } catch (err) {
            if (Array.isArray(err.message)) setError(err.message[0].msg);
            else setError(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-glow" />
            <div className="auth-content">
                <div className="auth-card" style={{ maxWidth: step === 2 ? 480 : 420 }}>
                    <div className="auth-header">
                        <div className="auth-logo">
                            <ShieldCheck size={32} color="#0077BC" strokeWidth={2.5} />
                            <h1>AutoMITRE</h1>
                        </div>
                        <h2 className="auth-title">
                            {step === 1 ? 'Create Instance' : 'Team Workspace'}
                        </h2>
                        <p className="auth-subtitle">
                            {step === 1
                                ? 'Register for a new secure workspace environment'
                                : 'Set up your team or join as an individual analyst'}
                        </p>
                    </div>

                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
                        {[1, 2].map(s => (
                            <div key={s} style={{
                                width: 32, height: 4, borderRadius: 2,
                                background: s <= step ? 'var(--accent-blue, #0077BC)' : 'rgba(255,255,255,0.12)',
                                transition: 'background 0.3s'
                            }} />
                        ))}
                    </div>

                    {error && (
                        <div className="auth-error">
                            <ShieldAlert size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Step 1: Credentials */}
                    {step === 1 && (
                        <form onSubmit={handleCredentialsNext} className="auth-form">
                            <div className="auth-group">
                                <label className="auth-label">Username</label>
                                <div className="auth-input-wrapper">
                                    <div className="auth-input-icon"><User size={16} /></div>
                                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                        className="auth-input" placeholder="Choose an identifier" required />
                                </div>
                            </div>
                            <div className="auth-group">
                                <label className="auth-label">Email</label>
                                <div className="auth-input-wrapper">
                                    <div className="auth-input-icon"><Mail size={16} /></div>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        className="auth-input" placeholder="analyst@organization.io" required />
                                </div>
                            </div>
                            <div className="auth-group">
                                <label className="auth-label">Password</label>
                                <div className="auth-input-wrapper">
                                    <div className="auth-input-icon"><Lock size={16} /></div>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                        className="auth-input" style={{ letterSpacing: '0.2em' }} placeholder="••••••••" required />
                                </div>
                            </div>
                            <div className="auth-group">
                                <label className="auth-label">Confirm Password</label>
                                <div className="auth-input-wrapper">
                                    <div className="auth-input-icon"><Lock size={16} /></div>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                        className="auth-input" style={{ letterSpacing: '0.2em' }} placeholder="••••••••" required />
                                </div>
                            </div>
                            <button type="submit" className="auth-button">Continue →</button>
                        </form>
                    )}

                    {/* Step 2: Group choice */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                                {/* Option: Create workspace */}
                                <div
                                    onClick={() => setGroupChoice('create')}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                                        borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                                        border: groupChoice === 'create'
                                            ? '1.5px solid #0077BC'
                                            : '1.5px solid rgba(255,255,255,0.1)',
                                        background: groupChoice === 'create'
                                            ? 'rgba(14,165,233,0.08)'
                                            : 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <div style={{ marginTop: 2 }}>
                                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #0077BC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {groupChoice === 'create' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0077BC' }} />}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Building2 size={15} color="#0077BC" />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>Create Team Workspace</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                                            You become the admin. Invite analysts to share threat data and collaborate.
                                        </div>
                                    </div>
                                </div>

                                {/* Option: Individual analyst */}
                                <div
                                    onClick={() => setGroupChoice('none')}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                                        borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                                        border: groupChoice === 'none'
                                            ? '1.5px solid #0077BC'
                                            : '1.5px solid rgba(255,255,255,0.1)',
                                        background: groupChoice === 'none'
                                            ? 'rgba(14,165,233,0.08)'
                                            : 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <div style={{ marginTop: 2 }}>
                                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #0077BC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {groupChoice === 'none' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0077BC' }} />}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <User size={15} color="#64748b" />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>Individual Analyst</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                                            Work independently. You can still be invited to a team later.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Group name fields (shown only when 'create' is chosen) */}
                            {groupChoice === 'create' && (
                                <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(14,165,233,0.04)', borderRadius: 8, border: '1px solid rgba(14,165,233,0.15)' }}>
                                    <div className="auth-group" style={{ marginBottom: 10 }}>
                                        <label className="auth-label">Workspace Name <span style={{ color: '#ef4444' }}>*</span></label>
                                        <div className="auth-input-wrapper">
                                            <div className="auth-input-icon"><Users size={15} /></div>
                                            <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                                                className="auth-input" placeholder="e.g. ACME SOC Team" />
                                        </div>
                                    </div>
                                    <div className="auth-group" style={{ marginBottom: 0 }}>
                                        <label className="auth-label">Description <span style={{ color: '#475569', fontSize: 10 }}>(optional)</span></label>
                                        <div className="auth-input-wrapper">
                                            <div className="auth-input-icon"><Building2 size={15} /></div>
                                            <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
                                                className="auth-input" placeholder="Security operations team" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" onClick={() => setStep(1)}
                                    className="auth-button" style={{ background: 'rgba(255,255,255,0.06)', flex: 1 }}>
                                    ← Back
                                </button>
                                <button type="submit" disabled={isLoading} className="auth-button" style={{ flex: 2 }}>
                                    {isLoading ? 'Provisioning...' : groupChoice === 'create' ? '🛡 Create & Launch' : 'Initialize Account'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="auth-footer">
                        <Link to="/login" className="auth-link">Already have an account? Sign In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
