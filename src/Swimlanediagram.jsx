import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, addEdge, applyEdgeChanges, applyNodeChanges,
  MarkerType, Handle, Position, ReactFlowProvider, useReactFlow,
  NodeResizer, NodeResizeControl,
  EdgeLabelRenderer, getSmoothStepPath, BaseEdge,
  reconnectEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import Footer from './Footer'

// Layout constants
const LANE_HEIGHT = 200
const LANE_HEADER_WIDTH = 160
const NODE_WIDTH = 200
const NODE_GAP = 80
const NODE_START_X = LANE_HEADER_WIDTH + 50

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
      {data.flag && (
        <span className="inline-block text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 font-semibold">
          ⚠ Bottleneck
        </span>
      )}
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
          border: `${data.flag ? '3px' : '2px'} solid ${data.flag ? '#dc2626' : selected ? '#7c3aed' : '#d8b4fe'}`,
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
      className={`w-full h-full px-4 py-1 rounded-full text-center shadow-sm flex items-center justify-center
        ${data.flag
          ? 'bg-red-50 border-[3px] border-red-600'
          : data.kind === 'start'
            ? 'bg-green-50 border-2 border-green-400'
            : 'bg-orange-50 border-2 border-orange-400'}
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
        style={{ background: data.color, border: '1px solid #d9e8f5', pointerEvents: 'none' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center justify-center border-r border-[#d9e8f5] bg-white/70"
          style={{ width: LANE_HEADER_WIDTH, pointerEvents: 'all' }}
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
// ═══════════════════════════════════════
const EditableEdge = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style = {}, markerEnd, selected,
  animated,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.label || '')
  const dragging = useRef(null) // 'cp1' | 'cp2' | null

  useEffect(() => { setDraft(data?.label || '') }, [data?.label])

  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  // Two control points, each offset from their natural third positions
  const cp1X = (sourceX + midX) / 2 + (data?.cp1x ?? 0)
  const cp1Y = (sourceY + midY) / 2 + (data?.cp1y ?? 0)
  const cp2X = (midX + targetX) / 2 + (data?.cp2x ?? 0)
  const cp2Y = (midY + targetY) / 2 + (data?.cp2y ?? 0)

  const hasBend = (data?.cp1x || data?.cp1y || data?.cp2x || data?.cp2y)

  let edgePath, labelX, labelY

  if (hasBend) {
    edgePath = `M ${sourceX} ${sourceY} C ${cp1X} ${cp1Y} ${cp2X} ${cp2Y} ${targetX} ${targetY}`
    labelX = 0.125*sourceX + 0.375*cp1X + 0.375*cp2X + 0.125*targetX
    labelY = 0.125*sourceY + 0.375*cp1Y + 0.375*cp2Y + 0.125*targetY
  } else {
    ;[edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 8,
      offset: 20 + (data?.offset ?? 0) * 15,
    })
  }

  const commit = () => {
    setEditing(false)
    if (draft !== (data?.label || '')) data?.onChangeLabel?.(id, draft)
  }

  const strokeColor = style.stroke || '#00528d'
  const strokeWidth = selected ? 3.5 : 2

  const getZoom = () => {
    const vp = document.querySelector('.react-flow__viewport')
    if (!vp) return 1
    return new DOMMatrix(window.getComputedStyle(vp).transform).a || 1
  }

  const onHandleMouseDown = (e, which) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = which

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startCp1x = data?.cp1x ?? 0
    const startCp1y = data?.cp1y ?? 0
    const startCp2x = data?.cp2x ?? 0
    const startCp2y = data?.cp2y ?? 0

    const onMouseMove = (me) => {
      if (!dragging.current) return
      const z = getZoom()
      const dx = (me.clientX - startMouseX) / z
      const dy = (me.clientY - startMouseY) / z
      if (dragging.current === 'cp1') {
        data?.onChangeBend?.(id, startCp1x + dx, startCp1y + dy, startCp2x, startCp2y)
      } else {
        data?.onChangeBend?.(id, startCp1x, startCp1y, startCp2x + dx, startCp2y + dy)
      }
    }
    const onMouseUp = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const onHandleDoubleClick = (e) => {
    e.stopPropagation()
    data?.onChangeBend?.(id, 0, 0, 0, 0)
  }

  return (
    <>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={22}
        style={{ cursor: 'pointer' }} className="react-flow__edge-interaction" />
      {selected && (
        <path d={edgePath} fill="none" stroke="#0ea5e9"
          strokeWidth={8} strokeOpacity={0.25} strokeLinecap="round" />
      )}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{
        stroke: strokeColor, strokeWidth,
        strokeDasharray: animated ? '6 4' : undefined,
        animation: animated ? 'dashdraw 0.5s linear infinite' : undefined,
      }} />

      <EdgeLabelRenderer>
        {/* Control point handles — only when selected */}
        {selected && [
          { which: 'cp1', cx: cp1X, cy: cp1Y, anchorX: sourceX, anchorY: sourceY },
          { which: 'cp2', cx: cp2X, cy: cp2Y, anchorX: targetX, anchorY: targetY },
        ].map(({ which, cx, cy, anchorX, anchorY }) => (
          <div key={which} style={{ position: 'absolute', pointerEvents: 'none',
            transform: `translate(0,0)`, zIndex: 1999 }}>
            {/* Dotted guide line from anchor to control point */}
            <svg style={{ position: 'absolute', left: 0, top: 0,
              width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              <line
                x1={anchorX} y1={anchorY} x2={cx} y2={cy}
                stroke={strokeColor} strokeWidth={1}
                strokeDasharray="4 3" opacity={0.5}
              />
            </svg>
            {/* Draggable handle */}
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${cx}px,${cy}px)`,
                pointerEvents: 'all', zIndex: 2000,
              }}
              className="nodrag nopan"
            >
              <div
                onMouseDown={e => onHandleMouseDown(e, which)}
                onDoubleClick={onHandleDoubleClick}
                title="Drag to bend • Double-click to straighten all"
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#ffffff',
                  border: `2.5px solid ${strokeColor}`,
                  cursor: 'grab',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: strokeColor }} />
              </div>
            </div>
          </div>
        ))}

        {/* Edge label */}
        <div style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          pointerEvents: 'all', zIndex: 1001,
        }} className="nodrag nopan">
          {editing ? (
            <input autoFocus value={draft}
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
      <style>{`@keyframes dashdraw { to { stroke-dashoffset: -10; } }`}</style>
    </>
  )
}

