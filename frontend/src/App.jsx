import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { OrderProvider } from './context/OrderContext'
import { loadMenuData } from './data/menu'
import { loadTables } from './data/tables'
import { loadChatbotFaqs } from './components/chatbot/chatbotResponses'
import IntroSplash from './components/layout/IntroSplash'
import TablePage from './pages/TablePage'
import TableNotFound from './pages/TableNotFound'
import { AdminAuthProvider } from './admin/AdminAuthContext'
import AdminLayout from './admin/AdminLayout'
import AdminLogin from './admin/AdminLogin'
import AdminOverview from './admin/pages/AdminOverview'
import AdminMenu from './admin/pages/AdminMenu'
import AdminTables from './admin/pages/AdminTables'
import AdminChatbot from './admin/pages/AdminChatbot'
import AdminOrders from './admin/pages/AdminOrders'

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<CustomerApp />} />
    </Routes>
  )
}

// The customer-facing ordering flow — QR code lands here. Kept inside the
// constrained "phone shell" (see the outer div below) so it looks right
// both on an actual phone and when shown on a laptop during a demo.
function CustomerApp() {
  const [introDone, setIntroDone] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    Promise.all([loadMenuData(), loadTables(), loadChatbotFaqs()]).finally(() => setDataLoaded(true))
  }, [])

  return (
    <div className="relative mx-auto h-dvh w-full max-w-md overflow-hidden bg-ink sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[2.5rem] sm:shadow-2xl sm:shadow-black/60 sm:ring-1 sm:ring-line">
      {!introDone || !dataLoaded ? (
        <IntroSplash onFinish={() => setIntroDone(true)} />
      ) : (
        <CartProvider>
          <OrderProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/table/1" replace />} />
              <Route path="/table/:tableId" element={<TablePage />} />
              <Route path="*" element={<TableNotFound />} />
            </Routes>
          </OrderProvider>
        </CartProvider>
      )}
    </div>
  )
}

// The staff dashboard — full width, not squeezed into the phone shell,
// since this is meant to be used on a laptop or tablet in the restaurant.
function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="tables" element={<AdminTables />} />
          <Route path="chatbot" element={<AdminChatbot />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
