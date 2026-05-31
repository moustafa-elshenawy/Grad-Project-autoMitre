import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tick, setTick] = useState(true);
    const canvasRef = useRef(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    // Blinking cursor
    useEffect(() => {
        const t = setInterval(() => setTick(v => !v), 530);
        return () => clearInterval(t);
    }, []);

    // Green particle network (no globe)
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);
            const response = await fetch('http://127.0.0.1:8000/api/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });
            if (!response.ok) throw new Error('Invalid username or password');
            const data = await response.json();
            const userResponse = await fetch('http://127.0.0.1:8000/api/auth/me', {
                headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            if (!userResponse.ok) throw new Error('Failed to fetch user profile');
            const userData = await userResponse.json();
            login(userData, data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', boxSizing: 'border-box', position: 'relative', zIndex: 10,
        background: 'rgba(0,255,65,0.03)',
        border: '1px solid rgba(0,255,65,0.2)',
        padding: '13px 16px 13px 44px',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
        color: '#fff', outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        letterSpacing: '0.02em'
    };

    return (
        <div style={{ position: 'relative', minHeight: '100vh', background: '#020202', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden' }}>
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Archivo+Black&family=Archivo:wght@400;600;700&display=swap" rel="stylesheet" />

            {/* Particle canvas */}
            <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
            {/* Scanlines */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)', opacity: 0.6 }} />
            {/* Green ambient glow */}
            <div style={{ position: 'fixed', top: '20%', right: '10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,255,65,0.04) 0%, transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '15%', left: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(0,255,65,0.03) 0%, transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />

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

            {/* Back to home */}
            <button
                onClick={() => navigate('/')}
                style={{ position: 'fixed', top: 20, left: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.08em', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#00ff41'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
            >
                &lt;_ BACK TO HOME
            </button>

            {/* Card */}
            <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 420, padding: '0 24px' }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 22, letterSpacing: '0.04em', marginBottom: 8 }}>
                        <span style={{ color: '#00ff41', textShadow: '0 0 12px rgba(0,255,65,0.7)' }}>A</span>
                        <span style={{ color: '#fff' }}>uto</span>
                        <span style={{ color: '#00ff41', textShadow: '0 0 12px rgba(0,255,65,0.7)' }}>MITRE</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(0,255,65,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        &gt;_ THREAT INTELLIGENCE PLATFORM {tick ? '█' : ' '}
                    </div>
                </div>

                {/* Form panel */}
                <div style={{ background: 'rgba(0,255,65,0.02)', border: '1px solid rgba(0,255,65,0.15)', padding: '40px 36px', backdropFilter: 'blur(12px)' }}>

                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 10, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.12em', marginBottom: 10 }}>&gt;_ // ACCESS PORTAL</div>
                        <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 24, fontWeight: 900, color: '#00ff41', letterSpacing: '-0.02em', textTransform: 'uppercase', margin: '0 0 6px', textShadow: '0 0 20px rgba(0,255,65,0.3)' }}>
                            SYSTEM LOGIN
                        </h1>
                        <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                            Authenticate to access the threat platform
                        </p>
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', padding: '11px 14px', marginBottom: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f87171', letterSpacing: '0.02em' }}>
                            <span>[!]</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Email */}
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'rgba(0,255,65,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                [01] IDENTIFIER
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(0,255,65,0.4)', fontSize: 12 }}>&gt;_</span>
                                <input
                                    type="text" value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="analyst@org.com or username"
                                    required
                                    style={inputStyle}
                                    onFocus={e => { e.target.style.borderColor = '#00ff41'; e.target.style.boxShadow = '0 0 12px rgba(0,255,65,0.15)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(0,255,65,0.2)'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'rgba(0,255,65,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                [02] PASSPHRASE
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(0,255,65,0.4)', fontSize: 12 }}>#_</span>
                                <input
                                    type="password" value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    required
                                    style={{ ...inputStyle, letterSpacing: '0.15em' }}
                                    onFocus={e => { e.target.style.borderColor = '#00ff41'; e.target.style.boxShadow = '0 0 12px rgba(0,255,65,0.15)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(0,255,65,0.2)'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{ width: '100%', background: isLoading ? 'rgba(0,255,65,0.3)' : '#00ff41', border: '1px solid #00ff41', padding: '14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#000', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 0 20px rgba(0,255,65,0.3)', transition: 'all 0.2s', marginTop: 6 }}
                            onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00ff41'; e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,65,0.5)'; } }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#00ff41'; e.currentTarget.style.color = '#000'; e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,65,0.3)'; }}
                        >
                            {isLoading ? '[ AUTHENTICATING... ]' : '[ INITIATE ACCESS />]'}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(0,255,65,0.1)', textAlign: 'center' }}>
                        <Link to="/register" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.2s' }}
                            onMouseEnter={e => e.target.style.color = '#00ff41'}
                            onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.35)'}
                        >
                            NO ACCOUNT? <span style={{ color: '#00ff41' }}>REQUEST ACCESS /&gt;</span>
                        </Link>
                    </div>
                </div>

                {/* Security badge */}
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

export default Login;