const edgeTypes = { editable: EditableEdge }

// ═══════════════════════════════════════
//  BUILD FLOW FROM BACKEND DIAGRAM
// ═══════════════════════════════════════

const pickHandles = (sourceNode, targetNode, isLoopbackEdge) => {
  if (sourceNode.id === targetNode.id) {
    return { sourceHandle: 's-bottom', targetHandle: 't-bottom' }
  }

  const dLane = targetNode._laneIdx - sourceNode._laneIdx
  const dCol  = targetNode._col - sourceNode._col

  if (isLoopbackEdge) {
    return { sourceHandle: 's-top', targetHandle: 't-top' }
  }

  if (dLane > 0) {
    return Math.abs(dCol) <= 1
      ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
      : { sourceHandle: 's-right',  targetHandle: 't-left' }
  }

  if (dLane < 0) {
    return Math.abs(dCol) <= 1
      ? { sourceHandle: 's-top', targetHandle: 't-bottom' }
      : { sourceHandle: 's-right', targetHandle: 't-left' }
  }

  if (dCol < 0) {
    return { sourceHandle: 's-top', targetHandle: 't-top' }
  }

  return { sourceHandle: 's-right', targetHandle: 't-left' }
}

const TARGET_SPREAD = {
  't-left':   ['t-left',   't-top',    't-bottom', 't-right'],
  't-right':  ['t-right',  't-top',    't-bottom', 't-left'],
  't-top':    ['t-top',    't-left',   't-right',  't-bottom'],
  't-bottom': ['t-bottom', 't-left',   't-right',  't-top'],
}
const SOURCE_SPREAD = {
  's-left':   ['s-left',   's-top',    's-bottom', 's-right'],
  's-right':  ['s-right',  's-top',    's-bottom', 's-left'],
  's-top':    ['s-top',    's-left',   's-right',  's-bottom'],
  's-bottom': ['s-bottom', 's-left',   's-right',  's-top'],
}

