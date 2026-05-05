import React from 'react'
import { useState } from 'react'
import Loader from './Loader'
import Results from './Results'
import { analyseTranscript, analyseSopDocument } from './Analyse'

// ─────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────

const getInputType = (file) => {
  if (!file) return null
  const name = file.name.toLowerCase()
  if (name.endsWith('.vtt') || name.endsWith('.txt')) return 'transcript'
  if (name.endsWith('.docx') || name.endsWith('.pdf'))  return 'sop'
  return 'transcript' // fallback
}

const INPUT_TYPE_META = {
  transcript: {
    label:    'Zoom transcript',
    sublabel: '.vtt or .txt',
    icon:     '🎙',
    color:    '#00528d',
    bg:       '#d9efff',
  },
  sop: {
    label:    'SOP document',
    sublabel: '.docx or .pdf',
    icon:     '📄',
    color:    '#6d28d9',
    bg:       '#f3e8ff',
  },
}

// ─────────────────────────────────────────
//  Intent chip (what do you want from it?)
// ─────────────────────────────────────────

const INTENTS = [
  {
    key:   'restructure',
    label: 'Restructure SOP',
    desc:  'Map into our step-by-step schema — exact wording preserved',
    icon:  '⚙',
  },
  {
    key:   'diagram',
    label: 'Process map',
    desc:  'Generate a swimlane diagram from the SOP roles & steps',
    icon:  '⬡',
  },
  {
    key:   'bottlenecks',
    label: 'Bottleneck analysis',
    desc:  'Scan for structural gaps, missing SLAs, ambiguous ownership',
    icon:  '⚠',
  },
]

