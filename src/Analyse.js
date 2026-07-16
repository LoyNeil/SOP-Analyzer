{/*const API_BASE = import.meta.env.VITE_API_BASE || '/api'*/}
const API_BASE = 'http://localhost:8000'

/**
 * @param {File} file
 * @param {(eventName: string, payload: object) => void} onEvent
 * @returns {Promise<void>}
 */
export const analyseTranscript = async (file, onEvent) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/analyse`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`)
  }

  await consumeSseStream(response, onEvent)
}

/**
 * @param {File}     file
 * @param {string[]} intents
 * @param {(eventName: string, payload: object) => void} onEvent
 */
export const analyseSopDocument = async (file, intents = ['restructure', 'diagram', 'bottlenecks'], onEvent) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('intents', intents.join(','))

  const response = await fetch(`${API_BASE}/analyse-sop`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`)
  }

  await consumeSseStream(response, onEvent)
}

// ─────────────────────────────────────────
//  SSE parser
// ─────────────────────────────────────────

const consumeSseStream = async (response, onEvent) => {
  const reader  = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const parsed = parseSseEvent(rawEvent)
      if (parsed) onEvent(parsed.event, parsed.data)
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseEvent(buffer)
    if (parsed) onEvent(parsed.event, parsed.data)
  }
}

const parseSseEvent = (raw) => {
  let event = 'message'
  const dataLines = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (dataLines.length === 0) return null
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch (e) {
    console.error('Bad SSE payload:', dataLines.join('\n'))
    return null
  }
}
