import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, addEdge, applyEdgeChanges, applyNodeChanges,
  MarkerType, Handle, Position, ReactFlowProvider, useReactFlow,
  NodeResizer, NodeResizeControl,
  EdgeLabelRenderer, getSmoothStepPath, BaseEdge,
  reconnectEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

const LANE_HEIGHT = 180
const LANE_HEADER_WIDTH = 160
const NODE_WIDTH = 180
const NODE_GAP = 60
const NODE_START_X = LANE_HEADER_WIDTH + 40

// Helper: strip function props before cloning state (for storage & history)
const stripFunctions = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => typeof v !== 'function'))
const cloneForHistory = (nodes, edges) => ({
  nodes: nodes.map(n => ({ ...n, data: stripFunctions(n.data) })),
  edges: edges.map(e => ({ ...e, data: stripFunctions(e.data) })),
})

// ═══════════════════════════════════════
//  INLINE EDITABLE LABEL
// ═══════════════════════════════════════
const InlineEditableLabel = ({ value, onChange, className = '', placeholder = 'Click to edit', multiline = false }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')

  useEffect(() => { setDraft(value || '') }, [value])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit() }}
        className={`bg-white/95 border border-[#00528d] rounded px-1 py-0.5 outline-none resize-none nodrag nowheel ${className}`}
        rows={2}
        onClick={e => e.stopPropagation()}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) } }}
        className={`bg-white/95 border border-[#00528d] rounded px-1 py-0.5 outline-none w-full nodrag nowheel ${className}`}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
      className={`cursor-text ${className}`}
      title="Double-click to edit"
    >
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </span>
  )
}

// ═══════════════════════════════════════
//  4-SIDED HANDLES
// ═══════════════════════════════════════
const FourSidedHandles = ({ color = '#00528d' }) => {
  const style = { background: color, width: 8, height: 8 }
  return (
    <>
      <Handle type="target" position={Position.Left}   id="t-left"   style={{ ...style, zIndex: 1 }} />
      <Handle type="target" position={Position.Right}  id="t-right"  style={{ ...style, zIndex: 1 }} />
      <Handle type="target" position={Position.Top}    id="t-top"    style={{ ...style, zIndex: 1 }} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={{ ...style, zIndex: 1 }} />
      <Handle type="source" position={Position.Left}   id="s-left"   style={{ ...style, zIndex: 2 }} />
      <Handle type="source" position={Position.Right}  id="s-right"  style={{ ...style, zIndex: 2 }} />
      <Handle type="source" position={Position.Top}    id="s-top"    style={{ ...style, zIndex: 2 }} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={{ ...style, zIndex: 2 }} />
    </>
  )
}

// ═══════════════════════════════════════
//  NODE COMPONENTS
// ═══════════════════════════════════════
const ProcessNode = ({ data, selected, id }) => (
  <>
    <NodeResizer
      isVisible={selected}
      minWidth={120}
      minHeight={60}
      lineStyle={{ borderColor: '#00528d' }}
      handleStyle={{ background: '#00528d', width: 8, height: 8 }}
    />
    <div
      className={`w-full h-full px-3 py-2 rounded-lg border-2 bg-white shadow-sm flex flex-col items-center justify-center text-center transition-all
        ${selected ? 'border-[#00528d] shadow-md' : 'border-[#b8dcf8]'}
        ${data.flag ? 'border-red-400 bg-red-50' : ''}`}
    >
      <FourSidedHandles color="#00528d" />
      <InlineEditableLabel
        value={data.label}
        onChange={v => data.onChangeLabel?.(id, v)}
        className="text-sm font-semibold text-[#00528d] leading-tight"
      />
      {data.description !== undefined && (
        <div className="mt-1 w-full">
          <InlineEditableLabel
            value={data.description}
            onChange={v => data.onChangeDescription?.(id, v)}
            className="text-[10px] text-gray-500 leading-snug"
            placeholder="Add description"
            multiline
          />
        </div>
      )}
      {data.flag && <span className="inline-block text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1">
        <InlineEditableLabel
          value={data.bottleneckLabel || "⚠ Bottleneck"}
          onChange={v => data.onChangeBottleneck?.(id, v)}
          placeholder="Flag reason"
          className="text-[10px] text-red-600 bg-red-100 px-2 py-0.5 rounded-full"/>
        </span>}
    </div>
  </>
)

