import React, { useState } from 'react'

const Results = ({ data, onBack }) => {
  const [activeTab, setActiveTab] = useState('sop')
  const [copied, setCopied] = useState(false)
  const [expandedStep, setExpandedStep] = useState(null)
  const [selectedBottleneck, setSelectedBottleneck] = useState(null)

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
    const csvContent = data?.lucid?.csv || data?.csv || ''
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'process.csv'
    a.click()
  }

  const lucidSteps = data?.lucid?.steps || []
  const bottlenecks = data?.bottlenecks || []
  const sopSteps = data?.sop?.steps || []

  const getBottleneckForStep = (stepNumber) =>
    bottlenecks.find(b => String(b.step_number) === String(stepNumber).padStart(2, '0') || String(b.step_number) === String(stepNumber))

  return (
    <div className="flex flex-col items-center bg-[#d9efff] min-h-screen m-2 rounded-3xl py-10 px-5">

      {/* Header */}
      <p className="font-bold text-2xl text-[#00528d] mb-1 tracking-tight">
        Process Creator and Analyzer
      </p>
      <p className="text-sm text-[#00528d]/55 mb-6">
        Your SOP is ready — review and copy below
      </p>

      {/* Steps indicator */}
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
            { key: 'lucid', label: 'Lucid File' },
            { key: 'bottlenecks', label: `Bottlenecks ${bottlenecks.length > 0 ? `(${bottlenecks.length})` : ''}` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all
              ${activeTab === tab.key
                  ? 'text-[#00528d] border-[#00528d]'
                  : 'text-[#5a8aaa] border-transparent'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex justify-between px-5 py-3 border-b bg-[#fafcff]">
          <span className="text-xs text-[#5a8aaa]">
            Generated just now · {sopSteps.length} steps identified
          </span>
          <button onClick={handleCopy} className="text-sm text-[#00528d] font-medium">
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        {/* Content */}
        <div id="active-content" className="p-6 max-h-[600px] overflow-y-auto">

          {/* ── SOP TAB ── */}
          {activeTab === 'sop' && (
            <div>
              {/* Title */}
              <h2 className="font-bold text-lg text-[#00528d] mb-1">
                {data?.sop?.title || 'Standard Operating Procedure'}
              </h2>

              {/* Meta row */}
              <div className="flex gap-3 mb-4 flex-wrap">
                {data?.sop?.version && (
                  <span className="text-xs px-2 py-0.5 bg-[#e8f4ff] text-[#00528d] rounded-full">v{data.sop.version}</span>
                )}
                {data?.sop?.date && (
                  <span className="text-xs px-2 py-0.5 bg-[#e8f4ff] text-[#00528d] rounded-full">{data.sop.date}</span>
                )}
                {data?.sop?.tags?.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-[#f0f9ff] text-[#5a8aaa] rounded-full border border-[#d9efff]">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Purpose */}
              {data?.sop?.purpose && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-1">Purpose</p>
                  <p className="text-sm text-gray-600">{data.sop.purpose}</p>
                </div>
              )}

              {/* Scope */}
              {data?.sop?.scope && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-1">Scope</p>
                  <p className="text-sm text-gray-600">{data.sop.scope}</p>
                </div>
              )}

              {/* Roles */}
              {data?.sop?.roles?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-2">Roles & Responsibilities</p>
                  <div className="space-y-2">
                    {data.sop.roles.map((role, i) => (
                      <div key={i} className="p-3 bg-[#fafcff] rounded-xl border border-[#e8f4ff]">
                        <p className="text-sm font-semibold text-[#00528d]">{role.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{role.responsibility}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites */}
              {data?.sop?.prerequisites?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-2">Prerequisites</p>
                  <ul className="space-y-1">
                    {data.sop.prerequisites.map((p, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-[#00528d] mt-0.5">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Start / End states */}
              {(data?.sop?.start_state || data?.sop?.end_state) && (
                <div className="flex gap-3 mb-5">
                  {data.sop.start_state && (
                    <div className="flex-1 p-3 bg-[#e8f9f0] rounded-xl border border-[#b8edd0]">
                      <p className="text-xs font-semibold text-green-700 mb-0.5">Start State</p>
                      <p className="text-xs text-green-800">{data.sop.start_state}</p>
                    </div>
                  )}
                  {data.sop.end_state && (
                    <div className="flex-1 p-3 bg-[#fff4e8] rounded-xl border border-[#fdd9a8]">
                      <p className="text-xs font-semibold text-orange-700 mb-0.5">End State</p>
                      <p className="text-xs text-orange-800">{data.sop.end_state}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Steps */}
              <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-3">
                Step-by-Step Workflow
              </p>

              <div className="space-y-3">
                {sopSteps.map((step, index) => {
                  const isExpanded = expandedStep === index
                  const bottleneck = getBottleneckForStep(step.number)
                  const isDecision = step.title?.toLowerCase().includes('yes/no') ||
                    step.outcome_or_decision?.includes('?')

                  return (
                    <div
                      key={index}
                      className={`rounded-xl border transition-all ${
                        bottleneck
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-[#e8f4ff] bg-[#fafcff]'
                      }`}
                    >
                      {/* Step header — always visible */}
                      <button
                        className="w-full text-left p-4"
                        onClick={() => setExpandedStep(isExpanded ? null : index)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            {/* Step number badge */}
                            <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                              isDecision
                                ? 'bg-purple-100 text-purple-700'
                                : bottleneck
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-[#00528d] text-white'
                            }`}>
                              {step.number}
                            </span>
                            <div>
                              <p className={`text-sm font-semibold leading-snug ${
                                bottleneck ? 'text-red-700' : 'text-[#00528d]'
                              }`}>
                                {step.title}
                              </p>
                              {/* Always show action as a preview */}
                              {!isExpanded && step.action && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{step.action}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {bottleneck && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
                                ⚠ Bottleneck
                              </span>
                            )}
                            {isDecision && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                                Decision
                              </span>
                            )}
                            <span className="text-[#5a8aaa] text-xs">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-[#e8f4ff] pt-3">

                          {/* Action */}
                          {step.action && (
                            <div>
                              <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-1">Action</p>
                              <p className="text-sm text-gray-600">{step.action}</p>
                            </div>
                          )}

                          {/* Outcome or Decision */}
                          {step.outcome_or_decision && (
                            <div>
                              <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-1">
                                {isDecision ? 'Decision' : 'Outcome'}
                              </p>
                              <p className="text-sm text-gray-600">{step.outcome_or_decision}</p>
                            </div>
                          )}

                          {/* Happy / Unhappy paths side by side */}
                          <div className="flex gap-2">
                            {step.happy_path && (
                              <div className="flex-1 p-3 bg-[#e8f9f0] rounded-lg border border-[#b8edd0]">
                                <p className="text-xs font-semibold text-green-700 mb-1">
                                  ✓ {isDecision ? 'Yes Path' : 'Happy Path'}
                                </p>
                                <p className="text-xs text-green-800">{step.happy_path}</p>
                              </div>
                            )}
                            {step.unhappy_path && step.unhappy_path !== 'N/A' && (
                              <div className="flex-1 p-3 bg-[#fff4f4] rounded-lg border border-[#fdd0d0]">
                                <p className="text-xs font-semibold text-red-600 mb-1">
                                  ✗ {isDecision ? 'No Path' : 'Unhappy Path'}
                                </p>
                                <p className="text-xs text-red-700">{step.unhappy_path}</p>
                              </div>
                            )}
                          </div>

                          {/* Handoffs */}
                          {step.handoffs && step.handoffs !== 'None' && (
                            <div className="flex items-center gap-2 p-2 bg-[#f0f4ff] rounded-lg">
                              <span className="text-xs">🔁</span>
                              <p className="text-xs font-semibold text-[#00528d]">Handoff:</p>
                              <p className="text-xs text-gray-600">{step.handoffs}</p>
                            </div>
                          )}

                          {/* Bottleneck inline callout */}
                          {bottleneck && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                              <p className="text-xs font-semibold text-red-600 mb-1">⚠ Bottleneck Detected</p>
                              <p className="text-xs text-red-700 mb-2">{bottleneck.description}</p>
                              <div className="flex gap-3 text-xs text-red-500 mb-2">
                                <span>Mentions: <strong>{bottleneck.metrics?.transcript_mentions}</strong></span>
                                <span>Rework: <strong>{bottleneck.metrics?.rework_rate}</strong></span>
                                <span>Delays: <strong>{bottleneck.metrics?.times_delayed}</strong></span>
                              </div>
                              <ul className="space-y-1">
                                {bottleneck.suggestions?.map((s, i) => (
                                  <li key={i} className="text-xs text-red-700 flex gap-1">
                                    <span>→</span><span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── LUCID TAB ── */}
          {activeTab === 'lucid' && (
            <div>
              <h2 className="font-bold text-lg text-[#00528d] mb-1">Lucidchart Export</h2>
              <p className="text-sm text-gray-500 mb-4">
                Download the CSV and import it directly into Lucidchart to generate your swimlane diagram.
              </p>

              {/* Process snapshot */}
              {data?.lucid?.process_snapshot && (
                <div className="mb-5 p-4 bg-[#fafcff] rounded-xl border border-[#e8f4ff]">
                  <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-3">Process Snapshot</p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {data.lucid.process_snapshot.roles?.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Roles</p>
                        {data.lucid.process_snapshot.roles.map((r, i) => (
                          <p key={i} className="text-gray-600">• {r}</p>
                        ))}
                      </div>
                    )}
                    {data.lucid.process_snapshot.systems_tools?.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Systems / Tools</p>
                        {data.lucid.process_snapshot.systems_tools.map((t, i) => (
                          <p key={i} className="text-gray-600">• {t}</p>
                        ))}
                      </div>
                    )}
                    {data.lucid.process_snapshot.start_trigger && (
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Start Trigger</p>
                        <p className="text-gray-600">{data.lucid.process_snapshot.start_trigger}</p>
                      </div>
                    )}
                    {data.lucid.process_snapshot.end_state && (
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">End State</p>
                        <p className="text-gray-600">{data.lucid.process_snapshot.end_state}</p>
                      </div>
                    )}
                  </div>
                  {data.lucid.process_snapshot.loop_backs?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Loop-backs</p>
                      {data.lucid.process_snapshot.loop_backs.map((lb, i) => (
                        <p key={i} className="text-xs text-gray-600">↩ {lb}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lucid steps list */}
              <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-2">Steps</p>
              <div className="space-y-2 mb-5">
                {lucidSteps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex justify-between items-center p-3 rounded-xl border text-sm ${
                      step.flag
                        ? 'border-red-200 bg-red-50/40'
                        : 'border-[#e8f4ff] bg-[#fafcff]'
                    }`}
                  >
                    <div className="flex gap-3 items-center">
                      <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        step.flag ? 'bg-red-100 text-red-600' : 'bg-[#e8f4ff] text-[#00528d]'
                      }`}>
                        {step.number}
                      </span>
                      <div>
                        <p className={`font-medium text-sm ${step.flag ? 'text-red-700' : 'text-[#00528d]'}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-400">{step.owner}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      step.flag
                        ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {step.flag ? '⚠ Bottleneck' : '✓ Clear'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDownloadCSV}
                className="w-full py-3 bg-[#00528d] text-white rounded-xl font-medium text-sm hover:bg-[#003f6e] transition-colors"
              >
                ↓ Download Lucidchart CSV
              </button>
            </div>
          )}

          {/* ── BOTTLENECKS TAB ── */}
          {activeTab === 'bottlenecks' && (
            <div>
              <h2 className="font-bold text-lg text-[#00528d] mb-1">Bottleneck Analysis</h2>
              <p className="text-sm text-gray-500 mb-4">
                {bottlenecks.length === 0
                  ? 'No bottlenecks detected in this process.'
                  : `${bottlenecks.length} bottleneck${bottlenecks.length > 1 ? 's' : ''} identified across the workflow.`}
              </p>

              {bottlenecks.length === 0 && (
                <div className="p-6 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  ✓ This process looks clean — no bottlenecks found.
                </div>
              )}

              <div className="space-y-4">
                {bottlenecks.map((b, i) => (
                  <div key={i} className="border border-red-200 rounded-xl overflow-hidden">
                    {/* Bottleneck header */}
                    <div className="p-4 bg-red-50">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                            {b.type}
                          </span>
                          <p className="text-sm font-bold text-red-700 mt-0.5">
                            Step {b.step_number} — {b.step_title}
                          </p>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex gap-4 mt-2">
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{b.metrics?.transcript_mentions ?? '—'}</p>
                          <p className="text-xs text-red-400">Mentions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{b.metrics?.rework_rate ?? '—'}</p>
                          <p className="text-xs text-red-400">Rework Rate</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{b.metrics?.times_delayed ?? '—'}</p>
                          <p className="text-xs text-red-400">Times Delayed</p>
                        </div>
                      </div>
                    </div>

                    {/* Description + suggestions */}
                    <div className="p-4 space-y-3 bg-white">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why it's a bottleneck</p>
                        <p className="text-sm text-gray-600">{b.description}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Suggestions</p>
                        <ul className="space-y-2">
                          {b.suggestions?.map((s, si) => (
                            <li key={si} className="flex gap-2 text-sm text-gray-600">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#e8f4ff] text-[#00528d] text-xs flex items-center justify-center font-bold">
                                {si + 1}
                              </span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        className="mt-6 px-5 py-2 border border-[#b8dcf8] rounded-lg text-sm text-[#00528d] hover:bg-white transition-colors"
      >
        ← Start over
      </button>
    </div>
  )
}

export default Results
