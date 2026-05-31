import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ParticleBackground from '../components/ParticleBackground'

function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let s = null
    const step = (ts) => {
      if (!s) s = ts
      const p = Math.min((ts - s) / duration, 1)
      setCount(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

export default function Landing() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [globeX, setGlobeX] = useState(0)
  const homeRef = useRef(null)
  const statsRef = useRef(null)
  const techRef = useRef(null)
  const blogRef = useRef(null)
  const servicesRef = useRef(null)
  const [activeNav, setActiveNav] = useState('HOME')
  const [tick, setTick] = useState(true)

  const threats = useCounter(12480, 2200, heroLoaded)
  const accuracy = useCounter(97, 1800, statsVisible)
  const frameworks = useCounter(4, 1200, statsVisible)
  const analysts = useCounter(1800, 2400, statsVisible)

  // Trigger hero counter on load
  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 600)
    return () => clearTimeout(t)
  }, [])

  // Track scroll for parallax
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setTick(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  // Stats observer
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.3 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  // Scroll spy observer for active nav highlight
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0
    }

    const callback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target === homeRef.current) {
            setActiveNav('HOME')
          } else if (entry.target === servicesRef.current) {
            setActiveNav('SERVICES')
          } else if (entry.target === techRef.current) {
            setActiveNav('TECHNOLOGY')
          } else if (entry.target === blogRef.current) {
            setActiveNav('BLOG')
          }
        }
      })
    }

    const observer = new IntersectionObserver(callback, options)

    if (homeRef.current) observer.observe(homeRef.current)
    if (servicesRef.current) observer.observe(servicesRef.current)
    if (techRef.current) observer.observe(techRef.current)
    if (blogRef.current) observer.observe(blogRef.current)

    return () => observer.disconnect()
  }, [])

  // Globe horizontal oscillation — right → left → center
  useEffect(() => {
    const start = Date.now()
    let raf
    const animate = () => {
      const t = Math.min((Date.now() - start) / 4000, 1)
      const amplitude = 160 * Math.pow(1 - t, 1.8)
      const x = amplitude * Math.cos(t * 3.5 * Math.PI)
      setGlobeX(x)
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const navItems = [
    { label: 'HOME', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { label: 'SERVICES', action: () => scrollTo(servicesRef) },
    { label: 'TECHNOLOGY', action: () => scrollTo(techRef) },
    { label: 'BLOG', action: () => scrollTo(blogRef) },
  ]

  return (
    <div style={{ background: '#020202', color: '#00ff41', minHeight: '100vh', fontFamily: "'JetBrains Mono', monospace", overflowX: 'hidden', position: 'relative' }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Archivo+Black&family=Archivo:wght@400;600;700&display=swap" rel="stylesheet" />

      <ParticleBackground />

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 60,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(2,2,2,0.96)',
        backdropFilter: 'blur(8px)'
      }}>
        {/* Left: logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 14, letterSpacing: '0.04em' }}>
            <span style={{ color: '#00ff41', textShadow: '0 0 10px rgba(0,255,65,0.7)' }}>A</span><span style={{ color: '#fff' }}>uto</span><span style={{ color: '#00ff41', textShadow: '0 0 10px rgba(0,255,65,0.7)' }}>MITRE</span>
          </span>
        </div>

        {/* Center: nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {navItems.map(({ label, action }, i) => {
            const isActive = activeNav === label
            return (
              <button
                key={label}
                onClick={() => { setActiveNav(label); action() }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: isActive ? 700 : 500,
                  fontSize: 12, letterSpacing: '0.08em',
                  color: isActive ? '#00ff41' : '#fff',
                  padding: '0 20px', height: 60,
                  borderRight: i < navItems.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#00ff41' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#fff' }}
              >
                {isActive ? (
                  <span style={{ color: '#00ff41', fontWeight: 800, textShadow: '0 0 8px rgba(0,255,65,0.8)' }}>[+]&nbsp;{label}</span>
                ) : label}
              </button>
            )
          })}
        </div>

        {/* Right: CTA */}
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0,255,65,0.7)',
            color: '#00ff41',
            padding: '9px 20px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700, fontSize: 12,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            textShadow: '0 0 8px rgba(0,255,65,0.5)',
            boxShadow: '0 0 12px rgba(0,255,65,0.1)'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#00ff41'; e.currentTarget.style.color = '#000'; e.currentTarget.style.boxShadow = '0 0 24px rgba(0,255,65,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00ff41'; e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,65,0.1)' }}
        >
          REQUEST A DEMO /&gt;
        </button>
      </nav>

      {/* ── HERO ── */}
      <section ref={homeRef} style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '60px 40px 0', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: 780 }}>
          {/* Terminal tag */}
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(0,255,65,0.4)', marginBottom: 28, letterSpacing: '0.06em' }}>
            &gt;_ v1.2.0 · AI THREAT INTELLIGENCE PLATFORM{tick ? '█' : ' '}
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 'clamp(52px, 8vw, 96px)',
            fontWeight: 900, lineHeight: 0.95,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            margin: '0 0 28px',
            color: '#00ff41',
            textShadow: '0 0 40px rgba(0,255,65,0.3), 0 0 80px rgba(0,255,65,0.1)'
          }}>
            REALTIME<br />
            CYBERSECURITY.<br />
            <span style={{ WebkitTextStroke: '1px rgba(0,255,65,0.3)', color: 'transparent' }}>POWERED BY</span>{' '}
            <span style={{ color: '#00ff41', textShadow: '0 0 20px rgba(0,255,65,0.9)' }}>AI.</span>
          </h1>

          {/* Sub */}
          <p style={{
            fontFamily: 'Archivo, sans-serif', fontSize: 16,
            color: 'rgba(255,255,255,0.65)', lineHeight: 1.75,
            maxWidth: 500, marginBottom: 44
          }}>
            autoMITRE prevents attacks across enterprise networks using self-learning AI and autonomous MITRE ATT&CK mapping with blockchain-powered visibility.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: '#00ff41', border: '1px solid #00ff41',
                color: '#000', padding: '14px 32px',
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                fontSize: 13, letterSpacing: '0.06em', cursor: 'pointer',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 0 20px rgba(0,255,65,0.4)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00ff41' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#00ff41'; e.currentTarget.style.color = '#000' }}
            >
              REQUEST A DEMO /&gt;
            </button>
            <button
              onClick={() => navigate('/register')}
              style={{
                background: 'transparent', border: '1px solid rgba(0,255,65,0.3)',
                color: 'rgba(255,255,255,0.65)', padding: '14px 32px',
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                fontSize: 13, letterSpacing: '0.06em', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff41'; e.currentTarget.style.color = '#00ff41' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,255,65,0.3)'; e.currentTarget.style.color = 'rgba(0,255,65,0.6)' }}
            >
              GET A WHITEPAPER /&gt;
            </button>
          </div>

          {/* Scroll hint */}
          <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />
            SCROLL TO EXPLORE ///
          </div>
        </div>

        {/* Stat counter bottom-left */}
        <div style={{ position: 'absolute', bottom: 40, left: 40 }}>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>
            {threats.toLocaleString()}+
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
            AUDITS &amp; THREAT<br />SIMULATIONS COMPLETED.
          </div>
        </div>

        {/* Globe – parallax + horizontal oscillation */}
        <div style={{
          position: 'fixed',
          right: 0,
          top: 60,
          width: '52%',
          height: 'calc(100vh - 60px)',
          zIndex: 0,
          opacity: 0.85,
          transform: `translateX(${globeX}px) translateY(${scrollY * 0.35}px)`,
          transition: 'transform 0.05s linear',
          pointerEvents: 'none'
        }}>
          <GlobeVisual />
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section ref={statsRef} style={{ position: 'relative', zIndex: 1, padding: '0 0', borderTop: '1px solid rgba(0,255,65,0.08)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { v: accuracy + '%', label: 'DETECTION ACCURACY', sub: 'SecBERT + XGBoost' },
            { v: frameworks, label: 'FRAMEWORKS', sub: 'ATT&CK, D3FEND, NIST, OWASP' },
            { v: analysts.toLocaleString() + '+', label: 'ANALYST SESSIONS', sub: 'Across deployments' },
            { v: '< 2s', label: 'ANALYSIS TIME', sub: 'Avg per threat report' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '36px 32px', borderRight: i < 3 ? '1px solid rgba(0,255,65,0.08)' : 'none' }}>
              <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px,3vw,42px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>{s.v}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 40px', borderTop: '1px solid rgba(0,255,65,0.08)', scrollMarginTop: '80px' }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(0,255,65,0.3)', letterSpacing: '0.12em', marginBottom: 14 }}>&gt;_ // CORE CAPABILITIES</div>
          <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
            ENTERPRISE AI<br /><span style={{ color: 'rgba(255,255,255,0.3)', WebkitTextStroke: '1px rgba(0,255,65,0.25)' }}>THREAT INTEL</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, border: '1px solid rgba(0,255,65,0.08)' }}>
          {[
            { tag: '01', title: 'MITRE ATT&CK MAPPING', desc: 'Autonomous TTP identification with SecBERT multi-label classification across 600+ ATT&CK techniques.' },
            { tag: '02', title: 'AI THREAT ANALYSIS', desc: 'LLM-powered deep analysis — Groq Cloud or local Phi-3.5-mini for zero-latency inference on any hardware.' },
            { tag: '03', title: 'RISK HEATMAPS', desc: 'Interactive CVSS-calibrated severity matrices with XGBoost ensemble scoring and trend analysis.' },
            { tag: '04', title: 'LIVE THREAT FEED', desc: 'Real-time OSINT from AlienVault OTX, Abuse.ch URLhaus, and MalwareBazaar with auto-enrichment.' },
            { tag: '05', title: 'STIX 2.1 EXPORT', desc: 'Generate structured intelligence in STIX 2.1, JSON, CSV, and SIEM-ready formats in one click.' },
            { tag: '06', title: 'TEAM WORKSPACES', desc: 'Role-based analyst environments with shared threat libraries, audit logs, and collaborative views.' },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                padding: '40px 36px',
                borderRight: (i % 3 < 2) ? '1px solid rgba(0,255,65,0.08)' : 'none',
                borderBottom: i < 3 ? '1px solid rgba(0,255,65,0.08)' : 'none',
                transition: 'background 0.2s', cursor: 'default'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,65,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16, letterSpacing: '0.06em' }}>[{f.tag}]</div>
              <h3 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 12, color: "#00ff41" }}>{f.title}</h3>
              <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section ref={servicesRef} id="services" style={{ position: 'relative', zIndex: 1, padding: '80px 40px', borderTop: '1px solid rgba(0,255,65,0.08)', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.12em', marginBottom: 14 }}>&gt;_ // SERVICES</div>
          <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.05, margin: '0 0 24px', color: '#00ff41', textShadow: '0 0 30px rgba(0,255,65,0.2)' }}>WHAT WE OFFER</h2>
          <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 44, maxWidth: 680 }}>
            From continuous threat monitoring to on-demand red-team simulation, autoMITRE delivers end-to-end cybersecurity services powered by AI. Our platform integrates directly into your existing SOC workflow — providing real-time MITRE ATT&amp;CK mapping, risk prioritization, and actionable intelligence with zero configuration overhead.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, border: '1px solid rgba(0,255,65,0.08)' }}>
            {[
              { tag: '[S1]', title: 'THREAT MONITORING', desc: '24/7 autonomous surveillance of your attack surface. Ingests OSINT feeds, CVE advisories, and internal telemetry — alerts trigger in under 2 seconds.' },
              { tag: '[S2]', title: 'INCIDENT ANALYSIS', desc: 'On-demand deep-dive reports. Submit any log, payload, or indicator and receive a structured MITRE ATT&CK-mapped threat report within seconds.' },
              { tag: '[S3]', title: 'RED TEAM SIMULATION', desc: 'Automated adversary emulation using the MITRE ATT&CK framework. Test your defenses against real-world TTPs without deploying a physical red team.' },
              { tag: '[S4]', title: 'COMPLIANCE MAPPING', desc: 'Automatically correlate your threat posture against NIST CSF, ISO 27001, and OWASP controls. Generate audit-ready compliance reports in one click.' },
              { tag: '[S5]', title: 'STIX / TAXII EXPORT', desc: 'Share threat intelligence across your SIEM, SOAR, and partner networks via STIX 2.1 and TAXII 2.1 — fully automated and always up to date.' },
              { tag: '[S6]', title: 'ANALYST TRAINING', desc: 'Guided cyber ranges and live threat walkthroughs. Upskill your SOC team on real attack chains drawn from the latest ATT&CK techniques.' },
            ].map((s, i) => (
              <div key={i}
                style={{ padding: '36px 32px', borderRight: (i % 3 < 2) ? '1px solid rgba(0,255,65,0.08)' : 'none', borderBottom: i < 3 ? '1px solid rgba(0,255,65,0.08)' : 'none', transition: 'background 0.2s', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,65,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#00ff41', fontWeight: 700, marginBottom: 10, letterSpacing: '0.06em' }}>{s.tag}</div>
                <h3 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', marginBottom: 12 }}>{s.title}</h3>
                <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY ── */}
      <section ref={techRef} id="technology" style={{ position: 'relative', zIndex: 1, padding: '80px 40px', borderTop: '1px solid rgba(0,255,65,0.08)', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: 800 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.12em', marginBottom: 14 }}>&gt;_ // TECHNOLOGY</div>
          <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.05, margin: '0 0 24px', color: '#00ff41' }}>HOW IT WORKS</h2>
          <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 32 }}>
            autoMITRE combines a SecBERT transformer for multi-label MITRE ATT&amp;CK TTP classification with an XGBoost ensemble for risk scoring. A local or cloud-hosted LLM (Phi-3.5-mini or Groq) provides deep natural-language threat reasoning. All analysis runs in under two seconds — on-premises or cloud.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, border: '1px solid rgba(0,255,65,0.08)' }}>
            {[['SecBERT', 'Transformer model fine-tuned on CVE and threat-report corpora for TTP classification.'],['XGBoost Ensemble','Gradient-boosted severity scoring across CVSS, EPSS, and proprietary heuristics.'],['LLM Reasoning','Groq Cloud (llama-3) or local Phi-3.5-mini for narrative threat intelligence reports.']].map(([t,d],i) => (
              <div key={i} style={{ padding: '32px 28px', borderRight: i < 2 ? '1px solid rgba(0,255,65,0.08)' : 'none' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#00ff41', marginBottom: 10 }}>[0{i+1}] {t}</div>
                <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BLOG ── */}
      <section ref={blogRef} id="blog" style={{ position: 'relative', zIndex: 1, padding: '80px 40px', borderTop: '1px solid rgba(0,255,65,0.08)', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: 800 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.12em', marginBottom: 14 }}>&gt;_ // BLOG &amp; RESEARCH</div>
          <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.05, margin: '0 0 24px', color: '#00ff41' }}>THREAT INSIGHTS</h2>
          <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 40 }}>
            Deep-dives into emerging attack patterns, MITRE ATT&amp;CK framework updates, and real-world red-team simulations. Our research team publishes weekly analysis on adversarial TTPs and defensive countermeasures drawn directly from live threat data.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 0, border: '1px solid rgba(0,255,65,0.08)' }}>
            {[['APT29 TTP Breakdown','How autoMITRE mapped 47 techniques from a single NOBELIUM report in under 3 seconds.'],['MITRE ATT&CK v15 Delta','What changed in ATT&CK v15 and how our classifier was retrained in 48 hours.']].map(([t,d],i) => (
              <div key={i} style={{ padding: '32px 28px', borderRight: i < 1 ? '1px solid rgba(0,255,65,0.08)' : 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,65,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 10, letterSpacing: '0.08em' }}>RESEARCH NOTE</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#00ff41', marginBottom: 10 }}>{t}</div>
                <p style={{ fontFamily: 'Archivo, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 40px', borderTop: '1px solid rgba(0,255,65,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 40 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(0,255,65,0.3)', marginBottom: 16, letterSpacing: '0.1em' }}>&gt;_ // READY TO DEPLOY</div>
          <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(32px,4vw,56px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 1.0, margin: 0 }}>
            START ANALYZING<br />THREATS TODAY.
          </h2>
        </div>
        <button
          onClick={() => navigate('/login')}
          style={{
            flexShrink: 0,
            background: '#00ff41', border: '1px solid #fff',
            color: "#000", padding: '16px 40px',
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            fontSize: 13, letterSpacing: '0.08em', cursor: 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000' }}
        >
          LAUNCH PLATFORM /&gt;
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '24px 40px', borderTop: '1px solid rgba(0,255,65,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: '#00ff41' }}>A</span><span style={{ color: 'rgba(0,255,65,0.4)' }}>uto</span><span style={{ color: '#00ff41' }}>MITRE</span> © 2025
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>
          AI-DRIVEN CYBER THREAT INTELLIGENCE · v1.2.0
        </span>
      </footer>
    </div>
  )
}

function GlobeVisual() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = canvas.parentElement.offsetWidth
    const H = canvas.height = canvas.parentElement.offsetHeight
    const cx = W / 2, cy = H / 2
    const R = Math.min(W, H) * 0.38
    let angle = 0, raf

    const dots = []
    for (let lat = -80; lat <= 80; lat += 11) {
      for (let lon = 0; lon < 360; lon += 11) {
        dots.push({ lat: lat * Math.PI / 180, lon: lon * Math.PI / 180 })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Outer circle
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,255,65,0.08)'; ctx.lineWidth = 1; ctx.stroke()

      // Grid lines
      for (let i = 1; i < 7; i++) {
        const lat = (i / 7) * Math.PI - Math.PI / 2
        const yr = Math.cos(lat) * R
        const yp = cy + Math.sin(lat) * R
        ctx.beginPath(); ctx.ellipse(cx, yp, yr, yr * 0.12, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,255,65,0.06)'; ctx.lineWidth = 0.5; ctx.stroke()
      }
      for (let i = 0; i < 8; i++) {
        const lon = (i / 8) * Math.PI
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(Math.cos(lon + angle)) * R, R, lon + angle, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5; ctx.stroke()
      }

      // Dots
      dots.forEach(d => {
        const lon = d.lon + angle
        const x3 = Math.cos(d.lat) * Math.sin(lon)
        const y3 = Math.sin(d.lat)
        const z3 = Math.cos(d.lat) * Math.cos(lon)
        if (z3 < 0) return
        const bri = (z3 + 1) / 2
        ctx.beginPath()
        ctx.arc(cx + x3 * R, cy - y3 * R, bri * 1.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${bri * 0.6})`
        ctx.fill()
      })

      // Blue glow highlight on visible hemisphere
      const grd = ctx.createRadialGradient(cx + R * 0.25, cy - R * 0.15, 0, cx, cy, R)
      grd.addColorStop(0, 'rgba(0,255,65,0.06)')
      grd.addColorStop(1, 'transparent')
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = grd; ctx.fill()

      angle += 0.0025
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}