const buildFlowFromDiagram = (diagram) => {
  if (!diagram || !diagram.lanes || !diagram.nodes) return { nodes: [], edges: [] }

  const colors = ['#eaf3fb', '#eaf6ef', '#fdf2e6', '#f1ebfa', '#fef6e1', '#fbecf2', '#eef3fb', '#eaf6ef']
  const laneIndexById = Object.fromEntries(diagram.lanes.map((l, i) => [l.id, i]))

 
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'LR',
    nodesep: 30,    
    ranksep: 90,    
    edgesep: 15,
    marginx: 20,
    marginy: 20,
  })
  g.setDefaultEdgeLabel(() => ({}))

  diagram.nodes.forEach(n => {
    const isDecision = n.type === 'decision'
    g.setNode(n.id, {
      width:  isDecision ? 130 : NODE_WIDTH,
      height: isDecision ? 130 : 80,
    })
  })
  ;(diagram.edges || []).forEach(e => {
    if (e.type !== 'loopback') g.setEdge(e.source, e.target)
  })
  dagre.layout(g)

  const nodeMetaById = {}
  const stepNodes = diagram.nodes.map(n => {
    const dagreNode = g.node(n.id)
    const laneIdx = laneIndexById[n.laneId] ?? 0
    const isDecision = n.type === 'decision'
    const width  = isDecision ? 130 : NODE_WIDTH
    const height = isDecision ? 130 : 80
    const x = NODE_START_X + dagreNode.x - width / 2
    const y = laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2 - height / 2

    nodeMetaById[n.id] = { id: n.id, _laneIdx: laneIdx, _xCenter: dagreNode.x }

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

  const nodesByLane = {}
  Object.values(nodeMetaById).forEach(m => {
    nodesByLane[m._laneIdx] = nodesByLane[m._laneIdx] || []
    nodesByLane[m._laneIdx].push(m)
  })
  Object.values(nodesByLane).forEach(arr => {
    arr.sort((a, b) => a._xCenter - b._xCenter)
    arr.forEach((m, i) => { m._col = i })
  })

  const maxX = Math.max(
    ...stepNodes.map(n => n.position.x + (n.style?.width || NODE_WIDTH))
  )
  const laneWidth = Math.max(maxX + 60, NODE_START_X + 400)

  const laneNodes = diagram.lanes.map((lane, i) => ({
    id: lane.id,
    type: 'lane',
    position: { x: 0, y: i * LANE_HEIGHT },
    data: { label: lane.label, color: lane.color || colors[i % colors.length] },
    style: { width: laneWidth, height: LANE_HEIGHT, zIndex: 0 },
    zIndex: 0,
    draggable: false,
    selectable: true,
  }))

  const preliminary = (diagram.edges || []).map(e => {
    const srcMeta = nodeMetaById[e.source]
    const tgtMeta = nodeMetaById[e.target]
    if (!srcMeta || !tgtMeta) {
      return { e, sourceHandle: 's-right', targetHandle: 't-left', isLoopback: false }
    }
    const isLoopback = e.type === 'loopback'
    const { sourceHandle, targetHandle } = pickHandles(srcMeta, tgtMeta, isLoopback)
    return { e, sourceHandle, targetHandle, isLoopback, srcMeta, tgtMeta }
  })

  const incomingCount = {}
  const outgoingCount = {}
  const sourceEdgeCount = {}
  const targetEdgeCount = {}

  const edges = preliminary.map(({ e, sourceHandle, targetHandle, isLoopback, srcMeta, tgtMeta }) => {
    const tKey = `${e.target}|${targetHandle}`
    const tIdx = incomingCount[tKey] = (incomingCount[tKey] ?? -1) + 1
    const targetSides = TARGET_SPREAD[targetHandle] || [targetHandle]
    const finalTargetHandle = targetSides[tIdx % targetSides.length]

    // Spread outgoing
    const sKey = `${e.source}|${sourceHandle}`
    const sIdx = outgoingCount[sKey] = (outgoingCount[sKey] ?? -1) + 1
    const sourceSides = SOURCE_SPREAD[sourceHandle] || [sourceHandle]
    const finalSourceHandle = sourceSides[sIdx % sourceSides.length]

    // Stagger
    sourceEdgeCount[e.source] = (sourceEdgeCount[e.source] ?? -1) + 1
    targetEdgeCount[e.target] = (targetEdgeCount[e.target] ?? -1) + 1
    const offset = sourceEdgeCount[e.source] + targetEdgeCount[e.target]

    // Loopback arc
    let cp1x = 0, cp1y = 0, cp2x = 0, cp2y = 0
    if (isLoopback && srcMeta && tgtMeta) {
      const colSpan = Math.abs(srcMeta._col - tgtMeta._col)
      const archHeight = -(90 + colSpan * 45)
      cp1y = archHeight
      cp2y = archHeight
    }

    const color = isLoopback ? '#d97706' : '#0c447c'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: finalSourceHandle,
      targetHandle: finalTargetHandle,
      type: 'editable',
      data: { label: e.label || '', offset, cp1x, cp1y, cp2x, cp2y },
      animated: isLoopback,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 1.8 },
      zIndex: 5,
    }
  })

  return { nodes: [...laneNodes, ...stepNodes], edges }
}

