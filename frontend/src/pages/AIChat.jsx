import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Shield, FileText, Download } from 'lucide-react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000'

const WELCOME_MESSAGE = {
    role: 'assistant',
    content: `**Welcome to autoMITRE AI Risk Assessment**

I'm your AI-powered cybersecurity threat analyst with deep knowledge of:
- **MITRE ATT&CK** v14 (600+ techniques)
- **MITRE D3FEND** countermeasures
- **NIST SP 800-53** Rev 5 controls
- **OWASP** Top 10 & ASVS

**How can I help?** Ask me anything:
- *"Analyze a ransomware threat"*
- *"What NIST controls apply to brute force attacks?"*
- *"How do I defend against SQL injection?"*
- *"Explain the MITRE ATT&CK framework"*`,
    suggestions: ['Analyze ransomware threat', 'Explain MITRE ATT&CK', 'SQL injection defenses', 'NIST 800-53 overview']
}

function formatMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^### (.*)/gm, '<h3>$1</h3>')
        .replace(/^## (.*)/gm, '<h2>$1</h2>')
        .replace(/^# (.*)/gm, '<h1>$1</h1>')
        .replace(/^\| (.*)/gm, (m) => `<div style="font-family:JetBrains Mono,monospace;font-size:11px;padding:2px 0;color:#94a3b8">${m}</div>`)
        .replace(/^- (.*)/gm, '<li>$1</li>')
        .replace(/\n/g, '<br/>')
        .replace(/(<li>.*?<\/li>(?:<br\/>)?)+/gs, (m) => `<ul style="padding-left:16px">${m.replace(/<br\/>/g, '')}</ul>`)
}

export default function AIChat() {
    const [messages, setMessages] = useState([WELCOME_MESSAGE])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [isInputFocused, setIsInputFocused] = useState(false)
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)

    const isWriting = isInputFocused || input.trim().length > 0

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const sendMessage = async (text) => {
        const msg = text || input.trim()
        if (!msg) return
        setInput('')

        const newMessages = [...messages, { role: 'user', content: msg }]
        setMessages(newMessages)
        setLoading(true)

        try {
            const newHistory = newMessages.map(m => ({ role: m.role, content: m.content }))
            const token = localStorage.getItem('token')
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            const r = await axios.post(`${API}/api/chat`, {
                message: msg,
                context_data: null,
                chat_history: newHistory.slice(0, -1)
            }, { headers })
            setMessages([...newMessages, {
                role: 'assistant',
                content: r.data.response,
                suggestions: r.data.suggestions || []
            }])
        } catch {
            // Offline fallback
            const offline = `I'm unable to reach the backend API. Please ensure the autoMITRE API server is running:\n\n\`\`\`\ncd backend && source venv/bin/activate\npython main.py\n\`\`\`\n\nThe server should start on **http://127.0.0.1:8000**`
            setMessages([...newMessages, { role: 'assistant', content: offline, suggestions: [] }])
        }
        setLoading(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearChat = () => setMessages([WELCOME_MESSAGE])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 56px)', position: 'relative' }}>
            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                    ['Analyze Ransomware', 'Analyze a ransomware threat and provide MITRE ATT&CK mapping and D3FEND countermeasures'],
                    ['Phishing Defense', 'What are the best defenses against phishing attacks? Map to NIST controls.'],
                    ['MITRE ATT&CK', 'Explain the MITRE ATT&CK framework and its 14 tactics'],
                    ['NIST Controls', 'Explain NIST SP 800-53 Rev 5 key control families for a SOC environment'],
                ].map(([label, msg]) => (
                    <button key={label} className="chat-suggestion-btn" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => sendMessage(msg)}>
                        {label}
                    </button>
                ))}
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={clearChat}>
                    Clear Chat
                </button>
            </div>

            {/* Chat Area */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                <div className="chat-messages">
                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.role}`}>
                            <div className={`chat-avatar ${msg.role === 'assistant' ? 'ai' : 'user'}`}>
                                {msg.role === 'assistant' ? <Bot size={16} /> : <User size={14} />}
                            </div>
                            <div style={{ 
                                flex: 1, 
                                maxWidth: '80%', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: msg.role === 'assistant' ? 'flex-start' : 'flex-end' 
                            }}>
                                <div
                                    className={`chat-bubble ${msg.role === 'assistant' ? 'ai' : 'user'}`}
                                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                                />
                                {msg.suggestions?.length > 0 && (
                                    <div className="chat-suggestions" style={{ padding: '6px 0 0' }}>
                                        {msg.suggestions.map((s, si) => (
                                            <button key={si} className="chat-suggestion-btn" onClick={() => sendMessage(s)}>{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="chat-message">
                            <div className="chat-avatar ai"><Bot size={16} /></div>
                            <div className="chat-bubble ai">
                                <div className="typing-indicator">
                                    <div className="typing-dot" />
                                    <div className="typing-dot" />
                                    <div className="typing-dot" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="chat-input-area">
                    <textarea
                        ref={inputRef}
                        className="form-input"
                        placeholder="Ask about threats, frameworks, controls, or paste IoCs for analysis..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        rows={1}
                        style={{ resize: 'none', minHeight: 42 }}
                    />
                    <button
                        className="btn btn-primary"
                        style={{ height: 42, width: 42, padding: 0, justifyContent: 'center', flexShrink: 0 }}
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>

            {/* Interactive mascot companion */}
            <MascotBot isWriting={isWriting} isResponding={loading} />

            {/* Footer info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: '#475569' }}>
                <Sparkles size={12} color="#0077BC" />
                <span>Powered by autoMITRE AI · ATT&CK v14 · NIST SP 800-53 Rev 5 · OWASP Top 10 2021</span>
            </div>
        </div>
    )
}

const BOT_QUOTES = [
    "Beep boop! I am here to help you defend your network!",
    "Mapping adversary techniques to security controls is my specialty!",
    "Don't forget to review the NIST SP 800-53 mitigation guides!",
    "Tip: OSINT feeds keep you updated on active zero-days.",
    "Blink... blink... standard security protocols are green!",
    "Need threat insights? Ask me about a ransomware strain!",
    "Beep! I'm watching the firewalls. They look secure!",
    "Securing the cyberverse, one technique at a time!",
    "Scanning memory... All sub-routines running smoothly!"
]

const RESPONDING_PHRASES = [
    "Correlating ATT&CK techniques...",
    "Analyzing security controls...",
    "Querying NIST databases...",
    "Mapping defense vectors...",
    "Consulting threat feeds...",
    "Synthesizing recommendations..."
]

function MascotBot({ isWriting, isResponding }) {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [isHovered, setIsHovered] = useState(false)
    const [speechText, setSpeechText] = useState(BOT_QUOTES[0])
    const [respondingTextIdx, setRespondingTextIdx] = useState(0)
    const botRef = useRef(null)

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!botRef.current) return
            const rect = botRef.current.getBoundingClientRect()
            const botCenterX = rect.left + rect.width / 2
            const botCenterY = rect.top + rect.height / 2
            
            const deltaX = e.clientX - botCenterX
            const deltaY = e.clientY - botCenterY
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
            
            const maxOffset = 5
            const angle = Math.atan2(deltaY, deltaX)
            const offsetX = Math.cos(angle) * Math.min(maxOffset, distance / 15)
            const offsetY = Math.sin(angle) * Math.min(maxOffset, distance / 15)
            
            setMousePos({ x: offsetX, y: offsetY })
        }
        
        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    useEffect(() => {
        if (!isResponding) return
        const interval = setInterval(() => {
            setRespondingTextIdx(prev => (prev + 1) % RESPONDING_PHRASES.length)
        }, 1200)
        return () => clearInterval(interval)
    }, [isResponding])

    const handleMouseEnter = () => {
        setIsHovered(true)
        const randomIndex = Math.floor(Math.random() * BOT_QUOTES.length)
        setSpeechText(BOT_QUOTES[randomIndex])
    }

    const showBubble = isHovered || isWriting || isResponding

    return (
        <div 
            ref={botRef} 
            className={`cute-bot-companion ${isWriting ? 'bot-thinking' : ''} ${isResponding ? 'bot-responding' : ''}`}
            style={{
                position: 'absolute',
                bottom: '90px',
                right: '30px',
                zIndex: 100,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsHovered(false)}
        >
            {showBubble && (
                <div className={`bot-speech-bubble ${isWriting ? 'thinking' : ''} ${isResponding ? 'responding' : ''}`}>
                    {isResponding ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div className="typing-indicator" style={{ padding: 0, justifyContent: 'center' }}>
                                <div className="typing-dot" style={{ width: 6, height: 6 }} />
                                <div className="typing-dot" style={{ width: 6, height: 6 }} />
                                <div className="typing-dot" style={{ width: 6, height: 6 }} />
                            </div>
                            <span style={{ fontSize: '9px', opacity: 0.8, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {RESPONDING_PHRASES[respondingTextIdx]}
                            </span>
                        </div>
                    ) : isWriting ? (
                        <div className="typing-indicator" style={{ padding: 0, justifyContent: 'center' }}>
                            <div className="typing-dot" style={{ width: 6, height: 6 }} />
                            <div className="typing-dot" style={{ width: 6, height: 6 }} />
                            <div className="typing-dot" style={{ width: 6, height: 6 }} />
                        </div>
                    ) : (
                        speechText
                    )}
                </div>
            )}

            <div className="bot-body-container" style={{ position: 'relative', width: 64, height: 74 }}>
                <div className="bot-antenna" />
                <div className="bot-head">
                    <div className="bot-face">
                        <div 
                            className={isResponding ? "bot-eyes" : (isWriting ? "bot-eyes bot-eyes-thinking" : "bot-eyes")} 
                            style={{ 
                                transform: (isWriting || isResponding) 
                                    ? undefined 
                                    : `translate(${mousePos.x}px, ${mousePos.y}px)`
                            }}
                        >
                            <div className="bot-eye left" />
                            <div className="bot-eye right" />
                        </div>
                        <div className={
                            isResponding 
                                ? "bot-mouth"
                                : (isWriting 
                                    ? "bot-mouth bot-mouth-thinking" 
                                    : (isHovered ? "bot-mouth bot-mouth-smile" : "bot-mouth"))
                        } />
                    </div>
                </div>
                <div className="bot-hand left" />
                <div className="bot-hand right" />
            </div>
        </div>
    )
}
