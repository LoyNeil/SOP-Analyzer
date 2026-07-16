import React, { useState, useCallback } from "react"
import UploadTranscript from "./UploadTranscript"
import Footer from "./Footer"
import ChatBot from "./ChatBot"  

const NAV_ITEMS = [
  {
    key: "sop",
    label: "SOP Creator",
    sub: "AI",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M12 3v14M7 8l5-5 5 5" />
        <path d="M5 18v3h14v-3" />
      </svg>
    ),
  },
  {
    key: "diagram",
    label: "Diagram",
    sub: "Build from scratch",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <rect x="3" y="4" width="7" height="5" rx="1" />
        <rect x="14" y="4" width="7" height="5" rx="1" />
        <rect x="8.5" y="15" width="7" height="5" rx="1" />
        <path d="M6.5 9v3h11V9M12 12v3" />
      </svg>
    ),
  },
  {
    key: "chat",
    label: "Chat Bot",
    sub: "Friendly agent to explain process",
    icon:(
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#4A90D9"
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        width="20"
        height="20"
      >
        <path d="M12 2v3" />
        <circle cx="12" cy="2" r="1.5" />
        <rect x="3" y="5" width="18" height="13" rx="2" />
        <circle cx="9" cy="11" r="1.5" />
        <circle cx="15" cy="11" r="1.5" />
        <path d="M8.5 14.5q3.5 2 7 0" />
        <path d="M3 10h-1M22 10h-1" />
      </svg>
    )
  }
]

const Sidebar = ({ active, onSelect }) => (
  <aside className="hidden md:flex flex-col w-[220px] shrink-0 bg-white border-r border-[#d9efff] p-4">
    <div className="px-2 mb-6">
      <p className="font-bold text-lg text-[#00528d] leading-tight tracking-tight">
        Process Creator and <span className="block text-center">Analyzer</span>
      </p>
      <p className="text-[11px] text-[#00528d]/50 text-center">CAMP Team</p>
    </div>

    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(item => {
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer
              ${isActive
                ? "bg-[#00528d] text-white shadow-sm"
                : "text-[#00528d] hover:bg-[#d9efff]"
              }`}
          >
            <span className={isActive ? "text-white" : "text-[#00528d]/70"}>
              {item.icon}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">{item.label}</span>
              <span className={`text-[10px] leading-tight ${isActive ? "text-white/70" : "text-[#00528d]/45"}`}>
                {item.sub}
              </span>
            </span>
          </button>
        )
      })}
    </nav>

    {/*<div className="mt-auto px-2 pt-4 text-[10px] text-[#00528d]/40 leading-relaxed">
      Diagram opens in a new tab. Export to JSON before closing — work isn't saved.
    </div>*/}
  </aside>
)

function App() {
  const [active, setActive] = useState("sop")
  const [hideSidebar, setHideSidebar] = useState(false)

  const params = new URLSearchParams(window.location.search)
  const view = params.get("view")

  if (view === "chat") return <ChatBot />
  if (view === "builder") return <DiagramBuilder /> 

  const handleShowResults = useCallback((isResults) => {
    setHideSidebar(isResults)
  }, [])

  const handleSelect = (key) => {
    if (key === "diagram") {
      const url = `${window.location.origin}${window.location.pathname}?view=builder`
      window.open(url, "_blank", "noopener")
      return
    }
    if (key === "chat") {
      const url = `${window.location.origin}${window.location.pathname}?view=chat`
      window.open(url,"_blank","noopener")
      return
    }
    setActive(key)
  }

  return (
    <div className="flex min-h-screen">
      {!hideSidebar && <Sidebar active={active} onSelect={handleSelect} />}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1">
          <UploadTranscript onShowResults={handleShowResults} />
        </div>
        <Footer />
      </div>
    </div>
  )
}

export default App
