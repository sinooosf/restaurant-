import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { AdminAuthProvider } from './admin/AdminAuthContext'
import AdminLayout from './admin/AdminLayout'
import AdminLogin from './admin/AdminLogin'
import { Spinner } from './admin/components/ui'

// Each dashboard page is downloaded only when it is opened.
const AdminOverview = lazy(() => import('./admin/pages/AdminOverview'))
const AdminMenu = lazy(() => import('./admin/pages/AdminMenu'))
const AdminTables = lazy(() => import('./admin/pages/AdminTables'))
const AdminChatbot = lazy(() => import('./admin/pages/AdminChatbot'))
const AdminOrders = lazy(() => import('./admin/pages/AdminOrders'))
const AdminReports = lazy(() => import('./admin/pages/AdminReports'))
const AdminNewOrder = lazy(() => import('./admin/pages/AdminNewOrder'))

const page = (element) => (
  <Suspense fallback={<div className="flex justify-center py-24"><Spinner /></div>}>{element}</Suspense>
)

// The staff dashboard — full width, not squeezed into the phone shell,
// since this is meant to be used on a laptop or tablet in the restaurant.
export default function AdminApp() {
  return (
    <LanguageProvider scope="admin">
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route index element={page(<AdminOverview />)} />
          <Route path="new-order" element={page(<AdminNewOrder />)} />
          <Route path="orders" element={page(<AdminOrders />)} />
          <Route path="reports" element={page(<AdminReports />)} />
          <Route path="menu" element={page(<AdminMenu />)} />
          <Route path="tables" element={page(<AdminTables />)} />
          <Route path="chatbot" element={page(<AdminChatbot />)} />
        </Route>
      </Routes>
    </AdminAuthProvider>
    </LanguageProvider>
  )
}
