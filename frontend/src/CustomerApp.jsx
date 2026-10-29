import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { OrderProvider } from './context/OrderContext'
import { WaiterProvider } from './context/WaiterContext'
import { CATEGORIES, MENU_ITEMS, loadMenuData } from './data/menu'
import { preloadImages } from './utils/preloadImages'
import { DELIVERY_PATH, HOME_PATH, loadTables } from './data/tables'
import { loadChatbotFaqs } from './components/chatbot/chatbotResponses'
import IntroSplash from './components/layout/IntroSplash'
import LanguageChooser from './components/layout/LanguageChooser'
import { LanguageProvider, useLanguage } from './i18n/LanguageContext'
import TablePage from './pages/TablePage'
import TableNotFound from './pages/TableNotFound'

// The customer-facing ordering flow — QR code lands here. Kept inside the
// constrained "phone shell" (see the outer div below) so it looks right
// both on an actual phone and when shown on a laptop during a demo.
export default function CustomerApp() {
  return (
    <LanguageProvider scope="customer">
      <CustomerShell />
    </LanguageProvider>
  )
}

function CustomerShell() {
  const { setLang } = useLanguage()
  const [introDone, setIntroDone] = useState(false)
  // The customer picks English / French / Arabic after the intro.
  const [languageChosen, setLanguageChosen] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    // The language screen's flag is fetched right away (not after the menu),
    // so it is already there when the screen appears.
    preloadImages(['/flags/sa.jpg'])

    Promise.all([loadMenuData(), loadTables(), loadChatbotFaqs()])
      // While the intro plays, download every picture so the menu shows
      // them instantly (gives up after 8 seconds so it never gets stuck).
      .then(() =>
        preloadImages([
          '/logo.png',
          '/bot.png',
          ...CATEGORIES.map((category) => category.image),
          ...MENU_ITEMS.map((item) => item.image),
        ])
      )
      .finally(() => setDataLoaded(true))
  }, [])

  return (
    <div className="relative mx-auto h-dvh w-full max-w-md overflow-hidden bg-ink sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[2.5rem] sm:shadow-2xl sm:shadow-black/60 sm:ring-1 sm:ring-line">
      {!introDone || !dataLoaded ? (
        <IntroSplash onFinish={() => setIntroDone(true)} />
      ) : !languageChosen ? (
        <LanguageChooser
          onContinue={(code) => {
            setLang(code)
            setLanguageChosen(true)
          }}
        />
      ) : (
        <CartProvider>
          <OrderProvider>
            <WaiterProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/table/1" replace />} />
              <Route path="/table/:tableId" element={<TablePage />} />
              {/* The special link for customers ordering without a table */}
              <Route path={HOME_PATH} element={<TablePage />} />
              {/* The delivery link: orders with a phone number and an address */}
              <Route path={DELIVERY_PATH} element={<TablePage />} />
              <Route path="*" element={<TableNotFound />} />
            </Routes>
            </WaiterProvider>
          </OrderProvider>
        </CartProvider>
      )}
    </div>
  )
}

