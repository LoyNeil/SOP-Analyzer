import { useState, useRef, useEffect } from 'react'
import Footer from './Footer'

const ChatBot = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I am your process assistant. Ask me anything about the process or roles and responsibilities of the team.',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', text: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: 'You are a helpful process assistant. You help users understand SOPs, transcripts, and process workflows.',
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.text })),
            { role: 'user', content: input },
          ],
        }),
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not get a response.'
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#d9efff]">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl mx-2 mt-2 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-[#00528d] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="18" height="18">
            <rect x="3" y="5" width="18" height="13" rx="2"/>
            <circle cx="9" cy="11" r="1.5"/>
            <circle cx="15" cy="11" r="1.5"/>
            <path d="M8.5 14.5q3.5 2 7 0"/>
            <path d="M12 2v3"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00528d]">Process Assistant</p>
          <p className="text-xs text-[#5a8aaa]">Ask me anything about your processes</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs text-[#ef4444] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block"></span>
          Offline
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-[#00528d] flex items-center justify-center mr-2 shrink-0 mt-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="14" height="14">
                  <rect x="3" y="5" width="18" height="13" rx="2"/>
                  <circle cx="9" cy="11" r="1.5"/>
                  <circle cx="15" cy="11" r="1.5"/>
                  <path d="M8.5 14.5q3.5 2 7 0"/>
                </svg>
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-[#00528d] text-white rounded-br-sm'
                  : 'bg-white text-[#1e3a5f] rounded-bl-sm shadow-sm'
                }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg bg-[#00528d] flex items-center justify-center mr-2 shrink-0 mt-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="14" height="14">
                <rect x="3" y="5" width="18" height="13" rx="2"/>
                <circle cx="9" cy="11" r="1.5"/>
                <circle cx="15" cy="11" r="1.5"/>
                <path d="M8.5 14.5q3.5 2 7 0"/>
              </svg>
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-[#b8dcf8] animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-[#b8dcf8] animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-[#b8dcf8] animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 bg-white rounded-2xl mx-2 mb-2 shadow-sm">
        <div className="flex items-center gap-3 bg-[#f0f9ff] border border-[#b8dcf8] rounded-2xl px-3 py-3">
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your process or SOP..."
            className="flex-1 bg-transparent text-sm text-[#1e3a5f] placeholder-[#94bdd4] resize-none outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{ background: isLoading || !input.trim() ? '#b8dcf8' : '#00528d' }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="13" height="13">
              <path d="M12 7H2M7 2l5 5-5 5"/>
            </svg>
          </button>
        </div>
        <p className="text-xs text-[#94bdd4] text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
              <Footer />
    </div>
  )
}

export default ChatBot