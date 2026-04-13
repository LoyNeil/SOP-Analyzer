import React from 'react'
import { useState, useEffect } from 'react'
import Loader from './Loader'
import Results from './Results'
import { analyseTranscript } from './Analyse'

const UploadTranscript = () => {

    const [uploadedFile, setUploadedFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isAnalysing, setIsAnalysing] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const [error, setError] = useState('')
    const [resultsData, setResultsData] = useState(null)

    const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
        setUploadedFile(file)
        setError('')
        }
    }

    const handleAnalyse = async () => {
  if (!uploadedFile) {
    setError('Please upload a transcript first')
    return
  }

  try {
    setError('')
    setIsAnalysing(true)

    const data = await analyseTranscript(uploadedFile)

    setResultsData(data)
    setShowResults(true)

  } catch (err) {
    console.error(err)
    setError('Something went wrong while analysing the transcript')
  } finally {
    setIsAnalysing(false)
  }
}

    const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setUploadedFile(file)
    }

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)

    if (showResults) return (
      <Results 
        data={resultsData}
        onBack={() => {
          setShowResults(false)
          setUploadedFile(null)
        }} 
      />
    )

    if (isAnalysing) return <Loader onComplete={() => {}} />

  return (
        <div className="flex flex-col items-center bg-[#d9efff] min-h-screen m-2 rounded-3xl py-10 px-5">

      {/* Page heading */}
      <p className="font-bold text-2xl text-[#00528d] mb-1 tracking-tight">
        Process Creator and Analyzer
      </p>
      <p className="text-sm text-[#00528d]/55 mb-6">
        Turn your Zoom meetings into structured SOPs in seconds
      </p>

      {/* Step pills */}
      <div className="flex gap-2 mb-8">
        <span className="px-4 py-1 rounded-full text-xs font-medium bg-[#00528d] text-white border border-[#00528d]">1 · Upload</span>
        <span className="px-4 py-1 rounded-full text-xs font-medium bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">2 · Analyse</span>
        <span className="px-4 py-1 rounded-full text-xs font-medium bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">3 · Results</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-lg p-10 w-full max-w-lg text-center">

        {/* Icon */}
        <div className="w-14 h-14 bg-[#d9efff] rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 32 32" fill="none" stroke="#00528d" strokeWidth="1.6" strokeLinecap="round" width="26" height="26">
            <path d="M16 4v16M10 10l6-6 6 6"/><path d="M6 24v4h20v-4"/>
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-[#00528d] mb-1">Upload your transcript</h2>
        <p className="text-xs text-[#5a8aaa] leading-relaxed mb-6">
          Paste a Zoom transcript or upload a .vtt / .txt file and we'll extract
          the process, build your SOP, and flag anything worth looking at.
        </p>

        <input type="file" id="fileInput" accept=".vtt,.txt,.docx" className="hidden" onChange={handleFileChange} />

        {/* Dropzone */}
        <div
            onClick={() => document.getElementById('fileInput').click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200 mb-4
            ${isDragging ? 'border-[#00528d] bg-[#b8dcf8]': uploadedFile ? 'border-[#00528d] bg-[#f0faff]'
            : 'border-[#69c0ff] bg-[#d9efff] hover:bg-[#b8dcf8] hover:border-[#00528d]'}`}
        >
        <div className="flex flex-col items-center gap-2">
            {uploadedFile ? (
            <>
                <div className="w-11 h-11 rounded-full bg-[#00528d] flex items-center justify-center">
                <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="16" height="16">
                    <path d="M2 7l3 3 7-6"/>
                </svg>
                </div>
                <p className="text-sm font-semibold text-[#00528d]">{uploadedFile.name}</p>
                <p className="text-xs text-[#5a8aaa]">{(uploadedFile.size / 1024).toFixed(1)} KB · Click to replace</p>
                </>
                ) : (
                <>
                    <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
                    <svg viewBox="0 0 28 28" fill="none" stroke="#00528d" strokeWidth="1.5" strokeLinecap="round" width="20" height="20">
                        <rect x="4" y="6" width="20" height="16" rx="2"/>
                        <path d="M10 13l4-4 4 4M14 9v8"/>
                    </svg>
                    </div>
                    <p className="text-sm text-[#00528d] font-medium">
                    <u className="underline-offset-2">Click to upload</u> or drag and drop
                    </p>
                    <p className="text-xs text-[#5a8aaa]">.vtt, .txt, .docx — up to 10 MB</p>
            </>
                )}
        </div>
        </div>

        {/* Divider */}
        <div className="flex items-center mb-4 gap-2 text-xs text-[#5a8aaa]">
          <div className="flex-1 h-px bg-[#b8dcf8]"></div>
          Once uploaded please click on Analyse Transcript
          <div className="flex-1 h-px bg-[#b8dcf8]"></div>
        </div>

        {/* Error message */}
        {error && (
            <p className="text-xs text-[#c0501a] bg-[#fff0eb] border border-[#ffb38a] px-3 py-2 rounded-lg mt-4 text-left">
                ⚠  {error}
            </p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-10">
          <button onClick={() => setUploadedFile(null)} className="px-5 py-2 text-sm font-medium text-[#00528d] bg-white border-[1.5px] border-[#b8dcf8] rounded-lg hover:bg-[#d9efff] hover:border-[#69c0ff] transition-all duration-200 cursor-pointer">
            Clear
          </button>
          <button onClick={handleAnalyse} disabled={isAnalysing} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#00528d] rounded-lg hover:bg-[#003f6b] transition-all duration-200 cursor-pointer">
            <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" width="13" height="13">
              <path d="M3 7l3 3 5-5"/>
            </svg>
            Analyse Transcript
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadTranscript
