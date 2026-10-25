import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'

// The customer app and the dashboard are separate downloads: a phone scanning
// a QR code never loads the dashboard, and the dashboard never loads the menu.
const CustomerApp = lazy(() => import('./CustomerApp'))
const AdminApp = lazy(() => import('./AdminApp'))

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#09090b]" />}>
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<CustomerApp />} />
    </Routes>
    </Suspense>
  )
}

