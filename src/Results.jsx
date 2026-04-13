import React, { useState } from 'react'

const Results = ({ data, onBack }) => {
  const [activeTab, setActiveTab] = useState('sop')
  const [copied, setCopied] = useState(false)
  const [showPopup, setShowPopup] = useState(false)

  if (!data) {
    return <div className="p-10 text-center">Loading results...</div>
  }

  const handleCopy = () => {
    const content = document.getElementById('active-content')
    navigator.clipboard.writeText(content.innerText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadCSV = () => {
    const blob = new Blob([data?.csv || ''], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'process.csv'
    a.click()
  }

  return (
    <div className="flex flex-col items-center bg-[#d9efff] min-h-screen m-2 rounded-3xl py-10 px-5">

      {/* Header */}
      <p className="font-bold text-2xl text-[#00528d] mb-1 tracking-tight">
        Process Creator and Analyzer
      </p>
      <p className="text-sm text-[#00528d]/55 mb-6">
        Your SOP is ready — review and copy below
      </p>

      {/* Steps */}
      <div className="flex gap-2 mb-8">
        <span className="px-4 py-1 rounded-full text-xs bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">1 · Upload</span>
        <span className="px-4 py-1 rounded-full text-xs bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">2 · Analyse</span>
        <span className="px-4 py-1 rounded-full text-xs bg-[#00528d] text-white border border-[#00528d]">3 · Results</span>
      </div>

      <div className="bg-white rounded-3xl shadow-lg w-full max-w-2xl overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b-2 border-[#d9efff] px-5">
          {[
            { key: 'sop', label: 'SOP Document' },
            { key: 'lucid', label: 'Lucid File' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all
              ${activeTab === tab.key ? 'text-[#00528d] border-[#00528d]' : 'text-[#5a8aaa]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex justify-between px-5 py-3 border-b bg-[#fafcff]">
          <span className="text-xs text-[#5a8aaa]">
            Generated just now · {data?.sop?.steps?.length || 0} steps identified
          </span>

          <button onClick={handleCopy} className="text-sm text-[#00528d]">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Content */}
        <div id="active-content" className="p-6 max-h-[500px] overflow-y-auto">

          {/* SOP TAB */}
          {activeTab === 'sop' && (
            <div>

              <h2 className="font-bold text-lg text-[#00528d] mb-2">
                Standard Operating Procedure
              </h2>

              <p className="text-sm mb-4">
                {data?.sop?.purpose || "No SOP generated"}
              </p>

              <h3 className="font-semibold text-sm mb-2">Process Steps</h3>

              {data?.sop?.steps?.map((step, index) => (
                <div key={index} className="mb-3">
                  <span className="font-semibold text-[#00528d]">
                    Step {index + 1}: {step.title}
                  </span>
                  <p className="text-sm text-gray-600">
                    {step.description}
                  </p>
                </div>
              ))}

            </div>
          )}

          {/* LUCID TAB */}
          {activeTab === 'lucid' && (
            <div>

              {data?.sop?.steps?.map((step, index) => (
                <div key={index} className="mb-4 p-3 border rounded-lg">

                  <div className="flex justify-between">
                    <span>
                      Step {String(index + 1).padStart(2, '0')} · {step.title}
                    </span>

                    <span className={step.flag ? 'text-red-500' : 'text-green-500'}>
                      {step.flag ? '⚠ Bottleneck' : 'Clear'}
                    </span>
                  </div>

                </div>
              ))}

              <button
                onClick={handleDownloadCSV}
                className="mt-4 px-4 py-2 bg-[#00528d] text-white rounded"
              >
                Download CSV
              </button>

            </div>
          )}

        </div>
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        className="mt-6 px-5 py-2 border rounded-lg"
      >
        ← Start over
      </button>

      {/* Popup (only if bottleneck clicked later if needed) */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-white p-5 rounded-lg">
            Bottleneck details coming from backend soon...
          </div>
        </div>
      )}
    </div>
  )
}

export default Results