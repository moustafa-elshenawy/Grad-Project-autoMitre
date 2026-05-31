import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const inputStyle = {
    width: '100%', boxSizing: 'border-box', position: 'relative', zIndex: 10,
    background: 'rgba(0,255,65,0.03)',
    border: '1px solid rgba(0,255,65,0.2)',
    padding: '12px 14px 12px 42px',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
    color: '#fff', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
};

const Field = ({ label, tag, icon, type = 'text', value, onChange, placeholder, style = {} }) => (
    <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'rgba(0,255,65,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
            {tag} {label}
        </label>
        <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(0,255,65,0.4)', fontSize: 12 }}>{icon}</span>
            <input type={type} value={value} onChange={onChange} placeholder={placeholder} required
                style={{ ...inputStyle, ...style }}
                onFocus={e => { e.target.style.borderColor = '#00ff41'; e.target.style.boxShadow = '0 0 12px rgba(0,255,65,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(0,255,65,0.2)'; e.target.style.boxShadow = 'none'; }}
            />
        </div>
    </div>
);

const securityWords = [
    { text: 'RANSOMWARE', top: '10%', size: '28px', blur: '2px', duration: '40s', delay: '-10s', dir: 'right' },
    { text: 'SQL INJECTION', top: '25%', size: '20px', blur: '3px', duration: '45s', delay: '-5s', dir: 'left' },
    { text: 'MITRE ATT&CK', top: '40%', size: '32px', blur: '1.5px', duration: '35s', delay: '-15s', dir: 'right' },
    { text: 'ZERO-DAY EXPLOIT', top: '55%', size: '24px', blur: '3px', duration: '50s', delay: '-20s', dir: 'left' },
    { text: 'PHISHING LINK', top: '70%', size: '26px', blur: '4px', duration: '38s', delay: '-2s', dir: 'right' },
    { text: 'APT29 / COBALT STRIKE', top: '85%', size: '22px', blur: '4px', duration: '48s', delay: '-25s', dir: 'left' },
    { text: 'CREDENTIAL HARVESTING', top: '18%', size: '18px', blur: '3px', duration: '55s', delay: '-30s', dir: 'left' },
    { text: 'DATA EXFILTRATION', top: '33%', size: '22px', blur: '2px', duration: '42s', delay: '-8s', dir: 'right' },
    { text: 'T1059.001', top: '48%', size: '24px', blur: '3px', duration: '30s', delay: '-12s', dir: 'left' },
    { text: 'BRUTE FORCE', top: '63%', size: '18px', blur: '4px', duration: '52s', delay: '-18s', dir: 'right' },
    { text: 'MALWARE ANALYSIS', top: '78%', size: '20px', blur: '3px', duration: '46s', delay: '-14s', dir: 'left' },
    { text: 'RECONNAISSANCE', top: '92%', size: '22px', blur: '5px', duration: '60s', delay: '-7s', dir: 'right' },
];