const DecisionNode = ({ data, selected, id }) => (
  <>
    <NodeResizer
      isVisible={selected}
      minWidth={100}
      minHeight={100}
      keepAspectRatio
      lineStyle={{ borderColor: '#7c3aed' }}
      handleStyle={{ background: '#7c3aed', width: 8, height: 8 }}
    />
    <div className="relative w-full h-full">
      <FourSidedHandles color="#7c3aed" />
      <div
        className={`absolute inset-[15%] flex items-center justify-center text-center px-1 ${selected ? 'drop-shadow-md' : ''}`}
        style={{
          background: data.flag ? '#fef2f2' : '#faf5ff',
          border: `2px solid ${selected ? '#7c3aed' : data.flag ? '#f87171' : '#d8b4fe'}`,
          transform: 'rotate(45deg)',
        }}
      >
        <div style={{ transform: 'rotate(-45deg)' }} className="w-full">
          <InlineEditableLabel
            value={data.label}
            onChange={v => data.onChangeLabel?.(id, v)}
            className="text-xs font-semibold text-purple-700 leading-tight"
          />
        </div>
      </div>
    </div>
  </>
)

const StartEndNode = ({ data, selected, id }) => (
  <>
    <NodeResizer
      isVisible={selected}
      minWidth={80}
      minHeight={40}
      lineStyle={{ borderColor: data.kind === 'start' ? '#16a34a' : '#ea580c' }}
      handleStyle={{ background: data.kind === 'start' ? '#16a34a' : '#ea580c', width: 8, height: 8 }}
    />
    <div
      className={`w-full h-full px-4 py-1 rounded-full border-2 text-center shadow-sm flex items-center justify-center
        ${data.kind === 'start' ? 'bg-green-50 border-green-400' : 'bg-orange-50 border-orange-400'}
        ${selected ? 'shadow-md' : ''}`}
    >
      <FourSidedHandles color={data.kind === 'start' ? '#16a34a' : '#ea580c'} />
      <InlineEditableLabel
        value={data.label}
        onChange={v => data.onChangeLabel?.(id, v)}
        className={`text-sm font-bold ${data.kind === 'start' ? 'text-green-700' : 'text-orange-700'}`}
      />
    </div>
  </>
)

