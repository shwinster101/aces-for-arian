import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import AdminApp from './AdminApp.jsx'
import ErrorBoundary from '../ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </StrictMode>,
)