const Register = () => {
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [groupChoice, setGroupChoice] = useState('none');
    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tick, setTick] = useState(true);
    const canvasRef = useRef(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const getPasswordStrength = (pass) => {
        if (!pass) return { label: 'AWAITING INPUT', color: 'rgba(255,255,255,0.2)', progress: 0 };
        let score = 0;
        if (pass.length > 7) score += 1;
        if (pass.match(/[A-Z]/) && pass.match(/[a-z]/)) score += 1;
        if (pass.match(/[0-9]/)) score += 1;
        if (pass.match(/[^A-Za-z0-9]/)) score += 1;

        switch (score) {
            case 0:
            case 1: return { label: 'WEAK', color: '#ef4444', progress: 25 };
            case 2: return { label: 'FAIR', color: '#f59e0b', progress: 50 };
            case 3: return { label: 'GOOD', color: '#eab308', progress: 75 };
            case 4: return { label: 'STRONG', color: '#00ff41', progress: 100 };
            default: return { label: 'AWAITING INPUT', color: 'rgba(255,255,255,0.2)', progress: 0 };
        }
    };

    useEffect(() => {
        const t = setInterval(() => setTick(v => !v), 530);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;
        const pts = Array.from({ length: 55 }, () => ({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.1 + 0.3
        }));
        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            pts.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,255,65,0.45)';
                ctx.fill();
            });
            pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (d < 110) {
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(0,255,65,${0.12 * (1 - d / 110)})`;
                    ctx.lineWidth = 0.5; ctx.stroke();
                }
            }));
            raf = requestAnimationFrame(draw);
        };
        draw();
        const onR = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
        window.addEventListener('resize', onR);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
    }, []);

    const handleCredentialsNext = (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passphrases do not match'); return; }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (groupChoice === 'create' && !groupName.trim()) { setError('Workspace name required.'); return; }
        setIsLoading(true);
        try {
            const regResponse = await fetch('http://127.0.0.1:8000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            if (!regResponse.ok) {
                const errData = await regResponse.json();
                throw new Error(errData.detail || 'Registration failed');
            }
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            const loginResponse = await fetch('http://127.0.0.1:8000/api/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });
            if (!loginResponse.ok) throw new Error('Auto-login failed. Please sign in manually.');
            const data = await loginResponse.json();
            const userResponse = await fetch('http://127.0.0.1:8000/api/auth/me', {
                headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            if (!userResponse.ok) throw new Error('Failed to fetch user profile');
            const userData = await userResponse.json();
            if (groupChoice === 'create' && groupName.trim()) {
                await fetch('http://127.0.0.1:8000/api/groups/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.access_token}` },
                    body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() || null }),
                });
            }
            login(userData, data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(Array.isArray(err.message) ? err.message[0].msg : err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div style={{ position: 'relative', minHeight: '100vh', background: '#020202', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', padding: '24px' }}>
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Archivo+Black&family=Archivo:wght@400;600;700&display=swap" rel="stylesheet" />

            <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)', opacity: 0.6 }} />
            <div style={{ position: 'fixed', top: '15%', right: '8%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,255,65,0.04) 0%, transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />

            {/* Blurry glowing security words */}
            {securityWords.map((word, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    top: word.top,
                    left: 0,
                    fontSize: word.size,
                    color: 'rgba(0, 255, 65, 0.05)',
                    textShadow: '0 0 10px rgba(0, 255, 65, 0.5), 0 0 20px rgba(0, 255, 65, 0.2)',
                    filter: `blur(${word.blur})`,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    zIndex: 1,
                    animation: `move-${word.dir} ${word.duration} linear infinite`,
                    animationDelay: word.delay,
                    whiteSpace: 'nowrap',
                }}>
                    {word.text}
                </div>
            ))}

            <button onClick={() => navigate('/')}
                style={{ position: 'fixed', top: 20, left: 32, zIndex: 10, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.08em', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#00ff41'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
            >&lt;_ BACK TO HOME</button>

            <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: step === 2 ? 480 : 440 }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 22, letterSpacing: '0.04em', marginBottom: 8 }}>
                        <span style={{ color: '#00ff41', textShadow: '0 0 12px rgba(0,255,65,0.7)' }}>A</span>
                        <span style={{ color: '#fff' }}>uto</span>
                        <span style={{ color: '#00ff41', textShadow: '0 0 12px rgba(0,255,65,0.7)' }}>MITRE</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(0,255,65,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        &gt;_ THREAT INTELLIGENCE PLATFORM {tick ? '█' : ' '}
                    </div>
                </div>

                {/* Step bar */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 28, justifyContent: 'center' }}>
                    {[1, 2].map(s => (
                        <div key={s} style={{ width: 48, height: 3, background: s <= step ? '#00ff41' : 'rgba(0,255,65,0.15)', boxShadow: s <= step ? '0 0 8px rgba(0,255,65,0.5)' : 'none', transition: 'all 0.3s' }} />
                    ))}
                </div>

                {/* Panel */}
                <div style={{ background: 'rgba(0,255,65,0.02)', border: '1px solid rgba(0,255,65,0.15)', padding: '36px 36px', backdropFilter: 'blur(12px)' }}>

                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 10, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.12em', marginBottom: 10 }}>
                            &gt;_ // {step === 1 ? 'NEW INSTANCE' : 'WORKSPACE SETUP'} · STEP {step}/2
                        </div>
                        <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 22, fontWeight: 900, color: '#00ff41', letterSpacing: '-0.02em', textTransform: 'uppercase', margin: '0 0 6px', textShadow: '0 0 20px rgba(0,255,65,0.3)' }}>
                            {step === 1 ? 'CREATE ACCOUNT' : 'TEAM CONFIG'}
                        </h1>
                        <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                            {step === 1 ? 'Register a new secure analyst account' : 'Configure your workspace environment'}
                        </p>
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', padding: '11px 14px', marginBottom: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f87171' }}>
                            <span>[!]</span> {error}
                        </div>
                    )}

                    {/* Step 1 */}
                    {step === 1 && (
                        <form onSubmit={handleCredentialsNext} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Field label="Username" tag="[01]" icon=">_" value={username} onChange={e => setUsername(e.target.value)} placeholder="analyst_handle" />
                            <Field label="Email" tag="[02]" icon="@_" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="analyst@org.io" />
                            
                            <div>
                                <Field label="Passphrase" tag="[03]" icon="#_" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ letterSpacing: '0.15em' }} />
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.05em' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>&gt;_ ENCRYPTION STRENGTH:</span>
                                    <span style={{ color: getPasswordStrength(password).color }}>[{getPasswordStrength(password).label}]</span>
                                </div>
                                <div style={{ marginTop: 5, height: 2, background: 'rgba(255,255,255,0.08)', width: '100%' }}>
                                    <div style={{ height: '100%', width: `${getPasswordStrength(password).progress}%`, background: getPasswordStrength(password).color, transition: 'all 0.3s ease' }} />
                                </div>
                            </div>

                            <Field label="Confirm Passphrase" tag="[04]" icon="#_" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ letterSpacing: '0.15em' }} />
                            <button type="submit" style={{ width: '100%', background: '#00ff41', border: '1px solid #00ff41', padding: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#000', cursor: 'pointer', boxShadow: '0 0 20px rgba(0,255,65,0.3)', transition: 'all 0.2s', marginTop: 6 }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00ff41'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#00ff41'; e.currentTarget.style.color = '#000'; }}>
                                CONTINUE /&gt;
                            </button>
                        </form>
                    )}

                    {/* Step 2 */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { key: 'create', label: 'Create Team Workspace', sub: 'Become admin. Invite analysts to collaborate on shared threat libraries.', icon: '[T]' },
                                { key: 'none', label: 'Individual Analyst', sub: 'Work independently. You can be invited to a team later.', icon: '[I]' },
                            ].map(opt => (
                                <div key={opt.key} onClick={() => setGroupChoice(opt.key)} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s', border: groupChoice === opt.key ? '1px solid #00ff41' : '1px solid rgba(0,255,65,0.12)', background: groupChoice === opt.key ? 'rgba(0,255,65,0.05)' : 'transparent', boxShadow: groupChoice === opt.key ? '0 0 12px rgba(0,255,65,0.1)' : 'none' }}>
                                    <span style={{ color: '#00ff41', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{opt.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: groupChoice === opt.key ? '#00ff41' : '#fff', marginBottom: 4 }}>{opt.label}</div>
                                        <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{opt.sub}</div>
                                    </div>
                                </div>
                            ))}

                            {groupChoice === 'create' && (
                                <div style={{ padding: '16px', background: 'rgba(0,255,65,0.03)', border: '1px solid rgba(0,255,65,0.1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <Field label="Workspace Name *" tag="[W1]" icon=">_" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ACME SOC Team" />
                                    <Field label="Description" tag="[W2]" icon=">_" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Security operations team" />
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(0,255,65,0.2)', padding: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', color: 'rgba(0,255,65,0.6)', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff41'; e.currentTarget.style.color = '#00ff41'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,255,65,0.2)'; e.currentTarget.style.color = 'rgba(0,255,65,0.6)'; }}>
                                    &lt; BACK
                                </button>
                                <button type="submit" disabled={isLoading} style={{ flex: 2, background: isLoading ? 'rgba(0,255,65,0.3)' : '#00ff41', border: '1px solid #00ff41', padding: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#000', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 0 20px rgba(0,255,65,0.3)', transition: 'all 0.2s' }}
                                    onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00ff41'; } }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#00ff41'; e.currentTarget.style.color = '#000'; }}>
                                    {isLoading ? '[ PROVISIONING... ]' : groupChoice === 'create' ? '[ DEPLOY WORKSPACE />' : '[ INITIALIZE ACCOUNT />'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(0,255,65,0.1)', textAlign: 'center' }}>
                        <Link to="/login" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.2s' }}
                            onMouseEnter={e => e.target.style.color = '#00ff41'}
                            onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.35)'}
                        >
                            HAVE AN ACCOUNT? <span style={{ color: '#00ff41' }}>SIGN IN /&gt;</span>
                        </Link>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(0,255,65,0.25)', letterSpacing: '0.08em' }}>
                    [+] 256-BIT ENCRYPTED · ZERO-TRUST ARCHITECTURE
                </div>
            </div>

            <style>{`
                input::placeholder { color: rgba(255,255,255,0.18); font-family: 'JetBrains Mono', monospace; }
                input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #020202 inset !important; -webkit-text-fill-color: #fff !important; }
                @keyframes move-right {
                    0% { transform: translate3d(-25vw, 0, 0) rotate(0deg); }
                    50% { transform: translate3d(50vw, -15px, 0) rotate(3deg); }
                    100% { transform: translate3d(125vw, 0, 0) rotate(0deg); }
                }
                @keyframes move-left {
                    0% { transform: translate3d(125vw, 0, 0) rotate(0deg); }
                    50% { transform: translate3d(50vw, 15px, 0) rotate(-3deg); }
                    100% { transform: translate3d(-25vw, 0, 0) rotate(0deg); }
                }
            `}</style>
        </div>
    );
};

export default Register;


