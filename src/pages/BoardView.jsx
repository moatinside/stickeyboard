import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useHistory from '../hooks/useHistory'

const CANVAS_SIZE = 5000
const NOTE_WIDTH = 160
const NOTE_HEIGHT = 100
const DRAG_THRESHOLD = 5
const MIN_ZOOM = 0.2
const MAX_ZOOM = 3

const COLORS = {
  yellow: '#FFF176',
  pink: '#F48FB1',
  blue: '#81D4FA',
  green: '#A5D6A7',
}
const COLOR_KEYS = ['yellow', 'pink', 'blue', 'green']
const COLOR_LABELS = { yellow: '黄', pink: 'ピンク', blue: '水色', green: '緑' }

function getConnectionEndpoints(fromNote, toNote) {
  const cx1 = fromNote.x + NOTE_WIDTH / 2, cy1 = fromNote.y + NOTE_HEIGHT / 2
  const cx2 = toNote.x + NOTE_WIDTH / 2, cy2 = toNote.y + NOTE_HEIGHT / 2
  const dx = cx2 - cx1, dy = cy2 - cy1
  let from, to
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) { from = { x: fromNote.x + NOTE_WIDTH, y: cy1 }; to = { x: toNote.x, y: cy2 } }
    else { from = { x: fromNote.x, y: cy1 }; to = { x: toNote.x + NOTE_WIDTH, y: cy2 } }
  } else {
    if (dy > 0) { from = { x: cx1, y: fromNote.y + NOTE_HEIGHT }; to = { x: cx2, y: toNote.y } }
    else { from = { x: cx1, y: fromNote.y }; to = { x: cx2, y: toNote.y + NOTE_HEIGHT } }
  }
  return { from, to }
}

function getConnPointPosition(note, side) {
  switch (side) {
    case 'top': return { x: note.x + NOTE_WIDTH / 2, y: note.y }
    case 'right': return { x: note.x + NOTE_WIDTH, y: note.y + NOTE_HEIGHT / 2 }
    case 'bottom': return { x: note.x + NOTE_WIDTH / 2, y: note.y + NOTE_HEIGHT }
    case 'left': return { x: note.x, y: note.y + NOTE_HEIGHT / 2 }
    default: return { x: note.x, y: note.y }
  }
}

function findNoteAtPosition(x, y, notes, excludeId) {
  return notes.find(n => n.id !== excludeId && x >= n.x && x <= n.x + NOTE_WIDTH && y >= n.y && y <= n.y + NOTE_HEIGHT)
}

