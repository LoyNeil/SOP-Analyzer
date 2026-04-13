export const analyseTranscript = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('http://127.0.0.1:8000/analyse', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to analyse transcript')
  }

  return await response.json()
}