const IntentSelector = ({ selected, onChange }) => (
  <div className="space-y-2 mt-5">
    <p className="text-xs font-semibold text-[#00528d] uppercase tracking-wide mb-2">
      What would you like to do with this SOP?
    </p>
    {INTENTS.map(intent => {
      const active = selected.includes(intent.key)
      return (
        <button
          key={intent.key}
          onClick={() =>
            onChange(
              active
                ? selected.filter(k => k !== intent.key)
                : [...selected, intent.key]
            )
          }
          className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer
            ${active
              ? 'border-[#00528d] bg-[#e5edf3]'
              : 'border-[#b8dcf8] bg-white hover:bg-[#d9efff] hover:border-[#00528d]'
            }`}
        >
          <span
            className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 transition-all
              ${active ? 'bg-[#00528d] text-white' : 'bg-[#d9efff] text-[#00528d]'}`}
          >
            {intent.icon}
          </span>
          <span className="flex-1">
            <span className={`block text-sm font-semibold ${active ? 'text-[#6d28d9]' : 'text-[#374151]'}`}>
              {intent.label}
            </span>
            <span className="block text-xs text-[#6b7280] mt-0.5">{intent.desc}</span>
          </span>
          <span className={`mt-1 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
            ${active ? 'border-[#6d28d9] bg-[#6d28d9]' : 'border-gray-300'}`}
          >
            {active && (
              <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
        </button>
      )
    })}
  </div>
)

// ─────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────

const UploadTranscript = () => {
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isDragging, setIsDragging]     = useState(false)
  const [isAnalysing, setIsAnalysing]   = useState(false)
  const [showResults, setShowResults]   = useState(false)
  const [error, setError]               = useState('')
  const [resultsData, setResultsData]   = useState(null)
  const [apiPromise, setApiPromise]     = useState(null)

  // SOP-specific state
  const [inputType, setInputType]       = useState(null)      // 'transcript' | 'sop'
  const [selectedIntents, setSelectedIntents] = useState(['restructure', 'diagram', 'bottlenecks'])

  const handleFileChange = (file) => {
    if (!file) return
    setUploadedFile(file)
    setError('')
    setInputType(getInputType(file))
    // Default: all intents selected for SOP, none needed for transcript
    setSelectedIntents(['restructure', 'diagram', 'bottlenecks'])
  }

  const handleAnalyse = async () => {
    if (!uploadedFile) {
      setError('Please upload a file first')
      return
    }

    // Derive route from file extension directly — don't rely solely on inputType
    // state which may still be null if React hasn't flushed the setState yet
    const detectedType = inputType || getInputType(uploadedFile)

    if (detectedType === 'sop' && selectedIntents.length === 0) {
      setError('Please select at least one output to generate')
      return
    }

    setError('')
    setIsAnalysing(true)

    // Build the promise — errors are handled inside so the Loader
    // always gets a resolved promise (it checks resultsData, not the value)
    let promise

    if (detectedType === 'sop') {
      promise = analyseSopDocument(uploadedFile, selectedIntents)
        .then(data => {
          setResultsData(data)
          return data
        })
        .catch(err => {
          console.error('SOP analysis error:', err)
          // Show the actual server message if available, fallback to generic
          const msg = err?.message || 'Something went wrong while processing the SOP document'
          setError(msg)
          setIsAnalysing(false)
          return null   // resolve to null so Loader doesn't hang
        })
    } else {
      promise = analyseTranscript(uploadedFile)
        .then(data => {
          setResultsData(data)
          return data
        })
        .catch(err => {
          console.error('Transcript analysis error:', err)
          const msg = err?.message || 'Something went wrong while analysing the transcript'
          setError(msg)
          setIsAnalysing(false)
          return null
        })
    }

    setApiPromise(promise)
  }

  const handleLoaderComplete = () => {
    setIsAnalysing(false)
    // Only navigate to results if we actually have data —
    // if the API call failed, resultsData is still null and
    // the error message is already shown on the upload screen
    if (resultsData) {
      setShowResults(true)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileChange(file)
  }

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  if (showResults) return (
    <Results
      data={resultsData}
      inputType={inputType}
      selectedIntents={selectedIntents}
      onBack={() => {
        setShowResults(false)
        setUploadedFile(null)
        setInputType(null)
      }}
    />
  )

  if (isAnalysing) return (
    <Loader
      apiPromise={apiPromise}
      onComplete={handleLoaderComplete}
    />
  )

  const isSop        = inputType === 'sop'
  const accentColor  = isSop ? '#6d28d9' : '#00528d'
  const accentBg     = isSop ? '#d9efff' : '#d9efff'   // page bg stays the same
  const pillActive   = isSop ? 'bg-[#6d28d9]' : 'bg-[#00528d]'

  return (
    <div className="flex flex-col items-center bg-[#d9efff] min-h-screen m-2 rounded-3xl py-10 px-5">

      {/* Page heading */}
      <p className="font-bold text-2xl text-[#00528d] mb-1 tracking-tight">
        Process Creator and Analyzer
      </p>
      <p className="text-sm text-[#00528d]/55 mb-6">
        Turn your Zoom meetings or SOP documents into structured process assets
      </p>

      {/* Step pills */}
      <div className="flex gap-2 mb-8">
        <span className={`px-4 py-1 rounded-full text-xs font-medium text-white border ${pillActive} border-[#00528d]`}>1 · Upload</span>
        <span className="px-4 py-1 rounded-full text-xs font-medium bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">2 · Analyse</span>
        <span className="px-4 py-1 rounded-full text-xs font-medium bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">3 · Results</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-lg p-10 w-full max-w-lg text-center">

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-all duration-300"
          style={{ background: isSop ? '#f3e8ff' : '#d9efff' }}
        >
          {isSop ? (
            <svg viewBox="0 0 32 32" fill="none" stroke="#6d28d9" strokeWidth="1.6" strokeLinecap="round" width="26" height="26">
              <rect x="6" y="3" width="20" height="26" rx="2"/>
              <path d="M10 10h12M10 15h12M10 20h7"/>
            </svg>
          ) : (
            <svg viewBox="0 0 32 32" fill="none" stroke="#00528d" strokeWidth="1.6" strokeLinecap="round" width="26" height="26">
              <path d="M16 4v16M10 10l6-6 6 6"/><path d="M6 24v4h20v-4"/>
            </svg>
          )}
        </div>

        <h2
          className="text-xl font-semibold mb-1 transition-colors duration-300"
          style={{ color: accentColor }}
        >
          {isSop ? 'Upload your SOP document' : 'Upload your transcript'}
        </h2>
        <p className="text-xs text-[#5a8aaa] leading-relaxed mb-6">
          {isSop
            ? "Upload a .docx or .pdf SOP and we'll restructure it, build a process map, and surface any gaps."
            : "Paste a Zoom transcript or upload a .vtt / .txt file and we'll extract the process, build your SOP, and flag anything worth looking at."
          }
        </p>

        <input
          type="file"
          id="fileInput"
          accept=".vtt,.txt,.docx,.pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files[0]
            if (file) handleFileChange(file)
          }}
        />

        {/* Dropzone */}
        <div
          onClick={() => document.getElementById('fileInput').click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200 mb-4
            ${isDragging
              ? 'border-[#6d28d9] bg-[#f3e8ff]'
              : uploadedFile
                ? `bg-[#f0faff]`
                : 'border-[#69c0ff] bg-[#d9efff] hover:bg-[#b8dcf8] hover:border-[#00528d]'
            }`}
          style={
            uploadedFile
              ? { borderColor: accentColor }
              : {}
          }
        >
          <div className="flex flex-col items-center gap-2">
            {uploadedFile ? (
              <>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: accentColor }}
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="16" height="16">
                    <path d="M2 7l3 3 7-6"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{ color: accentColor }}>{uploadedFile.name}</p>
                <p className="text-xs text-[#5a8aaa]">{(uploadedFile.size / 1024).toFixed(1)} KB · Click to replace</p>

                {/* Input type badge */}
                {inputType && (
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full mt-1"
                    style={{
                      background: isSop ? '#f3e8ff' : '#d9efff',
                      color: accentColor
                    }}
                  >
                    {INPUT_TYPE_META[inputType].icon} Detected as {INPUT_TYPE_META[inputType].label}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 28 28" fill="none" stroke="#00528d" strokeWidth="1.5" strokeLinecap="round" width="20" height="20">
                    <rect x="4" y="6" width="20" height="16" rx="2"/>
                    <path d="M10 13l4-4 4 4M14 9v8"/>
                  </svg>
                </div>
                <p className="text-sm text-[#00528d] font-medium">
                  <u className="underline-offset-2">Click to upload</u> or drag and drop
                </p>
                <p className="text-xs text-[#5a8aaa]">.vtt · .txt · .docx · .pdf — up to 10 MB</p>
              </>
            )}
          </div>
        </div>

        {/* ── SOP intent selector (only shown when inputType === 'sop') ── */}
        {isSop && (
          <IntentSelector
            selected={selectedIntents}
            onChange={setSelectedIntents}
          />
        )}

        {/* Divider */}
        {!isSop && (
          <div className="flex items-center mb-4 gap-2 text-xs text-[#5a8aaa]">
            <div className="flex-1 h-px bg-[#b8dcf8]"></div>
            Once uploaded please click on Analyse
            <div className="flex-1 h-px bg-[#b8dcf8]"></div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-[#c0501a] bg-[#fff0eb] border border-[#ffb38a] px-3 py-2 rounded-lg mt-4 text-left">
            ⚠  {error}
          </p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => {
              setUploadedFile(null)
              setInputType(null)
              setError('')
              setSelectedIntents(['restructure', 'diagram', 'bottlenecks'])
            }}
            className="px-5 py-2 text-sm font-medium text-[#00528d] bg-white border-[1.5px] border-[#b8dcf8] rounded-lg hover:bg-[#d9efff] hover:border-[#69c0ff] transition-all duration-200 cursor-pointer"
          >
            Clear
          </button>
          <button
            onClick={handleAnalyse}
            disabled={isAnalysing}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 cursor-pointer"
            style={{ background: isAnalysing ? '#aaa' : accentColor }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="13" height="13">
              <path d="M3 7l3 3 5-5"/>
            </svg>
            {isSop ? 'Process SOP' : 'Analyse Transcript'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadTranscript
