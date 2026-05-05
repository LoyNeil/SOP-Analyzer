const API_BASE = 'http://localhost:8000'

/**
 * Existing function — unchanged.
 * Sends a Zoom transcript (.vtt / .txt) to /analyse.
 */
export const analyseTranscript = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/analyse`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

/**
 * New function — sends a SOP document (.docx / .pdf / .txt) to /analyse-sop.
 *
 * @param {File}     file     - The uploaded SOP file
 * @param {string[]} intents  - Array of requested outputs:
 *                              'restructure' | 'diagram' | 'bottlenecks'
 * @returns {Promise<object>} - Combined response from the server
 */
export const analyseSopDocument = async (file, intents = ['restructure', 'diagram', 'bottlenecks']) => {
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

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  // Normalise: if only 'diagram' or 'bottlenecks' were requested (no restructure),
  // inject a minimal sop shell so Results.jsx doesn't crash on missing data.
  if (!data.sop) {
    data.sop = {
      title:         'SOP Document',
      generated_from:'sop_document',
      date:          '',
      version:       '',
      tags:          [],
      purpose:       '',
      scope:         '',
      roles:         [],
      prerequisites: [],
      start_state:   '',
      end_state:     '',
      steps:         [],
    }
  }

  return data
}
