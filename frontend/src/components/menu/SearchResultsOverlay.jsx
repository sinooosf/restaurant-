import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import MenuItemCard from './MenuItemCard'
import { useLanguage } from '../../i18n/LanguageContext'

export default function SearchResultsOverlay({
  open,
  items,
  onClose,
}) {
  const { t } = useLanguage()
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  function handleOutsideClick(event) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={handleOutsideClick}
          className="fixed inset-x-0 bottom-0 top-[92px] z-50 bg-black/25 backdrop-blur-[3px]"
        >
          {/* Search panel */}
          <motion.div
            initial={{
              opacity: 0,
              y: -35,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -35,
            }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative mx-4 mt-3 h-[50vh] overflow-hidden rounded-2xl border border-line bg-ink shadow-[0_15px_50px_rgba(0,0,0,0.6)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('search.close')}
              className="absolute end-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-panel text-cream/70 shadow-lg transition hover:bg-panel-light hover:text-cream"
            >
              <X size={18} />
            </button>

            {/* Scrollable results */}
            <div className="h-full overflow-y-auto px-4 pb-6 pt-4">
              {items.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <MenuItemCard item={item} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="font-display text-lg text-cream">
                    {t('search.none')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}