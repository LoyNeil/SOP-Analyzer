import React, { useState, useRef, useEffect } from 'react'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  ShadingType, TableRow, TableCell, Table, WidthType,
  convertInchesToTwip
} from 'docx'
import SwimlaneDiagram from './Swimlanediagram'


const Collapse = ({ open, children }) => {
  const ref = useRef(null)
  const [height, setHeight] = useState(open ? 'auto' : '0px')
  const [overflow, setOverflow] = useState(open ? 'visible' : 'hidden')

  useEffect(() => {
    if (!ref.current) return
    if (open) {
      setHeight(`${ref.current.scrollHeight}px`)
      setOverflow('hidden')
      const t = setTimeout(() => { setHeight('auto'); setOverflow('visible') }, 300)
      return () => clearTimeout(t)
    } else {
      setHeight(`${ref.current.scrollHeight}px`)
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight('0px')))
      setOverflow('hidden')
    }
  }, [open])

  return (
    <div ref={ref} style={{ height, overflow, transition: 'height 0.3s ease' }}>
      {children}
    </div>
  )
}

const getSeverity = (b) => {
  const mentions = Number(b.metrics?.transcript_mentions) || 0
  const rework   = parseFloat(b.metrics?.rework_rate)     || 0
  const delayed  = Number(b.metrics?.times_delayed)       || 0
  const score    = mentions + rework * 10 + delayed
  if (score >= 15) return { label: 'High',   bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    }
  if (score >= 7)  return { label: 'Medium', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' }
  return               { label: 'Low',    bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' }
}

const StepIcon = ({ isDecision, isHandoff, bottleneck }) => {
  if (isDecision) return <span title="Decision">⟠</span>
  if (isHandoff)  return <span title="Handoff">⇄</span>
  if (bottleneck) return <span title="Bottleneck">⚠</span>
  return <span title="Process">▶</span>
}

const EditableField = ({ value, onChange, multiline = true, className = '', placeholder = '' }) => {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return multiline ? (
      <textarea
        autoFocus
        className={`border border-[#b8dcf8] rounded-lg p-2 w-full outline-none resize-none bg-[#fafcff] text-sm text-gray-600 ${className}`}
        value={value || ''}
        rows={3}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
      />
    ) : (
      <input
        autoFocus
        className={`border-b border-[#00528d] bg-transparent outline-none w-full text-sm font-semibold text-[#00528d] ${className}`}
        value={value || ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
      />
    )
  }

  return (
    <span className="group flex items-start gap-1 cursor-default">
      <span className={className}>{value || <span className="text-gray-300 italic">{placeholder}</span>}</span>
      <span
        className="opacity-0 group-hover:opacity-100 text-xs text-[#5a8aaa] cursor-pointer shrink-0 transition-opacity mt-0.5"
        onClick={() => setEditing(true)}
        title="Edit"
      >✎</span>
    </span>
  )
}

// ─── CHANGE 1: accept inputType + selectedIntents props with safe defaults ───
const Results = ({ data, onBack, inputType = 'transcript', selectedIntents = ['restructure', 'diagram', 'bottlenecks'] }) => {
  const [activeTab, setActiveTab]       = useState('sop')
  const [copied, setCopied]             = useState(false)
  const [expandedStep, setExpandedStep] = useState(null)
  const [allExpanded, setAllExpanded]   = useState(false)
  const [editedSteps, setEditedSteps]   = useState({})
  const [docxLoading, setDocxLoading]   = useState(false)
  const stepRefs = useRef({})

  if (!data) return <div className="p-10 text-center">Loading results...</div>

  const lucidSteps  = data?.lucid?.steps || []
  const bottlenecks = data?.bottlenecks  || []
  const sopSteps    = data?.sop?.steps   || []

  const getBottleneckForStep = (stepNumber) =>
    bottlenecks.find(b =>
      String(b.step_number) === String(stepNumber).padStart(2, '0') ||
      String(b.step_number) === String(stepNumber)
    )

  const getVal = (index, field, original) => editedSteps[index]?.[field] ?? original

  const handleEdit = (index, field, value) =>
    setEditedSteps(prev => ({ ...prev, [index]: { ...prev[index], [field]: value } }))

  const toggleAll = () => {
    if (allExpanded) { setExpandedStep(null); setAllExpanded(false) }
    else             { setExpandedStep('all'); setAllExpanded(true)  }
  }
  const isStepExpanded = (index) => allExpanded || expandedStep === index

  const scrollToStep = (index) => {
    setExpandedStep(index); setAllExpanded(false)
    setTimeout(() => stepRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const handleDownloadDocx = async () => {
    setDocxLoading(true)
    try {
      const sopData  = data?.sop
      const children = []

      children.push(new Paragraph({
        text: sopData?.title || 'Standard Operating Procedure',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }))

      if (sopData?.version || sopData?.date) {
        children.push(new Paragraph({
          children: [
            sopData?.version ? new TextRun({ text: `Version: ${sopData.version}   `, bold: true, color: '00528d' }) : new TextRun(''),
            sopData?.date    ? new TextRun({ text: `Date: ${sopData.date}`, color: '00528d' })                      : new TextRun(''),
          ],
          spacing: { after: 200 },
        }))
      }

      if (sopData?.purpose) {
        children.push(new Paragraph({ text: 'PURPOSE', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }))
        children.push(new Paragraph({ text: sopData.purpose, spacing: { after: 200 } }))
      }

      if (sopData?.scope) {
        children.push(new Paragraph({ text: 'SCOPE', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }))
        children.push(new Paragraph({ text: sopData.scope, spacing: { after: 200 } }))
      }

      if (sopData?.roles?.length > 0) {
        children.push(new Paragraph({ text: 'ROLES & RESPONSIBILITIES', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }))
        sopData.roles.forEach(role => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${role.name}: `, bold: true, color: '00528d' }),
              new TextRun({ text: role.responsibility }),
            ],
            spacing: { after: 100 },
            indent: { left: convertInchesToTwip(0.25) },
          }))
        })
        children.push(new Paragraph({ spacing: { after: 100 } }))
      }

      if (sopData?.prerequisites?.length > 0) {
        children.push(new Paragraph({ text: 'PREREQUISITES', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }))
        sopData.prerequisites.forEach(p => {
          children.push(new Paragraph({
            text: `• ${p}`,
            spacing: { after: 80 },
            indent: { left: convertInchesToTwip(0.25) },
          }))
        })
        children.push(new Paragraph({ spacing: { after: 100 } }))
      }

      if (sopData?.start_state || sopData?.end_state) {
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'Start State', bold: true, color: '15803d' })], spacing: { after: 60 } }),
                  new Paragraph({ text: sopData.start_state || '', spacing: { after: 0 } }),
                ],
                shading: { type: ShadingType.SOLID, color: 'e8f9f0' },
                margins: { top: 100, bottom: 100, left: 150, right: 150 },
              }),
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'End State', bold: true, color: 'c2410c' })], spacing: { after: 60 } }),
                  new Paragraph({ text: sopData.end_state || '', spacing: { after: 0 } }),
                ],
                shading: { type: ShadingType.SOLID, color: 'fff4e8' },
                margins: { top: 100, bottom: 100, left: 150, right: 150 },
              }),
            ],
          })],
        }))
        children.push(new Paragraph({ spacing: { after: 200 } }))
      }

      children.push(new Paragraph({ text: 'STEP-BY-STEP WORKFLOW', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }))

      sopSteps.forEach((step, index) => {
        const isDecision = step.title?.toLowerCase().includes('yes/no') || step.outcome_or_decision?.includes('?')
        const title             = getVal(index, 'title',              step.title)
        const action            = getVal(index, 'action',             step.action)
        const outcome           = getVal(index, 'outcome_or_decision',step.outcome_or_decision)
        const happyPath         = getVal(index, 'happy_path',         step.happy_path)
        const unhappyPath       = getVal(index, 'unhappy_path',       step.unhappy_path)
        const handoffs          = getVal(index, 'handoffs',           step.handoffs)
        const stepColor         = isDecision ? '7c3aed' : '00528d'

        children.push(new Paragraph({
          children: [
            new TextRun({ text: `Step ${step.number}  `, bold: true, color: '00528d', size: 24 }),
            new TextRun({ text: title, bold: true, color: stepColor, size: 24 }),
            isDecision ? new TextRun({ text: '  [Decision]', color: '7c3aed', italics: true }) : new TextRun(''),
          ],
          spacing: { before: 200, after: 100 },
          shading: { type: ShadingType.SOLID, color: 'f0f7ff' },
        }))

        if (action) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: 'Action: ', bold: true, color: '00528d' }),
              new TextRun({ text: action }),
            ],
            spacing: { after: 80 },
            indent: { left: convertInchesToTwip(0.25) },
          }))
        }

        if (outcome) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${isDecision ? 'Decision' : 'Outcome'}: `, bold: true, color: '00528d' }),
              new TextRun({ text: outcome }),
            ],
            spacing: { after: 80 },
            indent: { left: convertInchesToTwip(0.25) },
          }))
        }

        if (happyPath || (unhappyPath && unhappyPath !== 'N/A')) {
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({
              children: [
                happyPath ? new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: `✓ ${isDecision ? 'Yes Path' : 'Happy Path'}`, bold: true, color: '15803d' })], spacing: { after: 60 } }),
                    new Paragraph({ children: [new TextRun({ text: happyPath, color: '166534' })], spacing: { after: 0 } }),
                  ],
                  shading: { type: ShadingType.SOLID, color: 'e8f9f0' },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                }) : new TableCell({ children: [new Paragraph({ text: '' })] }),

                (unhappyPath && unhappyPath !== 'N/A') ? new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: `✗ ${isDecision ? 'No Path' : 'Unhappy Path'}`, bold: true, color: 'b45309' })], spacing: { after: 60 } }),
                    new Paragraph({ children: [new TextRun({ text: unhappyPath, color: '92400e' })], spacing: { after: 0 } }),
                  ],
                  shading: { type: ShadingType.SOLID, color: 'fffbeb' },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                }) : new TableCell({ children: [new Paragraph({ text: '' })] }),
              ],
            })],
          }))
        }

        if (handoffs && handoffs !== 'None') {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: 'Handoff: ', bold: true, color: '00528d' }),
              new TextRun({ text: handoffs }),
            ],
            spacing: { before: 80, after: 80 },
            indent: { left: convertInchesToTwip(0.25) },
            shading: { type: ShadingType.SOLID, color: 'f0f4ff' },
          }))
        }

        children.push(new Paragraph({ spacing: { after: 120 } }))
      })

      const doc = new Document({
        styles: {
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', run: { color: '00528d', size: 36, bold: true } },
            { id: 'Heading2', name: 'Heading 2', run: { color: '00528d', size: 24, bold: true }, paragraph: { spacing: { before: 200, after: 100 } } },
          ],
        },
        sections: [{ properties: {}, children }],
      })

      const blob = await Packer.toBlob(doc)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'sop-document.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('DOCX generation failed:', err)
      alert('Could not generate .docx — please try the Copy button and paste into Word instead.')
    }
    setDocxLoading(false)
  }

  const handleCopy = () => {
    if (activeTab !== 'sop') {
      const content = document.getElementById('active-content')
      navigator.clipboard.writeText(content.innerText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      return
    }

    const sopData  = data?.sop

    const stepsHTML = sopSteps.map((step, index) => {
      const bottleneck  = getBottleneckForStep(step.number)
      const isDecision  = step.title?.toLowerCase().includes('yes/no') || step.outcome_or_decision?.includes('?')
      const title       = getVal(index, 'title',               step.title)
      const action      = getVal(index, 'action',              step.action)
      const outcome     = getVal(index, 'outcome_or_decision', step.outcome_or_decision)
      const happyPath   = getVal(index, 'happy_path',          step.happy_path)
      const unhappyPath = getVal(index, 'unhappy_path',        step.unhappy_path)
      const handoffs    = getVal(index, 'handoffs',            step.handoffs)

      return `
        <div style="border:1px solid ${bottleneck ? '#fdd0d0' : '#e8f4ff'};
                    background-color:${bottleneck ? '#fff4f4' : '#fafcff'};
                    border-radius:8px; padding:14px 16px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="display:inline-flex; align-items:center; justify-content:center;
                         width:26px; height:26px; border-radius:50%; font-size:12px; font-weight:700;
                         background-color:${isDecision ? '#f3e8ff' : bottleneck ? '#fee2e2' : '#00528d'};
                         color:${isDecision ? '#7c3aed' : bottleneck ? '#b91c1c' : '#fff'};">
              ${step.number}
            </span>
            <strong style="font-size:14px; color:${bottleneck ? '#b91c1c' : '#00528d'};">${title}</strong>
            ${bottleneck  ? `<span style="font-size:11px;background-color:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:20px;margin-left:6px;">&#9888; Bottleneck</span>` : ''}
            ${isDecision  ? `<span style="font-size:11px;background-color:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:20px;margin-left:6px;">Decision</span>` : ''}
          </div>
          ${action ? `<p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 3px;">Action</p><p style="font-size:13px;color:#444;margin:0 0 8px;">${action}</p>` : ''}
          ${outcome ? `<p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 3px;">${isDecision ? 'Decision' : 'Outcome'}</p><p style="font-size:13px;color:#444;margin:0 0 8px;">${outcome}</p>` : ''}
          ${(happyPath || (unhappyPath && unhappyPath !== 'N/A')) ? `
            <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-top:8px;">
              <tr>
                ${happyPath ? `<td style="width:50%;padding:10px 12px;background-color:#e8f9f0;border:1px solid #b8edd0;border-radius:6px;vertical-align:top;">
                  <p style="font-size:11px;font-weight:700;color:#15803d;margin:0 0 4px;">&#10003; ${isDecision ? 'Yes Path' : 'Happy Path'}</p>
                  <p style="font-size:12px;color:#166534;margin:0;">${happyPath}</p></td>` : '<td></td>'}
                ${(unhappyPath && unhappyPath !== 'N/A') ? `<td style="width:50%;padding:10px 12px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:6px;vertical-align:top;">
                  <p style="font-size:11px;font-weight:700;color:#b45309;margin:0 0 4px;">&#10007; ${isDecision ? 'No Path' : 'Unhappy Path'}</p>
                  <p style="font-size:12px;color:#92400e;margin:0;">${unhappyPath}</p></td>` : '<td></td>'}
              </tr>
            </table>` : ''}
          ${(handoffs && handoffs !== 'None') ? `
            <div style="display:flex;gap:8px;align-items:center;background-color:#f0f4ff;border-radius:6px;padding:6px 10px;margin-top:8px;">
              <span>&#128260;</span>
              <span style="font-size:11px;font-weight:700;color:#00528d;">Handoff:</span>
              <span style="font-size:12px;color:#555;">${handoffs}</span>
            </div>` : ''}
        </div>`
    }).join('')

    const fullHTML = `
      <html><head><meta charset="utf-8"></head>
      <body style="font-family:Calibri,sans-serif;color:#222;max-width:800px;padding:20px;">
        <h1 style="color:#00528d;font-size:22px;margin-bottom:4px;">${sopData?.title || 'Standard Operating Procedure'}</h1>
        <div style="margin-bottom:16px;">
          ${sopData?.version ? `<span style="font-size:11px;background-color:#e8f4ff;color:#00528d;padding:2px 8px;border-radius:20px;margin-right:4px;">v${sopData.version}</span>` : ''}
          ${sopData?.date    ? `<span style="font-size:11px;background-color:#e8f4ff;color:#00528d;padding:2px 8px;border-radius:20px;margin-right:4px;">${sopData.date}</span>` : ''}
        </div>
        ${sopData?.purpose ? `<p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Purpose</p><p style="font-size:13px;color:#555;margin-bottom:16px;">${sopData.purpose}</p>` : ''}
        ${sopData?.scope   ? `<p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Scope</p><p style="font-size:13px;color:#555;margin-bottom:16px;">${sopData.scope}</p>` : ''}
        ${sopData?.roles?.length > 0 ? `
          <p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Roles &amp; Responsibilities</p>
          ${sopData.roles.map(r => `<div style="background-color:#fafcff;border:1px solid #e8f4ff;border-radius:6px;padding:8px 12px;margin-bottom:6px;">
            <p style="font-size:13px;font-weight:700;color:#00528d;margin:0 0 2px;">${r.name}</p>
            <p style="font-size:12px;color:#666;margin:0;">${r.responsibility}</p></div>`).join('')}` : ''}
        ${sopData?.prerequisites?.length > 0 ? `
          <p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 8px;">Prerequisites</p>
          ${sopData.prerequisites.map(p => `<p style="font-size:13px;color:#555;margin:2px 0;">&#8226; ${p}</p>`).join('')}` : ''}
        ${(sopData?.start_state || sopData?.end_state) ? `
          <table style="width:100%;border-collapse:separate;border-spacing:12px 0;margin:16px 0;"><tr>
            ${sopData.start_state ? `<td style="width:50%;padding:10px 14px;background-color:#e8f9f0;border:1px solid #b8edd0;border-radius:8px;vertical-align:top;">
              <p style="font-size:11px;font-weight:700;color:#15803d;margin:0 0 4px;">Start State</p>
              <p style="font-size:12px;color:#166534;margin:0;">${sopData.start_state}</p></td>` : '<td></td>'}
            ${sopData.end_state ? `<td style="width:50%;padding:10px 14px;background-color:#fff4e8;border:1px solid #fdd9a8;border-radius:8px;vertical-align:top;">
              <p style="font-size:11px;font-weight:700;color:#c2410c;margin:0 0 4px;">End State</p>
              <p style="font-size:12px;color:#9a3412;margin:0;">${sopData.end_state}</p></td>` : '<td></td>'}
          </tr></table>` : ''}
        <p style="font-size:11px;font-weight:700;color:#00528d;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 12px;">Step-by-Step Workflow</p>
        ${stepsHTML}
      </body></html>`

    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([fullHTML], { type: 'text/html' })
      const textBlob = new Blob([document.getElementById('active-content').innerText], { type: 'text/plain' })
      navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
        .catch(() => { navigator.clipboard.writeText(document.getElementById('active-content').innerText); setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      navigator.clipboard.writeText(document.getElementById('active-content').innerText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadCSV = () => {
    const csvContent = data?.lucid?.csv || data?.csv || ''
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url  = window.URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'process.csv'; a.click()
  }

  // ─── CHANGE 2: filter tabs based on inputType + selectedIntents ───
  const tabVisibility = {
    sop:         inputType === 'transcript' || selectedIntents.includes('restructure'),
    lucid:       inputType === 'transcript' || selectedIntents.includes('diagram'),
    bottlenecks: inputType === 'transcript' || selectedIntents.includes('bottlenecks'),
  }

  const allTabs = [
    { key: 'sop',         label: 'SOP Document' },
    { key: 'lucid',       label: 'Diagram' },
    { key: 'bottlenecks', label: `Bottlenecks${bottlenecks.length > 0 ? ` (${bottlenecks.length})` : ''}` },
  ]

  const visibleTabs = allTabs.filter(t => tabVisibility[t.key])

  return (
    <div className="flex flex-col items-center bg-[#d9efff] min-h-screen m-2 rounded-3xl py-10 px-5 md:px-10 lg:px-16">

      <p className="font-bold text-2xl md:text-3xl text-[#00528d] mb-1 tracking-tight">Process Creator and Analyzer</p>

      {/* ─── CHANGE 3: subtitle reflects source type ─── */}
      <p className="text-sm md:text-base text-[#00528d]/55 mb-6">
        {inputType === 'sop'
          ? 'SOP restructured — original wording preserved'
          : 'Your SOP is ready — review and copy below'}
      </p>

      <div className="flex gap-2 mb-8">
        <span className="px-4 py-1 rounded-full text-xs md:text-sm bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">1 · Upload</span>
        <span className="px-4 py-1 rounded-full text-xs md:text-sm bg-white text-[#00528d] border border-[#b8dcf8] opacity-50">2 · Analyse</span>
        <span className="px-4 py-1 rounded-full text-xs md:text-sm bg-[#00528d] text-white border border-[#00528d]">3 · Results</span>
      </div>

      <div className="bg-white rounded-3xl shadow-lg w-full max-w-2xl md:max-w-3xl lg:max-w-5xl overflow-hidden">

        {/* ─── CHANGE 2 continued: render only visible tabs ─── */}
        <div className="flex border-b-2 border-[#d9efff] px-5 md:px-8">
          {visibleTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 md:px-6 py-3 text-sm md:text-base font-medium border-b-2 transition-all
                ${activeTab === tab.key ? 'text-[#00528d] border-[#00528d]' : 'text-[#5a8aaa] border-transparent'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center px-5 md:px-8 py-3 border-b bg-[#fafcff] flex-wrap gap-2">
          {/* ─── CHANGE 4: toolbar subtitle reflects source type ─── */}
          <span className="text-xs md:text-sm text-[#5a8aaa]">
            {inputType === 'sop' ? 'Restructured from document' : 'Generated from transcript'}
            {' · '}{sopSteps.length} steps
          </span>
          <div className="flex gap-3 items-center">
            {activeTab === 'sop' && (
              <button onClick={toggleAll}
                className="text-xs md:text-sm text-[#5a8aaa] font-medium border border-[#d9efff] px-3 py-1 rounded-lg hover:bg-[#e8f4ff] transition-colors">
                {allExpanded ? 'Collapse All ▲' : 'Expand All ▼'}
              </button>
            )}
            <button onClick={handleDownloadDocx} disabled={docxLoading}
              className="text-xs md:text-sm text-[#00528d] font-medium border border-[#b8dcf8] px-3 py-1 rounded-lg hover:bg-[#e8f4ff] transition-colors disabled:opacity-50">
              {docxLoading ? 'Generating…' : '↓ Word'}
            </button>
            <button onClick={handleCopy} className="text-sm md:text-base text-[#00528d] font-medium">
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/*SOP TAB*/}
        {activeTab === 'sop' && (
          <div className="flex lg:flex-row flex-col">

            {/* Step sidebar */}
            {sopSteps.length > 0 && (
              <div className="hidden lg:flex flex-col w-48 shrink-0 border-r border-[#e8f4ff] py-4 px-3 max-h-[75vh] overflow-y-auto bg-[#fafcff]">
                <p className="text-xs font-semibold text-[#5a8aaa] uppercase tracking-wide mb-3 px-1">Steps</p>
                {sopSteps.map((step, index) => {
                  const bottleneck = getBottleneckForStep(step.number)
                  const isDecision = step.title?.toLowerCase().includes('yes/no') || step.outcome_or_decision?.includes('?')
                  const active     = isStepExpanded(index)
                  return (
                    <button key={index} onClick={() => scrollToStep(index)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left mb-1 transition-all text-xs
                        ${active ? 'bg-[#e8f4ff] text-[#00528d] font-semibold' : 'text-[#5a8aaa] hover:bg-[#f0f8ff]'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                        ${isDecision ? 'bg-purple-100 text-purple-700' : bottleneck ? 'bg-red-100 text-red-600' : 'bg-[#00528d] text-white'}`}>
                        {step.number}
                      </span>
                      <span className="truncate leading-snug">{getVal(index, 'title', step.title)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Main SOP content */}
            <div id="active-content" className="flex-1 p-6 md:p-8 max-h-[600px] md:max-h-[700px] lg:max-h-[75vh] overflow-y-auto">

              <h2 className="font-bold text-lg md:text-xl text-[#00528d] mb-1">{data?.sop?.title || 'Standard Operating Procedure'}</h2>

              <div className="flex gap-3 mb-4 flex-wrap">
                {data?.sop?.version && <span className="text-xs md:text-sm px-2 py-0.5 bg-[#e8f4ff] text-[#00528d] rounded-full">v{data.sop.version}</span>}
                {data?.sop?.date    && <span className="text-xs md:text-sm px-2 py-0.5 bg-[#e8f4ff] text-[#00528d] rounded-full">{data.sop.date}</span>}
                {data?.sop?.tags?.map((tag, i) => (
                  <span key={i} className="text-xs md:text-sm px-2 py-0.5 bg-[#f0f9ff] text-[#5a8aaa] rounded-full border border-[#d9efff]">{tag}</span>
                ))}
                {/* Badge showing this came from an uploaded SOP document */}
                {inputType === 'sop' && (
                  <span className="text-xs md:text-sm px-2 py-0.5 bg-[#f3e8ff] text-[#6d28d9] rounded-full border border-[#e9d5ff]">
                    📄 Restructured from document
                  </span>
                )}
              </div>

              <div className="lg:grid lg:grid-cols-2 lg:gap-6">
                {data?.sop?.purpose && (
                  <div className="mb-4">
                    <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-1">Purpose</p>
                    <p className="text-sm md:text-base text-gray-600">{data.sop.purpose}</p>
                  </div>
                )}
                {data?.sop?.scope && (
                  <div className="mb-4">
                    <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-1">Scope</p>
                    <p className="text-sm md:text-base text-gray-600">{data.sop.scope}</p>
                  </div>
                )}
              </div>

              <div className="lg:grid lg:grid-cols-2 lg:gap-6">
                {data?.sop?.roles?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-2">Roles & Responsibilities</p>
                    <div className="space-y-2">
                      {data.sop.roles.map((role, i) => (
                        <div key={i} className="p-3 bg-[#fafcff] rounded-xl border border-[#e8f4ff]">
                          <p className="text-sm md:text-base font-semibold text-[#00528d]">{role.name}</p>
                          <p className="text-xs md:text-sm text-gray-500 mt-0.5">{role.responsibility}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data?.sop?.prerequisites?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-2">Prerequisites</p>
                    <ul className="space-y-1">
                      {data.sop.prerequisites.map((p, i) => (
                        <li key={i} className="text-sm md:text-base text-gray-600 flex gap-2">
                          <span className="text-[#00528d] mt-0.5">•</span><span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(data?.sop?.start_state || data?.sop?.end_state) && (
                <div className="flex gap-3 mb-5">
                  {data.sop.start_state && (
                    <div className="flex-1 p-3 md:p-4 bg-[#e8f9f0] rounded-xl border border-[#b8edd0]">
                      <p className="text-xs md:text-sm font-semibold text-green-700 mb-0.5">Start State</p>
                      <p className="text-xs md:text-sm text-green-800">{data.sop.start_state}</p>
                    </div>
                  )}
                  {data.sop.end_state && (
                    <div className="flex-1 p-3 md:p-4 bg-[#fff4e8] rounded-xl border border-[#fdd9a8]">
                      <p className="text-xs md:text-sm font-semibold text-orange-700 mb-0.5">End State</p>
                      <p className="text-xs md:text-sm text-orange-800">{data.sop.end_state}</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-3">Step-by-Step Workflow</p>

              <div className="space-y-3">
                {sopSteps.map((step, index) => {
                  const expanded   = isStepExpanded(index)
                  const bottleneck = getBottleneckForStep(step.number)
                  const isDecision = step.title?.toLowerCase().includes('yes/no') || step.outcome_or_decision?.includes('?')
                  const isHandoff  = !!(step.handoffs && step.handoffs !== 'None')

                  const title       = getVal(index, 'title',               step.title)
                  const action      = getVal(index, 'action',              step.action)
                  const outcome     = getVal(index, 'outcome_or_decision', step.outcome_or_decision)
                  const happyPath   = getVal(index, 'happy_path',          step.happy_path)
                  const unhappyPath = getVal(index, 'unhappy_path',        step.unhappy_path)
                  const handoffs    = getVal(index, 'handoffs',            step.handoffs)

                  return (
                    <div key={index} ref={el => stepRefs.current[index] = el}
                      className={`rounded-xl border transition-all ${bottleneck ? 'border-red-200 bg-red-50/30' : 'border-[#e8f4ff] bg-[#fafcff]'}`}>

                      {/* Step header */}
                      <button className="w-full text-left p-4"
                        onClick={() => {
                          if (allExpanded) { setAllExpanded(false); setExpandedStep(index === expandedStep ? null : index) }
                          else             { setExpandedStep(expanded ? null : index) }
                        }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex flex-col items-center justify-center mt-0.5
                              ${isDecision ? 'bg-purple-100 text-purple-700' : bottleneck ? 'bg-red-100 text-red-700' : 'bg-[#00528d] text-white'}`}>
                              <span className="text-[9px] leading-none"><StepIcon isDecision={isDecision} isHandoff={isHandoff} bottleneck={bottleneck} /></span>
                              <span className="text-[10px] font-bold leading-none">{step.number}</span>
                            </div>
                            <div className="flex-1">
                              {/* Editable title */}
                              <div onClick={e => e.stopPropagation()}>
                                <EditableField
                                  value={title}
                                  onChange={v => handleEdit(index, 'title', v)}
                                  multiline={false}
                                  className={`text-sm md:text-base font-semibold leading-snug ${bottleneck ? 'text-red-700' : 'text-[#00528d]'}`}
                                  placeholder="Step title"
                                />
                              </div>
                              {!expanded && action && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{action}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {bottleneck  && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">⚠ Bottleneck</span>}
                            {isDecision  && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">Decision</span>}
                            <span className={`text-[#5a8aaa] text-xs transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>▼</span>
                          </div>
                        </div>
                      </button>

                      {/* Animated expanded content */}
                      <Collapse open={expanded}>
                        <div className="px-4 pb-4 space-y-3 border-t border-[#e8f4ff] pt-3">

                          {/* Action */}
                          {(action !== undefined || step.action) && (
                            <div>
                              <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-1">Action</p>
                              <EditableField
                                value={action}
                                onChange={v => handleEdit(index, 'action', v)}
                                className="text-sm md:text-base text-gray-600"
                                placeholder="Describe the action..."
                              />
                            </div>
                          )}

                          {/* Outcome / Decision */}
                          {(outcome !== undefined || step.outcome_or_decision) && (
                            <div>
                              <p className="text-xs md:text-sm font-semibold text-[#00528d] uppercase tracking-wide mb-1">
                                {isDecision ? 'Decision' : 'Outcome'}
                              </p>
                              <EditableField
                                value={outcome}
                                onChange={v => handleEdit(index, 'outcome_or_decision', v)}
                                className="text-sm md:text-base text-gray-600"
                                placeholder={isDecision ? 'Describe the decision...' : 'Describe the outcome...'}
                              />
                            </div>
                          )}

                          {/* Happy / Unhappy paths */}
                          <div className="flex gap-2">
                            {step.happy_path && (
                              <div className="flex-1 p-3 bg-[#e8f9f0] rounded-lg border border-[#b8edd0]">
                                <p className="text-xs font-semibold text-green-700 mb-1">✓ {isDecision ? 'Yes Path' : 'Happy Path'}</p>
                                <EditableField
                                  value={happyPath}
                                  onChange={v => handleEdit(index, 'happy_path', v)}
                                  className="text-xs md:text-sm text-green-800"
                                  placeholder="Happy path description..."
                                />
                              </div>
                            )}
                            {step.unhappy_path && step.unhappy_path !== 'N/A' && (
                              <div className="flex-1 p-3 bg-[#fffbeb] rounded-lg border border-[#fde68a]">
                                <p className="text-xs font-semibold text-amber-700 mb-1">✗ {isDecision ? 'No Path' : 'Unhappy Path'}</p>
                                <EditableField
                                  value={unhappyPath}
                                  onChange={v => handleEdit(index, 'unhappy_path', v)}
                                  className="text-xs md:text-sm text-amber-700"
                                  placeholder="Unhappy path description..."
                                />
                              </div>
                            )}
                          </div>

                          {/* Handoff */}
                          {step.handoffs && step.handoffs !== 'None' && (
                            <div className="flex items-start gap-2 p-2 bg-[#f0f4ff] rounded-lg">
                              <span className="text-xs mt-0.5">🔁</span>
                              <p className="text-xs font-semibold text-[#00528d] shrink-0 mt-0.5">Handoff:</p>
                              <div className="flex-1">
                                <EditableField
                                  value={handoffs}
                                  onChange={v => handleEdit(index, 'handoffs', v)}
                                  className="text-xs md:text-sm text-gray-600"
                                  placeholder="Handoff description..."
                                />
                              </div>
                            </div>
                          )}

                          {/* Bottleneck callout */}
                          {bottleneck && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                              <p className="text-xs font-semibold text-red-600 mb-1">⚠ Bottleneck Detected</p>
                              <p className="text-xs md:text-sm text-red-700 mb-2">{bottleneck.description}</p>
                              <div className="flex gap-3 text-xs text-red-500 mb-2">
                                {inputType === 'transcript' && (
                                  <span>Mentions: <strong>{bottleneck.metrics?.transcript_mentions}</strong></span>
                                )}
                                <span>Rework: <strong>{bottleneck.metrics?.rework_rate}</strong></span>
                              </div>
                              <ul className="space-y-1">
                                {bottleneck.suggestions?.map((s, i) => (
                                  <li key={i} className="text-xs md:text-sm text-red-700 flex gap-1"><span>→</span><span>{s}</span></li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </Collapse>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/*Diagram Tab*/}
        {activeTab === 'lucid' && (
          <div id="active-content" className="p-6 md:p-8">
            <h2 className="font-bold text-lg md:text-xl text-[#00528d] mb-1">Process Diagram</h2>
            <p className="text-sm md:text-base text-gray-500 mb-4">
              Drag nodes, click to edit, draw connections between handles, and export as PDF.
            </p>
            <SwimlaneDiagram diagram={data?.diagram} sopTitle={data?.sop?.title} />
          </div>
        )}

        {/*BOTTLENECKS TAB*/}
        {activeTab === 'bottlenecks' && (
          <div id="active-content" className="p-6 md:p-8 max-h-[600px] md:max-h-[700px] lg:max-h-[75vh] overflow-y-auto">
            <h2 className="font-bold text-lg md:text-xl text-[#00528d] mb-1">Bottleneck Analysis</h2>
            <p className="text-sm md:text-base text-gray-500 mb-4">
              {bottlenecks.length === 0
                ? 'No bottlenecks detected in this process.'
                : `${bottlenecks.length} bottleneck${bottlenecks.length > 1 ? 's' : ''} identified across the workflow.`}
            </p>
            {bottlenecks.length === 0 && (
              <div className="p-6 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">✓ This process looks clean — no bottlenecks found.</div>
            )}
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
              {bottlenecks.map((b, i) => {
                const severity = getSeverity(b)
                return (
                  <div key={i} className="border border-red-200 rounded-xl overflow-hidden h-fit">
                    <div className="p-4 md:p-5 bg-red-50">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="text-xs md:text-sm font-semibold text-red-500 uppercase tracking-wide">{b.type}</span>
                          <p className="text-sm md:text-base font-bold text-red-700 mt-0.5">Step {b.step_number} — {b.step_title}</p>
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${severity.bg} ${severity.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${severity.dot}`} />{severity.label}
                        </span>
                      </div>
                      <div className="flex gap-4 md:gap-6 mt-2">
                        {/* Hide transcript_mentions for SOP-sourced bottlenecks since it's always 0 */}
                        {inputType === 'transcript' && (
                          <div className="text-center">
                            <p className="text-lg md:text-xl font-bold text-red-600">{b.metrics?.transcript_mentions ?? '—'}</p>
                            <p className="text-xs text-red-400">Mentions</p>
                          </div>
                        )}
                        <div className="text-center"><p className="text-lg md:text-xl font-bold text-red-600">{b.metrics?.rework_rate ?? '—'}</p><p className="text-xs text-red-400">Rework Rate</p></div>
                        <div className="text-center"><p className="text-lg md:text-xl font-bold text-red-600">{b.metrics?.times_delayed ?? '—'}</p><p className="text-xs text-red-400">Times Delayed</p></div>
                      </div>
                    </div>
                    <div className="p-4 md:p-5 space-y-3 bg-white">
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Why it's a bottleneck</p>
                        <p className="text-sm md:text-base text-gray-600">{b.description}</p>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Suggestions</p>
                        <ul className="space-y-2">
                          {b.suggestions?.map((s, si) => (
                            <li key={si} className="flex gap-2 text-sm md:text-base text-gray-600">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#e8f4ff] text-[#00528d] text-xs flex items-center justify-center font-bold">{si + 1}</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      <button onClick={onBack} className="mt-6 px-5 py-2 border border-[#b8dcf8] rounded-lg text-sm md:text-base text-[#00528d] hover:bg-white transition-colors">
        ← Start over
      </button>
    </div>
  )
}

export default Results