// ═══════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════
const SwimlaneDiagramInner = ({ diagram, sopTitle, fullscreen = false, initialState = null, showJsonTools = false, showJsonExport = false }) => {
  const initial = useMemo(
    () => initialState || buildFlowFromDiagram(diagram),
    [initialState, diagram]
  )
  const [nodes, setNodes] = useState(initial.nodes)
  const [edges, setEdges] = useState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfTitle, setPdfTitle] = useState('')
  const [, setHistoryTick] = useState(0)
  const flowRef = useRef(null)
  const edgeUpdateSuccessful = useRef(true)
  const { fitView, getNodes, setViewport, getViewport, screenToFlowPosition } = useReactFlow()

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

  const edgeBendChanger = useCallback((edgeId, cp1x, cp1y, cp2x, cp2y) => {
    setEdges(cur => cur.map(x => x.id === edgeId
      ? { ...x, data: { ...x.data, cp1x, cp1y, cp2x, cp2y } }
      : x
    ))
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
        cp1x: e.data?.cp1x ?? 0,
        cp1y: e.data?.cp1y ?? 0,
        cp2x: e.data?.cp2x ?? 0,
        cp2y: e.data?.cp2y ?? 0,
      },
    })))
  }, [])

  useEffect(() => {
    if (showJsonTools) return
    try {
      const { nodes: cleanNodes, edges: cleanEdges } = cloneForHistory(nodes, edges)
      localStorage.setItem('diagram-state', JSON.stringify({ nodes: cleanNodes, edges: cleanEdges, sopTitle }))
    } catch {}
  }, [nodes, edges, sopTitle, showJsonTools])

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
          cp1x: 0,
          cp1y: 0,
          cp2x: 0,
          cp2y: 0,
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
      data: { ...e.data, onChangeBend: edgeBendChanger },
    })),
    [edges, selectedEdgeId, edgeBendChanger]
  )

  const displayedNodes = useMemo(
  () => nodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      onChangeLabel: labelChanger,
      onChangeDescription: descChanger,
      onChangeBottleneck: bottleneckChanger,
    },
  })),
  [nodes, labelChanger, descChanger, bottleneckChanger]
)

  // Helper: lock all lanes, optionally unlock one by id
  const setLaneDraggable = useCallback((unlockId = null) => {
    setNodes(prev => prev.map(n =>
      n.type === 'lane' ? { ...n, draggable: n.id === unlockId } : n
    ))
  }, [])

  const onNodeClick = useCallback((e, node) => {
  setSelectedEdgeId(null)
  setSelectedNodeId(node.type === 'lane' ? null : node.id)
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
        const selectedNodes = getNodes().filter(n => n.selected)
        if (selectedNodes.length > 0) {
          snapshot()
          const ids = new Set(selectedNodes.map(n => n.id))
          setNodes(nds => nds.filter(n => !ids.has(n.id)))
          setEdges(eds => eds.filter(ed => !ids.has(ed.source) && !ids.has(ed.target)))
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
  }, [selectedNodeId, selectedEdgeId, snapshot, undo, redo, getNodes])

  const addNode = (type = 'process') => {
    snapshot()
    const id = `node-${Date.now()}`
    const labels = { process: 'New step', decision: 'New decision?', start: 'Start', end: 'End' }
    const dims = type === 'decision'
      ? { width: 130, height: 130 }
      : type === 'start' || type === 'end'
        ? { width: 140, height: 56 }
        : { width: NODE_WIDTH, height: 80 }

    // Get the visible center of the flow pane in screen coordinates
    const flowWrapper = flowRef.current?.querySelector('.react-flow')
    const rect = flowWrapper?.getBoundingClientRect()
    const centerScreenX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const centerScreenY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

    // Let React Flow convert screen -> flow coordinates using its own tracked transform
    const flowPos = screenToFlowPosition({ x: centerScreenX, y: centerScreenY })

    setNodes(nds => [...nds, {
      id, type,
      position: {
        x: flowPos.x - dims.width / 2,
        y: flowPos.y - dims.height / 2,
      },
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

  const toggleBottleneck = useCallback(() => {
    if (!selectedNodeId) return
    const node = nodes.find(n => n.id === selectedNodeId)
    if (!node || node.type === 'lane') return
    snapshot()
    setNodes(cur => cur.map(n =>
      n.id === selectedNodeId
        ? { ...n, data: { ...n.data, flag: !n.data.flag } }
        : n
    ))
  }, [selectedNodeId, nodes, snapshot])



  const addLane = () => {
    snapshot()
    const id = `lane-${Date.now()}`
    const colors = ['#eaf3fb', '#eaf6ef', '#fdf2e6', '#f1ebfa', '#fef6e1', '#fbecf2', '#eef3fb', '#eaf6ef']
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

  const openPdfModal = () => {
  setPdfTitle(sopTitle || 'Process Swimlane Diagram')
  //setPdfSubtitle(`Generated ${new Date().toLocaleDateString()}`)
  setPdfModalOpen(true)
}

const handleExportPDF = async () => {
    setPdfModalOpen(false)
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
      pdf.text(pdfTitle, 15, 15)
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
      pdf.save(`${(pdfTitle || 'process-diagram').replace(/\s+/g, '-').toLowerCase()}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('Could not export diagram to PDF. Please try again.')
      setViewport(originalViewport, { duration: 0 })
    }
    setExporting(false)
  }

  const fileInputRef = useRef(null)

  const handleExportJSON = () => {
    try {
      const { nodes: cleanNodes, edges: cleanEdges } = cloneForHistory(nodes, edges)
      const payload = {
        version: 1,
        type: 'swimlane-diagram',
        sopTitle: sopTitle || 'Process Diagram',
        exportedAt: new Date().toISOString(),
        nodes: cleanNodes,
        edges: cleanEdges,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(sopTitle || 'process-diagram').replace(/\s+/g, '-').toLowerCase()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('JSON export failed:', err)
      alert('Could not export diagram to JSON. Please try again.')
    }
  }

  const handleExportLucidCSV = () => {
    try {
      const shapeNodes = nodes.filter(n => n.type !== 'lane')
      const laneNodes  = nodes
        .filter(n => n.type === 'lane')
        .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))

      if (shapeNodes.length === 0) {
        alert('Nothing to export.')
        return
      }

      const SHAPE_LIBRARY = 'Flowchart Shapes'
      const lucidShape = (type) => {
        switch (type) {
          case 'decision': return 'Decision'
          case 'start':
          case 'end':      return 'Terminator'
          default:         return 'Process'
        }
      }

      const esc = (val) => {
        const s = String(val ?? '')
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }

      const laneColById = {}
      laneNodes.forEach((l, i) => { laneColById[l.id] = i + 1 })
      const laneCount = Math.max(laneNodes.length, 1)

      let nextId = 1
      const PAGE_ID    = nextId++   // 1
      const SWIMLANE_ID = nextId++  // 2
      const shapeIdById = {}        // reactflow node id -> csv id
      shapeNodes.forEach(n => { shapeIdById[n.id] = nextId++ })

      const laneColOf = (node) => {
        if (laneNodes.length === 0) return 1
        const ny = node.position?.y ?? 0
        let best = null
        let bestDist = Infinity
        for (const lane of laneNodes) {
          const top = lane.position?.y ?? 0
          const h = lane.style?.height ?? LANE_HEIGHT
          if (ny >= top && ny < top + h) return laneColById[lane.id]
          const dist = Math.abs(ny - (top + h / 2))
          if (dist < bestDist) { bestDist = dist; best = laneColById[lane.id] }
        }
        return best || 1
      }

      const textAreaCount = Math.max(laneCount, 1)
      const header = [
        'Id', 'Name', 'Shape Library', 'Page ID', 'Contained By',
        'Line Source', 'Line Destination', 'Source Arrow', 'Destination Arrow',
        ...Array.from({ length: textAreaCount }, (_, i) => `Text Area ${i + 1}`),
      ]
      const FIXED_COLS = 9                       
      const blankTextAreas = Array(textAreaCount).fill('')

      const makeRow = (fixed, textAreas) => {
        const tas = blankTextAreas.slice()
        textAreas.forEach((v, i) => { if (i < tas.length) tas[i] = v })
        return [...fixed, ...tas]
      }

      const rows = []

      rows.push(makeRow([PAGE_ID, 'Page', '', '', '', '', '', '', ''], []))

      const laneLabels = laneNodes.length
        ? laneNodes.map(l => l.data?.label || 'Lane')
        : ['Lane']
      rows.push(makeRow(
        [SWIMLANE_ID, 'Swim Lane', SHAPE_LIBRARY, PAGE_ID, '', '', '', '', ''],
        laneLabels,
      ))

      shapeNodes.forEach(n => {
        const col = laneColOf(n)
        rows.push(makeRow(
          [
            shapeIdById[n.id], lucidShape(n.type), SHAPE_LIBRARY, PAGE_ID,
            `${SWIMLANE_ID}:${col}`,
            '', '', '', '',
          ],
          [n.data?.label || ''],
        ))
      })

      // 4) Line rows — reference shapes by Id; label in Text Area 1.
      edges.forEach(e => {
        const src = shapeIdById[e.source]
        const dst = shapeIdById[e.target]
        if (src == null || dst == null) return // skip dangling edges
        rows.push(makeRow(
          [nextId++, 'Line', SHAPE_LIBRARY, PAGE_ID, '', src, dst, 'None', 'Arrow'],
          [e.data?.label || ''],
        ))
      })

      const csv = [header, ...rows]
        .map(row => row.map(esc).join(','))
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(sopTitle || 'process-diagram').replace(/\s+/g, '-').toLowerCase()}-lucid.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Lucid CSV export failed:', err)
      alert('Could not export for Lucidchart. Please try again.')
    }
  }

  const handleImportMultipleJSON = (files) => {
        if (!files || files.length === 0) return

        const readFile = (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              try {
                const parsed = JSON.parse(reader.result)
                if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges))
                  throw new Error('shape')
                resolve(parsed)
              } catch {
                reject(new Error(`Invalid JSON in file: ${file.name}`))
              }
            }
            reader.onerror = () => reject(new Error(`Could not read: ${file.name}`))
            reader.readAsText(file)
          })

        Promise.all(files.map(readFile))
          .then((diagrams) => {
            snapshot() // single undo point for the whole import

            // Start below the lowest existing node
            const existingBottom = nodes.reduce((max, n) => {
              const bottom = (n.position?.y ?? 0) + (n.style?.height ?? LANE_HEIGHT)
              return Math.max(max, bottom)
            }, 0)

            const VERTICAL_GAP = 60
            let cursor = existingBottom > 0 ? existingBottom + VERTICAL_GAP : 0

            let mergedNodes = [...nodes]
            let mergedEdges = [...edges]

            diagrams.forEach((parsed, fileIndex) => {
              // Find the top-most Y in this diagram so we can normalise it to 0
              const minY = Math.min(...parsed.nodes.map(n => n.position?.y ?? 0))
              const yOffset = cursor - minY

              // Give every node/edge a unique ID suffix to avoid collisions
              const suffix = `_imp${Date.now()}_${fileIndex}`
              const idMap = {}   // old id → new id

              const remappedNodes = parsed.nodes.map(n => {
                const newId = n.id + suffix
                idMap[n.id] = newId
                return {
                  ...n,
                  id: newId,
                  position: { x: n.position.x, y: (n.position?.y ?? 0) + yOffset },
                  // lanes are not draggable by default
                  draggable: n.type === 'lane' ? false : n.draggable,
                }
              })

              const remappedEdges = parsed.edges.map(e => ({
                ...e,
                id: e.id + suffix,
                source: idMap[e.source] ?? e.source + suffix,
                target: idMap[e.target] ?? e.target + suffix,
                data: {
                  ...e.data,
                  cp1x: e.data?.cp1x ?? 0,
                  cp1y: e.data?.cp1y ?? 0,
                  cp2x: e.data?.cp2x ?? 0,
                  cp2y: e.data?.cp2y ?? 0,
                },
              }))

              // Advance cursor past this diagram's height
              const diagramBottom = Math.max(
                ...remappedNodes.map(n => (n.position?.y ?? 0) + (n.style?.height ?? LANE_HEIGHT))
              )
              cursor = diagramBottom + VERTICAL_GAP

              mergedNodes = [...mergedNodes, ...remappedNodes]
              mergedEdges = [...mergedEdges, ...remappedEdges]
            })

            const rewired = rewireCallbacks(mergedNodes, mergedEdges)
            setNodes(rewired.nodes)
            setEdges(rewired.edges)
            setSelectedNodeId(null)
            setSelectedEdgeId(null)
            setTimeout(() => fitView({ padding: 0.15 }), 100)
          })
          .catch((err) => {
            console.error('JSON import failed:', err)
            alert(err.message || 'Could not read one or more files. Please choose valid diagram JSON files.')
          })
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
          {(() => {
            const selectedNode = nodes.find(n => n.id === selectedNodeId && n.type !== 'lane')
            const hasFlag = selectedNode?.data?.flag
            return (
              <button
                onClick={toggleBottleneck}
                disabled={!selectedNode}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  hasFlag
                    ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                    : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                }`}
                title={
                  !selectedNode
                    ? 'Select a shape first'
                    : hasFlag
                      ? 'Remove bottleneck from selected shape'
                      : 'Mark selected shape as a bottleneck'
                }
              >
                {hasFlag ? '✕ Remove bottleneck' : '⚠ Bottleneck'}
              </button>
            )
          })()}
          <button onClick={() => fitView({ padding: 0.2 })} className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">⊡ Fit view</button>
        </div>
        <div className="flex gap-2">
          {showJsonTools && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                  if (files.length > 0) handleImportMultipleJSON(files)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs md:text-sm px-4 py-1.5 bg-white border border-[#b8dcf8] text-[#00528d] rounded-lg hover:bg-[#e8f4ff] transition-colors"
                title="Load a diagram JSON to keep editing"
              >
                ↑ Import JSON
              </button>
            </>
          )}
          {(showJsonTools || showJsonExport) && (
            <button
              onClick={handleExportJSON}
              className="text-xs md:text-sm px-4 py-1.5 bg-white border border-[#b8dcf8] text-[#00528d] rounded-lg hover:bg-[#e8f4ff] transition-colors"
              title="Download as editable JSON"
            >
              ↓ Export JSON
            </button>
          )}
          {(showJsonTools || showJsonExport) && (
            <button
              onClick={handleExportLucidCSV}
              className="text-xs md:text-sm px-4 py-1.5 bg-white border border-[#b8dcf8] text-[#00528d] rounded-lg hover:bg-[#e8f4ff] transition-colors"
              title="Download a CSV for Lucidchart (New ▸ Import ▸ Process diagram from CSV). Tip: lanes import vertically — select the pool in Lucid to switch to horizontal."
            >
              ↓ Lucid (CSV)
            </button>
          )}
          {!fullscreen && (
            <button onClick={openFullscreen} className="text-xs md:text-sm px-4 py-1.5 bg-white border border-[#b8dcf8] text-[#00528d] rounded-lg hover:bg-[#e8f4ff] transition-colors" title="Open in new tab for more space">
              ⛶ Open fullscreen
            </button>
          )}
          <button onClick={openPdfModal} disabled={exporting} className="text-xs md:text-sm px-4 py-1.5 bg-[#00528d] text-white rounded-lg hover:bg-[#003f6e] transition-colors disabled:opacity-50">
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
          {(selectedEdge?.data?.cp1x || selectedEdge?.data?.cp1y || selectedEdge?.data?.cp2x || selectedEdge?.data?.cp2y) && (
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
        onContextMenu={e => e.preventDefault()}
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
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"      
          selectionOnDrag
          panOnDrag={[1, 2]} 
        >
          <Background color="#e8f4ff" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={n => n.type === 'decision' ? '#d8b4fe' : n.type === 'start' ? '#86efac' : n.type === 'end' ? '#fdba74' : n.type === 'lane' ? '#e8f4ff' : '#b8dcf8'}
            pannable zoomable
          />
        </ReactFlow>
      </div>
      {/* PDF Export Modal */}
          {pdfModalOpen && (
            <div 
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" 
              onMouseDown={(e) => {
                // Only close if clicking directly on the backdrop, not on children
                if (e.target === e.currentTarget) {
                  setPdfModalOpen(false)
                }
              }}
            >
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-[#00528d] mb-4">Export to PDF</h3>
                
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={e => setPdfTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 outline-none focus:border-[#00528d]"
                  placeholder="Process Swimlane Diagram"
                />
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPdfModalOpen(false)}
                    className="text-xs md:text-sm px-4 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="text-xs md:text-sm px-4 py-1.5 bg-[#00528d] text-white rounded-lg hover:bg-[#003f6e] transition-colors"
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
          )}
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
            showJsonExport
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

// ═══════════════════════════════════════
//  BLANK BUILDER
// ═══════════════════════════════════════
const makeBlankState = () => ({
  nodes: [
    {
      id: 'lane-1',
      type: 'lane',
      position: { x: 0, y: 0 },
      data: { label: 'Lane 1', color: '#eaf3fb' },
      style: { width: 900, height: LANE_HEIGHT, zIndex: 0 },
      zIndex: 0,
      draggable: false,
      selectable: true,
    },
  ],
  edges: [],
})

export const BlankBuilder = () => {
  const initialState = useMemo(() => makeBlankState(), [])

  return (
    <ReactFlowProvider>
      <div className="min-h-screen bg-[#d9efff] p-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-xl text-[#00528d]">Build a Process Diagram</h2>
            <span className="text-xs text-[#5a8aaa]">
              Changes are not saved — export to JSON before closing this tab.
            </span>
          </div>
          <SwimlaneDiagramInner
            diagram={null}
            sopTitle="Process Diagram"
            fullscreen
            showJsonTools
            initialState={initialState}
          />
        </div>
      </div>
      <Footer />
    </ReactFlowProvider>
  )
}

export default SwimlaneDiagram
