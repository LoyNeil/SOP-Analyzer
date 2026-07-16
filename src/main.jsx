import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { FullscreenDiagram, BlankBuilder } from './Swimlanediagram.jsx'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

const renderForView = () => {
  if (view === 'diagram') return <FullscreenDiagram />
  if (view === 'builder') return <BlankBuilder />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {renderForView()}
  </StrictMode>,
)