export default function BoardView() {
  const { boardId } = useParams()
  const navigate = useNavigate()
  const boardMeta = useMemo(() => { try { return JSON.parse(localStorage.getItem('boards_index') || '[]').find(b => b.id === boardId) } catch { return null } }, [boardId])
  const initialData = useMemo(() => { try { const s = localStorage.getItem('board_' + boardId); return s ? JSON.parse(s) : { notes: [], connections: [] } } catch { return { notes: [], connections: [] } } }, [boardId])
  const { state, pushState, undo, redo, canUndo, canRedo } = useHistory(initialData)
  const [zoom, setZoom] = useState(1)
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [editText, setEditText] = useState('')
  const [currentColor, setCurrentColor] = useState('yellow')
  const [dragOffset, setDragOffset] = useState(null)
  const [connecting, setConnecting] = useState(null)
  const containerRef = useRef(null)
  const pendingScrollRef = useRef(null)
  const dragRef = useRef(null)
  const hasInitScrolled = useRef(false)
  const activeNoteIdRef = useRef(activeNoteId); activeNoteIdRef.current = activeNoteId
  const editTextRef = useRef(editText); editTextRef.current = editText
  const stateRef = useRef(state); stateRef.current = state
  const zoomRef = useRef(zoom); zoomRef.current = zoom
  const connectingRef = useRef(connecting); connectingRef.current = connecting

  useEffect(() => { localStorage.setItem('board_' + boardId, JSON.stringify(state)) }, [state, boardId])
  useEffect(() => { if (hasInitScrolled.current) return; const c = containerRef.current; if (c) { c.scrollLeft = (CANVAS_SIZE * zoom - c.clientWidth) / 2; c.scrollTop = (CANVAS_SIZE * zoom - c.clientHeight) / 2; hasInitScrolled.current = true } }, [zoom])
  useEffect(() => { if (pendingScrollRef.current && containerRef.current) { containerRef.current.scrollLeft = pendingScrollRef.current.scrollLeft; containerRef.current.scrollTop = pendingScrollRef.current.scrollTop; pendingScrollRef.current = null } })

  const screenToCanvas = useCallback((cx, cy) => { const c = containerRef.current; if (!c) return { x: 0, y: 0 }; const r = c.getBoundingClientRect(); return { x: (cx - r.left + c.scrollLeft) / zoomRef.current, y: (cy - r.top + c.scrollTop) / zoomRef.current } }, [])
  const commitEdit = useCallback(() => { const nid = activeNoteIdRef.current; if (!nid) return; const cs = stateRef.current; const n = cs.notes.find(n => n.id === nid); if (n && n.text !== editTextRef.current) { pushState({ ...cs, notes: cs.notes.map(n => n.id === nid ? { ...n, text: editTextRef.current } : n) }) } }, [pushState])
  const activateNote = useCallback((nid) => { if (activeNoteIdRef.current && activeNoteIdRef.current !== nid) commitEdit(); const n = stateRef.current.notes.find(n => n.id === nid); if (n) { setEditText(n.text); setActiveNoteId(nid) } }, [commitEdit])
  const deactivateNote = useCallback(() => { commitEdit(); setActiveNoteId(null); setEditText('') }, [commitEdit])

  const handleCanvasDoubleClick = useCallback((e) => {
    if (e.target.closest('.note')) return
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    const newNote = { id: crypto.randomUUID(), text: '', color: currentColor, x: x - NOTE_WIDTH / 2, y: y - NOTE_HEIGHT / 2 }
    const cs = stateRef.current; let notes = cs.notes
    if (activeNoteIdRef.current) { const a = notes.find(n => n.id === activeNoteIdRef.current); if (a && a.text !== editTextRef.current) notes = notes.map(n => n.id === activeNoteIdRef.current ? { ...n, text: editTextRef.current } : n) }
    pushState({ ...cs, notes: [...notes, newNote] }); setActiveNoteId(newNote.id); setEditText('')
  }, [screenToCanvas, currentColor, pushState])

  const handleCanvasClick = useCallback((e) => { if (e.target.closest('.note')) return; if (e.detail === 2) return; deactivateNote() }, [deactivateNote])
  const handleNoteMouseDown = useCallback((e, note) => { if (e.target.closest('textarea') || e.target.closest('.note-delete') || e.target.closest('.conn-point')) return; e.stopPropagation(); const { x, y } = screenToCanvas(e.clientX, e.clientY); dragRef.current = { noteId: note.id, startCanvasX: x, startCanvasY: y, origNoteX: note.x, origNoteY: note.y, isDragging: false } }, [screenToCanvas])
  const handleConnStart = useCallback((e, noteId, side) => { e.stopPropagation(); e.preventDefault(); const n = stateRef.current.notes.find(n => n.id === noteId); if (!n) return; const p = getConnPointPosition(n, side); setConnecting({ fromNoteId: noteId, startX: p.x, startY: p.y, currentX: p.x, currentY: p.y }) }, [])
  const handleDeleteNote = useCallback((noteId) => { const cs = stateRef.current; pushState({ notes: cs.notes.filter(n => n.id !== noteId), connections: cs.connections.filter(c => c.fromNoteId !== noteId && c.toNoteId !== noteId) }); if (activeNoteIdRef.current === noteId) { setActiveNoteId(null); setEditText('') } }, [pushState])
  const handleDeleteConnection = useCallback((connId) => { const cs = stateRef.current; pushState({ ...cs, connections: cs.connections.filter(c => c.id !== connId) }) }, [pushState])
  const handleColorClick = useCallback((color) => { setCurrentColor(color); if (activeNoteIdRef.current) { const cs = stateRef.current; pushState({ ...cs, notes: cs.notes.map(n => n.id === activeNoteIdRef.current ? { ...n, text: editTextRef.current, color } : n) }) } }, [pushState])
  const performUndo = useCallback(() => { if (activeNoteIdRef.current) { commitEdit(); setActiveNoteId(null); setEditText('') } undo() }, [commitEdit, undo])
  const performRedo = useCallback(() => { if (activeNoteIdRef.current) { commitEdit(); setActiveNoteId(null); setEditText('') } redo() }, [commitEdit, redo])

  useEffect(() => {
    const onMove = (e) => {
      if (dragRef.current) { const { x, y } = screenToCanvas(e.clientX, e.clientY); const dx = x - dragRef.current.startCanvasX, dy = y - dragRef.current.startCanvasY; if (!dragRef.current.isDragging) { if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.isDragging = true; else return }; setDragOffset({ noteId: dragRef.current.noteId, dx, dy }) }
      if (connectingRef.current) { const { x, y } = screenToCanvas(e.clientX, e.clientY); setConnecting(p => p ? { ...p, currentX: x, currentY: y } : null) }
    }
    const onUp = (e) => {
      if (dragRef.current) { if (dragRef.current.isDragging) { const { x, y } = screenToCanvas(e.clientX, e.clientY); const dx = x - dragRef.current.startCanvasX, dy = y - dragRef.current.startCanvasY; const nid = dragRef.current.noteId; const cs = stateRef.current; pushState({ ...cs, notes: cs.notes.map(n => n.id === nid ? { ...n, text: n.id === activeNoteIdRef.current ? editTextRef.current : n.text, x: Math.max(0, n.x + dx), y: Math.max(0, n.y + dy) } : n) }); setDragOffset(null) } else { activateNote(dragRef.current.noteId) }; dragRef.current = null }
      if (connectingRef.current) { const { x, y } = screenToCanvas(e.clientX, e.clientY); const cs = stateRef.current; const t = findNoteAtPosition(x, y, cs.notes, connectingRef.current.fromNoteId); if (t) { const exists = cs.connections.some(c => c.fromNoteId === connectingRef.current.fromNoteId && c.toNoteId === t.id); if (!exists) pushState({ ...cs, connections: [...cs.connections, { id: crypto.randomUUID(), fromNoteId: connectingRef.current.fromNoteId, toNoteId: t.id }] }) }; setConnecting(null) }
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [screenToCanvas, pushState, activateNote])

  useEffect(() => {
    const onKey = (e) => { const ta = document.activeElement.tagName === 'TEXTAREA'; if (e.ctrlKey && e.key === 'z') { if (ta) return; e.preventDefault(); performUndo() }; if (e.ctrlKey && e.key === 'y') { if (ta) return; e.preventDefault(); performRedo() }; if (e.key === 'Escape') deactivateNote(); if ((e.key === 'Delete' || e.key === 'Backspace') && activeNoteIdRef.current && !ta) handleDeleteNote(activeNoteIdRef.current) }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [performUndo, performRedo, deactivateNote, handleDeleteNote])

  useEffect(() => {
    const c = containerRef.current; if (!c) return
    const onWheel = (e) => { e.preventDefault(); const r = c.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const cz = zoomRef.current; const lx = (c.scrollLeft + mx) / cz, ly = (c.scrollTop + my) / cz; const f = e.deltaY > 0 ? 0.9 : 1.1; const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cz * f)); pendingScrollRef.current = { scrollLeft: lx * nz - mx, scrollTop: ly * nz - my }; setZoom(nz) }
    c.addEventListener('wheel', onWheel, { passive: false }); return () => c.removeEventListener('wheel', onWheel)
  }, [])

  const getNotePosition = (note) => { if (dragOffset && dragOffset.noteId === note.id) return { x: Math.max(0, note.x + dragOffset.dx), y: Math.max(0, note.y + dragOffset.dy) }; return { x: note.x, y: note.y } }

  if (!boardMeta) return (<div className="board-not-found"><p>ボードが見つかりません</p><button className="btn-primary" onClick={() => navigate('/')}>戻る</button></div>)

  return (
    <div className="board-view">
      <div className="board-header">
        <div className="header-left"><button className="btn-back" onClick={() => { deactivateNote(); navigate('/') }}>🔙 戻る</button><h2>{boardMeta.title}</h2></div>
        <div className="header-center"><div className="color-picker">{COLOR_KEYS.map(color => (<button key={color} className={'color-btn' + (currentColor === color ? ' active' : '')} style={{ backgroundColor: COLORS[color] }} onClick={() => handleColorClick(color)} title={COLOR_LABELS[color]} />))}</div></div>
        <div className="header-right"><button className="btn-icon" onClick={performUndo} disabled={!canUndo} title="元に戻す">↩️</button><button className="btn-icon" onClick={performRedo} disabled={!canRedo} title="やり直す">↪️</button><span className="zoom-label">{Math.round(zoom * 100)}%</span></div>
      </div>
      <div className="canvas-viewport" ref={containerRef}>
        <div className="canvas-sizer" style={{ width: CANVAS_SIZE * zoom, height: CANVAS_SIZE * zoom }}>
          <div className="canvas" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, transform: 'scale(' + zoom + ')', transformOrigin: '0 0' }} onClick={handleCanvasClick} onDoubleClick={handleCanvasDoubleClick}>
            <svg className="arrows-layer" width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ pointerEvents: 'none' }}>
              <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#666" /></marker></defs>
              {state.connections.map(conn => { const fn = state.notes.find(n => n.id === conn.fromNoteId); const tn = state.notes.find(n => n.id === conn.toNoteId); if (!fn || !tn) return null; const fp = getNotePosition(fn); const tp = getNotePosition(tn); const { from, to } = getConnectionEndpoints({ ...fn, ...fp }, { ...tn, ...tp }); const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2; return (<g key={conn.id} className="arrow-group"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#666" strokeWidth={2} markerEnd="url(#arrowhead)" /><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer', pointerEvents: 'auto' }} onClick={e => { e.stopPropagation(); handleDeleteConnection(conn.id) }} /><g className="arrow-delete" onClick={e => { e.stopPropagation(); handleDeleteConnection(conn.id) }} style={{ cursor: 'pointer', pointerEvents: 'auto' }}><circle cx={mx} cy={my} r={10} fill="white" stroke="#ccc" strokeWidth={1} /><text x={mx} y={my + 5} textAnchor="middle" fontSize="14" fill="#999">x</text></g></g>) })}
              {connecting && <line x1={connecting.startX} y1={connecting.startY} x2={connecting.currentX} y2={connecting.currentY} stroke="#999" strokeWidth={2} strokeDasharray="6,4" pointerEvents="none" />}
            </svg>
            {state.notes.map(note => { const isActive = activeNoteId === note.id; const pos = getNotePosition(note); return (<div key={note.id} className={'note' + (isActive ? ' active' : '')} style={{ position: 'absolute', left: pos.x, top: pos.y, width: NOTE_WIDTH, height: NOTE_HEIGHT, backgroundColor: COLORS[note.color] }} onMouseDown={e => handleNoteMouseDown(e, note)} onDoubleClick={e => e.stopPropagation()}>{isActive ? <textarea className="note-textarea" value={editText} onChange={e => setEditText(e.target.value)} onMouseDown={e => e.stopPropagation()} placeholder="テキストを入力..." autoFocus /> : <div className="note-text">{note.text || <span className="note-placeholder">クリックして編集</span>}</div>}{isActive && <button className="note-delete" onClick={e => { e.stopPropagation(); handleDeleteNote(note.id) }} title="削除">🗑️</button>}<div className="connection-points">{['top','right','bottom','left'].map(side => <div key={side} className={'conn-point conn-' + side} onMouseDown={e => handleConnStart(e, note.id, side)} />)}</div></div>) })}
          </div>
        </div>
      </div>
      <div className="board-footer">ダブルクリックで付箋を追加 | ホイールでズーム | Ctrl+Z で元に戻す</div>
    </div>
  )
}