const LaneNode = ({ data, selected, id }) => {
  const ctrlStyle = {
    background: '#00528d',
    border: '1px solid white',
    width: 10,
    height: 10,
    borderRadius: 2,
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={400}
        minHeight={100}
        lineStyle={{ borderColor: '#00528d', borderStyle: 'dashed', borderWidth: 2 }}
        handleStyle={ctrlStyle}
      />
      <NodeResizeControl position="right"  style={{ ...ctrlStyle, opacity: selected ? 1 : 0.35 }} minWidth={400} minHeight={100} />
      <NodeResizeControl position="bottom" style={{ ...ctrlStyle, opacity: selected ? 1 : 0.35 }} minWidth={400} minHeight={100} />
      <NodeResizeControl position="left"   style={{ ...ctrlStyle, opacity: selected ? 1 : 0.35 }} minWidth={400} minHeight={100} />
      <NodeResizeControl position="top"    style={{ ...ctrlStyle, opacity: selected ? 1 : 0.35 }} minWidth={400} minHeight={100} />

      <div
        className="w-full h-full rounded-l-lg relative"
        style={{ background: data.color, border: '1px solid #d9e8f5' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center justify-center border-r border-[#d9e8f5] bg-white/70"
          style={{ width: LANE_HEADER_WIDTH }}
        >
          <div className="px-2 text-center w-full">
            <InlineEditableLabel
              value={data.label}
              onChange={v => data.onChangeLabel?.(id, v)}
              className="text-sm font-bold text-[#00528d] leading-tight"
            />
          </div>
        </div>
      </div>
    </>
  )
}

const nodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  start: StartEndNode,
  end: StartEndNode,
  lane: LaneNode,
}

// ═══════════════════════════════════════
//  EDITABLE + BENDABLE EDGE
//
//  Bend works by storing (bendX, bendY) offsets from the natural
//  midpoint of the arrow. When selected, a circular handle appears
//  at the control point. Drag it to reshape the curve.
//  Double-click the handle to straighten back to 0,0.
// ═══════════════════════════════════════
const EditableEdge = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style = {}, markerEnd, selected,
  animated,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.label || '')
  const dragging = useRef(false)

  useEffect(() => { setDraft(data?.label || '') }, [data?.label])

  const offset = data?.offset ?? 0
  const bendX = data?.bendX ?? 0
  const bendY = data?.bendY ?? 0
  const hasBend = bendX !== 0 || bendY !== 0

  // Natural midpoint
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  // Control point = natural midpoint + user drag
  const cpX = midX + bendX
  const cpY = midY + bendY

  let edgePath, labelX, labelY

  if (hasBend) {
    // Quadratic bezier through the control point
    edgePath = `M ${sourceX} ${sourceY} Q ${cpX} ${cpY} ${targetX} ${targetY}`
    // Bezier midpoint at t=0.5
    labelX = 0.25 * sourceX + 0.5 * cpX + 0.25 * targetX
    labelY = 0.25 * sourceY + 0.5 * cpY + 0.25 * targetY
  } else {
    // Original smooth step
    ;[edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 8,
      offset: 20 + offset * 15,
    })
  }

  const commit = () => {
    setEditing(false)
    if (draft !== (data?.label || '')) data?.onChangeLabel?.(id, draft)
  }

  const strokeColor = style.stroke || '#00528d'
  const strokeWidth = selected ? 3.5 : 2

  // ── Drag the bend handle ──
  const onHandleMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = true

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startBendX = bendX
    const startBendY = bendY

    const getZoom = () => {
      const vp = document.querySelector('.react-flow__viewport')
      if (!vp) return 1
      const m = new DOMMatrix(window.getComputedStyle(vp).transform)
      return m.a || 1
    }

    const onMouseMove = (me) => {
      if (!dragging.current) return
      const z = getZoom()
      data?.onChangeBend?.(id, startBendX + (me.clientX - startMouseX) / z, startBendY + (me.clientY - startMouseY) / z)
    }
    const onMouseUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const onHandleDoubleClick = (e) => {
    e.stopPropagation()
    data?.onChangeBend?.(id, 0, 0)
  }

  return (
    <>
      {/* Wide invisible hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        style={{ cursor: 'pointer' }}
        className="react-flow__edge-interaction"
      />
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={8}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: animated ? '6 4' : undefined,
          animation: animated ? 'dashdraw 0.5s linear infinite' : undefined,
        }}
      />

      <EdgeLabelRenderer>
        {/* Bend handle — only when selected */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${cpX}px,${cpY}px)`,
              pointerEvents: 'all',
              zIndex: 2000,
            }}
            className="nodrag nopan"
          >
            <div
              onMouseDown={onHandleMouseDown}
              onDoubleClick={onHandleDoubleClick}
              title="Drag to bend • Double-click to straighten"
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#ffffff',
                border: `2.5px solid ${strokeColor}`,
                cursor: 'grab',
                boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: strokeColor }} />
            </div>
          </div>
        )}

        {/* Edge label */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1001,
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
              className="text-xs font-semibold bg-white border border-[#00528d] rounded px-1 py-0.5 outline-none w-28 shadow"
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              onClick={() => data?.onEdgeClick?.(id)}
              className={`text-xs font-semibold px-2 py-0.5 rounded cursor-text shadow-sm transition-all
                ${selected
                  ? 'bg-[#00528d] text-white border border-[#00528d]'
                  : data?.label
                    ? 'bg-white border border-[#d9efff] text-[#00528d]'
                    : 'bg-white/80 border border-dashed border-gray-300 text-gray-400 hover:border-[#00528d] hover:text-[#00528d]'}`}
              title="Click to select, double-click to edit, Delete key to remove"
            >
              {data?.label || (selected ? '+ add label' : '•')}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
      <style>{`
        @keyframes dashdraw { to { stroke-dashoffset: -10; } }
      `}</style>
    </>
  )
}

const edgeTypes = { editable: EditableEdge }

// ═══════════════════════════════════════
//  BUILD FLOW FROM BACKEND DIAGRAM
// ═══════════════════════════════════════
const buildFlowFromDiagram = (diagram) => {
  if (!diagram || !diagram.lanes || !diagram.nodes) return { nodes: [], edges: [] }

  const colors = ['#e8f4ff', '#e8f9f0', '#fff4e8', '#f3e8ff', '#fef3c7', '#fce7f3']
  const maxOrder = Math.max(...diagram.nodes.map(n => n.order || 1), 1)
  const laneWidth = NODE_START_X + maxOrder * (NODE_WIDTH + NODE_GAP) + 80

  const laneNodes = diagram.lanes.map((lane, i) => ({
    id: lane.id,
    type: 'lane',
    position: { x: 0, y: i * LANE_HEIGHT },
    data: { label: lane.label, color: lane.color || colors[i % colors.length] },
    style: { width: laneWidth, height: LANE_HEIGHT, zIndex: 0 },
    zIndex: 0,
    draggable: false,  // locked until explicitly selected
    selectable: true,
  }))

  const laneIndexById = Object.fromEntries(diagram.lanes.map((l, i) => [l.id, i]))

  const stepNodes = diagram.nodes.map(n => {
    const laneIdx = laneIndexById[n.laneId] ?? 0
    const x = NODE_START_X + ((n.order || 1) - 1) * (NODE_WIDTH + NODE_GAP)
    const isDecision = n.type === 'decision'
    const y = laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2 - (isDecision ? 60 : 30)
    const width = isDecision ? 120 : NODE_WIDTH
    const height = isDecision ? 120 : 70

    return {
      id: n.id,
      type: n.type === 'start' || n.type === 'end' ? n.type : (isDecision ? 'decision' : 'process'),
      position: { x, y },
      data: {
        label: n.label,
        description: n.description,
        kind: n.type,
        flag: n.flag || false,
      },
      style: { width, height, zIndex: 10 },
      zIndex: 10,
    }
  })

  const pairCounts = {}
  const edges = (diagram.edges || []).map((e) => {
    const pairKey = [e.source, e.target].sort().join('|')
    pairCounts[pairKey] = pairCounts[pairKey] || 0
    const offset = pairCounts[pairKey]++
    const color = e.type === 'loopback' ? '#f59e0b' : '#00528d'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'editable',
      data: { label: e.label || '', offset, bendX: 0, bendY: 0 },
      animated: e.type === 'loopback',
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 2 },
      zIndex: 5,
    }
  })

  return { nodes: [...laneNodes, ...stepNodes], edges }
}

// ═══════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════
const SwimlaneDiagramInner = ({ diagram, sopTitle, fullscreen = false, initialState = null }) => {
  const initial = useMemo(
    () => initialState || buildFlowFromDiagram(diagram),
    [initialState, diagram]
  )
  const [nodes, setNodes] = useState(initial.nodes)
  const [edges, setEdges] = useState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [, setHistoryTick] = useState(0)
  const flowRef = useRef(null)
  const edgeUpdateSuccessful = useRef(true)
  const { fitView, getNodes, setViewport, getViewport } = useReactFlow()

  // ── Undo / Redo ──
  const history = useRef([])
  const future = useRef([])
  const isApplyingHistory = useRef(false)
  const MAX_HISTORY = 50

  const bumpHistoryTick = useCallback(() => setHistoryTick(t => t + 1), [])

  const snapshot = useCallback(() => {
    if (isApplyingHistory.current) return
    const snap = cloneForHistory(nodes, edges)
    history.current.push(snap)
    if (history.current.length > MAX_HISTORY) history.current.shift()
    future.current = []
    bumpHistoryTick()
  }, [nodes, edges, bumpHistoryTick])

  const labelChanger = useCallback((nodeId, newLabel) => {
    if (!isApplyingHistory.current) snapshot()
    setNodes(cur => cur.map(x => x.id === nodeId ? { ...x, data: { ...x.data, label: newLabel } } : x))
  }, [snapshot])

  const descChanger = useCallback((nodeId, newDesc) => {
    if (!isApplyingHistory.current) snapshot()
    setNodes(cur => cur.map(x => x.id === nodeId ? { ...x, data: { ...x.data, description: newDesc } } : x))
  }, [snapshot])

  const bottleneckChanger = useCallback((nodeId, newflag) => {
    if (!isApplyingHistory.current) snapshot()
    setNodes(cur => cur.map(x => x.id === nodeId ? { ...x, data: { ...x.data, bottleneckLabel: newflag } } : x))
  }, [snapshot])

  const edgeLabelChanger = useCallback((edgeId, newLabel) => {
    if (!isApplyingHistory.current) snapshot()
    setEdges(cur => cur.map(x => x.id === edgeId ? { ...x, data: { ...x.data, label: newLabel } } : x))
  }, [snapshot])

  // Bend changer — no snapshot on every drag frame (too noisy); snapshot on mousedown instead
  const edgeBendChanger = useCallback((edgeId, bx, by) => {
    setEdges(cur => cur.map(x => x.id === edgeId ? { ...x, data: { ...x.data, bendX: bx, bendY: by } } : x))
  }, [])

  const edgeClickHandler = useCallback((edgeId) => {
    setSelectedEdgeId(edgeId)
    setSelectedNodeId(null)
  }, [])

  const rewireCallbacks = useCallback((ns, es) => ({
    nodes: ns.map(n => ({
      ...n,
      data: { ...n.data, onChangeLabel: labelChanger, onChangeDescription: descChanger, onChangeBottleneck: bottleneckChanger },
    })),
    edges: es.map(e => ({
      ...e,
      data: {
        ...e.data,
        onChangeLabel: edgeLabelChanger,
        onEdgeClick: edgeClickHandler,
        onChangeBend: edgeBendChanger,
        onChangeBottleneck: bottleneckChanger,
      },
    })),
  }), [labelChanger, descChanger, edgeLabelChanger, edgeClickHandler, edgeBendChanger, bottleneckChanger])

  const undo = useCallback(() => {
    if (history.current.length === 0) return
    const prev = history.current.pop()
    future.current.push(cloneForHistory(nodes, edges))
    isApplyingHistory.current = true
    const rewired = rewireCallbacks(prev.nodes, prev.edges)
    setNodes(rewired.nodes)
    setEdges(rewired.edges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setTimeout(() => { isApplyingHistory.current = false; bumpHistoryTick() }, 0)
  }, [nodes, edges, rewireCallbacks, bumpHistoryTick])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    const next = future.current.pop()
    history.current.push(cloneForHistory(nodes, edges))
    isApplyingHistory.current = true
    const rewired = rewireCallbacks(next.nodes, next.edges)
    setNodes(rewired.nodes)
    setEdges(rewired.edges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setTimeout(() => { isApplyingHistory.current = false; bumpHistoryTick() }, 0)
  }, [nodes, edges, rewireCallbacks, bumpHistoryTick])

  // Wire callbacks on mount — also lock all lanes (fixes fullscreen view)
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      draggable: n.type === 'lane' ? false : n.draggable,
      data: { ...n.data, onChangeLabel: labelChanger, onChangeDescription: descChanger, onChangeBottleneck: bottleneckChanger },
    })))
    setEdges(prev => prev.map(e => ({
      ...e,
      data: {
        ...e.data,
        onChangeLabel: edgeLabelChanger,
        onEdgeClick: edgeClickHandler,
        onChangeBend: edgeBendChanger,
        onChangeBottleneck: bottleneckChanger,
        bendX: e.data?.bendX ?? 0,
        bendY: e.data?.bendY ?? 0,
      },
    })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage
  useEffect(() => {
    try {
      const { nodes: cleanNodes, edges: cleanEdges } = cloneForHistory(nodes, edges)
      localStorage.setItem('diagram-state', JSON.stringify({ nodes: cleanNodes, edges: cleanEdges, sopTitle }))
    } catch {}
  }, [nodes, edges, sopTitle])

  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.2 }), 100)
  }, [fitView])

  const onNodesChange = useCallback((changes) => setNodes(nds => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback((changes) => setEdges(eds => applyEdgeChanges(changes, eds)), [])

  const onConnect = useCallback(
    (params) => {
      snapshot()
      setEdges(eds => addEdge({
        ...params,
        type: 'editable',
        data: {
          label: '',
          offset: 0,
          bendX: 0,
          bendY: 0,
          onChangeLabel: edgeLabelChanger,
          onEdgeClick: edgeClickHandler,
          onChangeBend: edgeBendChanger,
          onChangeBottleneck: bottleneckChanger,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#00528d' },
        style: { stroke: '#00528d', strokeWidth: 2 },
        zIndex: 5,
      }, eds))
    },
    [edgeLabelChanger, edgeClickHandler, edgeBendChanger, snapshot]
  )

  const onReconnectStart = useCallback(() => {
    edgeUpdateSuccessful.current = false
    snapshot()
  }, [snapshot])

  const onReconnect = useCallback((oldEdge, newConnection) => {
    edgeUpdateSuccessful.current = true
    setEdges(els => reconnectEdge(oldEdge, newConnection, els))
  }, [])

  const onReconnectEnd = useCallback((_, edge) => {
    if (!edgeUpdateSuccessful.current) {
      setEdges(eds => eds.filter(e => e.id !== edge.id))
    }
    edgeUpdateSuccessful.current = true
  }, [])

  const displayedEdges = useMemo(
    () => edges.map(e => ({
      ...e,
      selected: e.id === selectedEdgeId,
      // Always keep live callbacks on displayed edges
      data: { ...e.data, onChangeBend: edgeBendChanger },
    })),
    [edges, selectedEdgeId, edgeBendChanger]
  )

  const displayedNodes = useMemo(
    () => nodes.map(n => ({ ...n, selected: n.id === selectedNodeId,data: {
      ...n.data,
      onChangeLabel: labelChanger,
      onChangeDescription: descChanger,
      onChangeBottleneck: bottleneckChanger,
    }, 
  })),
    [nodes, selectedNodeId, labelChanger, descChanger, bottleneckChanger]
  )

  // Helper: lock all lanes, optionally unlock one by id
  const setLaneDraggable = useCallback((unlockId = null) => {
    setNodes(prev => prev.map(n =>
      n.type === 'lane' ? { ...n, draggable: n.id === unlockId } : n
    ))
  }, [])

  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    // Unlock only this lane for dragging; lock every other lane
    setLaneDraggable(node.type === 'lane' ? node.id : null)
  }, [setLaneDraggable])

  const onEdgeClick = useCallback((_, edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setLaneDraggable(null)
  }, [setLaneDraggable])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setLaneDraggable(null)
  }, [setLaneDraggable])

  const onNodeDragStart = useCallback(() => { snapshot() }, [snapshot])

  // Keyboard handler
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea'

      if (!isTyping && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (!isTyping && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTyping) return
        if (selectedNodeId) {
          snapshot()
          setNodes(nds => nds.filter(n => n.id !== selectedNodeId))
          setEdges(eds => eds.filter(ed => ed.source !== selectedNodeId && ed.target !== selectedNodeId))
          setSelectedNodeId(null)
        } else if (selectedEdgeId) {
          snapshot()
          setEdges(eds => eds.filter(ed => ed.id !== selectedEdgeId))
          setSelectedEdgeId(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, selectedEdgeId, snapshot, undo, redo])

  const addNode = (type = 'process') => {
    snapshot()
    const id = `node-${Date.now()}`
    const labels = { process: 'New step', decision: 'New decision?', start: 'Start', end: 'End' }
    const dims = type === 'decision'
      ? { width: 120, height: 120 }
      : type === 'start' || type === 'end'
        ? { width: 120, height: 50 }
        : { width: NODE_WIDTH, height: 70 }

    setNodes(nds => [...nds, {
      id, type,
      position: { x: 300, y: 100 },
      data: {
        label: labels[type],
        description: type === 'process' ? '' : undefined,
        kind: type,
        onChangeLabel: labelChanger,
        onChangeDescription: descChanger,
        onChangeBottleneck: bottleneckChanger,
      },
      style: { ...dims, zIndex: 10 },
      zIndex: 10,
    }])
  }

  const addLane = () => {
    snapshot()
    const id = `lane-${Date.now()}`
    const colors = ['#e8f4ff', '#e8f9f0', '#fff4e8', '#f3e8ff', '#fef3c7', '#fce7f3']
    const laneNodes = nodes.filter(n => n.type === 'lane')
    const laneCount = laneNodes.length
    const laneWidth = Math.max(...laneNodes.map(n => n.style?.width || 800), 800)

    setNodes(nds => [...nds, {
      id, type: 'lane',
      position: { x: 0, y: laneCount * LANE_HEIGHT },
      data: { label: 'New Lane', color: colors[laneCount % colors.length], onChangeLabel: labelChanger, onChangeBottleneck: bottleneckChanger },
      style: { width: laneWidth, height: LANE_HEIGHT, zIndex: 0 },
      zIndex: 0,
      draggable: false,  // locked until selected
    }])
  }

  const openFullscreen = () => {
    try {
      const { nodes: cleanNodes, edges: cleanEdges } = cloneForHistory(nodes, edges)
      localStorage.setItem('diagram-state', JSON.stringify({ nodes: cleanNodes, edges: cleanEdges, sopTitle }))
    } catch {}
    const url = `${window.location.origin}${window.location.pathname}?view=diagram`
    window.open(url, '_blank', 'noopener')
  }

  const handleExportPDF = async () => {
    setExporting(true)
    const originalViewport = getViewport()

    try {
      setSelectedNodeId(null)
      setSelectedEdgeId(null)

      const allNodes = getNodes()
      if (allNodes.length === 0) {
        alert('Nothing to export.')
        setExporting(false)
        return
      }

      const xs = allNodes.map(n => n.position.x)
      const ys = allNodes.map(n => n.position.y)
      const xe = allNodes.map(n => n.position.x + (n.width || n.style?.width || NODE_WIDTH))
      const ye = allNodes.map(n => n.position.y + (n.height || n.style?.height || LANE_HEIGHT))

      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xe)
      const maxY = Math.max(...ye)

      const padding = 40
      const contentWidth = (maxX - minX) + padding * 2
      const contentHeight = (maxY - minY) + padding * 2

      setViewport({ x: -minX + padding, y: -minY + padding, zoom: 1 }, { duration: 0 })
      await new Promise(r => setTimeout(r, 400))

      const flowWrapper = flowRef.current?.querySelector('.react-flow')
      if (!flowWrapper) throw new Error('No flow container')

      const dataUrl = await toPng(flowWrapper, {
        backgroundColor: '#ffffff',
        width: contentWidth,
        height: contentHeight,
        pixelRatio: 2.5,
        cacheBust: true,
        style: { width: `${contentWidth}px`, height: `${contentHeight}px` },
        filter: (node) => {
          if (node?.classList?.contains?.('react-flow__controls')) return false
          if (node?.classList?.contains?.('react-flow__minimap')) return false
          if (node?.classList?.contains?.('react-flow__attribution')) return false
          if (node?.classList?.contains?.('react-flow__panel')) return false
          return true
        },
      })

      setViewport(originalViewport, { duration: 300 })

      const isLandscape = contentWidth >= contentHeight
      const pdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      pdf.setFontSize(16)
      pdf.setTextColor(0, 82, 141)
      pdf.text(sopTitle || 'Process Swimlane Diagram', 15, 15)
      pdf.setFontSize(9)
      pdf.setTextColor(120, 120, 120)
      pdf.text(`Generated ${new Date().toLocaleDateString()}`, 15, 21)

      const img = new Image()
      img.src = dataUrl
      await new Promise(r => { img.onload = r })

      const topOffset = 28
      const maxImgW = pageW - 20
      const maxImgH = pageH - topOffset - 10
      const ratio = Math.min(maxImgW / img.width, maxImgH / img.height)
      const imgW = img.width * ratio
      const imgH = img.height * ratio

      pdf.addImage(dataUrl, 'PNG', (pageW - imgW) / 2, topOffset, imgW, imgH, undefined, 'FAST')
      pdf.save(`${(sopTitle || 'process-diagram').replace(/\s+/g, '-').toLowerCase()}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('Could not export diagram to PDF. Please try again.')
      setViewport(originalViewport, { duration: 0 })
    }
    setExporting(false)
  }

  const selectedEdge = edges.find(e => e.id === selectedEdgeId)

  const applyEdgeColor = (color) => {
    snapshot()
    setEdges(eds => eds.map(e =>
      e.id === selectedEdgeId
        ? {
            ...e,
            style: { ...e.style, stroke: color },
            markerEnd: { ...(e.markerEnd || {}), type: MarkerType.ArrowClosed, color },
          }
        : e
    ))
  }

  const toggleEdgeAnimated = (animated) => {
    snapshot()
    setEdges(eds => eds.map(x => x.id === selectedEdgeId ? { ...x, animated } : x))
  }

  const canUndo = history.current.length > 0
  const canRedo = future.current.length > 0

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >↶ Undo</button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
          >↷ Redo</button>
          <div className="w-px h-6 bg-gray-200 mx-1 self-center" />
          <button onClick={() => addNode('process')}  className="text-xs px-3 py-1.5 bg-white border border-[#b8dcf8] rounded-lg text-[#00528d] hover:bg-[#e8f4ff] transition-colors">+ Step</button>
          <button onClick={() => addNode('decision')} className="text-xs px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors">+ Decision</button>
          <button onClick={() => addNode('start')}    className="text-xs px-3 py-1.5 bg-white border border-green-200 rounded-lg text-green-700 hover:bg-green-50 transition-colors">+ Start</button>
          <button onClick={() => addNode('end')}      className="text-xs px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-50 transition-colors">+ End</button>
          <button onClick={addLane}                   className="text-xs px-3 py-1.5 bg-white border border-[#b8dcf8] rounded-lg text-[#00528d] hover:bg-[#e8f4ff] transition-colors">+ Lane</button>
          <button onClick={() => fitView({ padding: 0.2 })} className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">⊡ Fit view</button>
        </div>
        <div className="flex gap-2">
          {!fullscreen && (
            <button onClick={openFullscreen} className="text-xs md:text-sm px-4 py-1.5 bg-white border border-[#b8dcf8] text-[#00528d] rounded-lg hover:bg-[#e8f4ff] transition-colors" title="Open in new tab for more space">
              ⛶ Open fullscreen
            </button>
          )}
          <button onClick={handleExportPDF} disabled={exporting} className="text-xs md:text-sm px-4 py-1.5 bg-[#00528d] text-white rounded-lg hover:bg-[#003f6e] transition-colors disabled:opacity-50">
            {exporting ? 'Generating PDF…' : '↓ Export PDF'}
          </button>
        </div>
      </div>

      {!fullscreen && (
        <div className="mb-3 text-[11px] text-[#5a8aaa] bg-[#fafcff] border border-[#d9efff] rounded-lg px-3 py-2">
          💡 <strong>Tip:</strong> Drag from any handle to draw an arrow. Press <kbd className="px-1 bg-white border rounded">Ctrl+Z</kbd> to undo, <kbd className="px-1 bg-white border rounded">Ctrl+Shift+Z</kbd> to redo, <kbd className="px-1 bg-white border rounded">Delete</kbd> to remove selection. <strong>Select an arrow</strong> then drag its ● midpoint handle to bend it; double-click the handle to straighten.
        </div>
      )}

      {selectedEdge && (
        <div className="absolute top-20 right-4 z-50 bg-white border border-[#00528d] rounded-lg shadow-lg p-3 w-60">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-[#00528d]">Arrow selected</p>
            <button onClick={() => { snapshot(); setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null) }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
          </div>
          <label className="block text-[10px] text-gray-500 mb-1">Label</label>
          <input
            type="text"
            value={selectedEdge.data?.label || ''}
            onChange={e => edgeLabelChanger(selectedEdgeId, e.target.value)}
            placeholder="e.g. Yes / No / Approved"
            className="w-full px-2 py-1 text-xs border border-[#b8dcf8] rounded outline-none focus:border-[#00528d]"
          />
          <label className="block text-[10px] text-gray-500 mt-2 mb-1">Color</label>
          <div className="flex gap-1">
            {['#00528d', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#64748b'].map(c => (
              <button
                key={c}
                onClick={() => applyEdgeColor(c)}
                className={`w-5 h-5 rounded-full border-2 shadow hover:scale-110 transition-transform ${selectedEdge.style?.stroke === c ? 'border-black' : 'border-white'}`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 mt-2 text-[10px] text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedEdge.animated || false}
              onChange={e => toggleEdgeAnimated(e.target.checked)}
            />
            Animated (dashed)
          </label>
          {(selectedEdge.data?.bendX !== 0 || selectedEdge.data?.bendY !== 0) && (
            <button
              onClick={() => edgeBendChanger(selectedEdgeId, 0, 0)}
              className="mt-2 text-[10px] text-[#00528d] hover:underline block"
            >
              ↺ Straighten arrow
            </button>
          )}
          <p className="text-[10px] text-gray-400 mt-2 italic">Drag ● on arrow to bend. Double-click ● to straighten.</p>
        </div>
      )}

      <div
        ref={flowRef}
        style={{ width: '100%', height: fullscreen ? 'calc(100vh - 140px)' : '70vh' }}
        className="border border-[#d9efff] rounded-xl bg-white overflow-hidden"
      >
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeDragStart={onNodeDragStart}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          edgesReconnectable={true}
          fitView
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect
          nodeDragThreshold={8}
        >
          <Background color="#e8f4ff" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={n => n.type === 'decision' ? '#d8b4fe' : n.type === 'start' ? '#86efac' : n.type === 'end' ? '#fdba74' : n.type === 'lane' ? '#e8f4ff' : '#b8dcf8'}
            pannable zoomable
          />
        </ReactFlow>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
//  FULLSCREEN VIEW
// ═══════════════════════════════════════
export const FullscreenDiagram = () => {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('diagram-state')
      if (raw) setState(JSON.parse(raw))
    } catch {}
    setLoading(false)
  }, [])

  if (loading) return <div className="p-10 text-center text-[#5a8aaa]">Loading diagram…</div>
  if (!state) return (
    <div className="p-10 text-center text-gray-500">
      No diagram data found. Please open this view from the main app using the "Open fullscreen" button.
    </div>
  )

  return (
    <ReactFlowProvider>
      <div className="min-h-screen bg-[#d9efff] p-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="font-bold text-xl text-[#00528d] mb-3">{state.sopTitle || 'Process Diagram'} — Fullscreen</h2>
          <SwimlaneDiagramInner
            diagram={null}
            sopTitle={state.sopTitle}
            fullscreen
            initialState={{ nodes: state.nodes, edges: state.edges }}
          />
        </div>
      </div>
    </ReactFlowProvider>
  )
}

const SwimlaneDiagram = (props) => (
  <ReactFlowProvider>
    <SwimlaneDiagramInner {...props} />
  </ReactFlowProvider>
)

export default SwimlaneDiagram