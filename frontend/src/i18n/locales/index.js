// Every translation file is merged here into one dictionary per language.
// To add a new language later: add it to LANGUAGES in translate.js and add a
// matching key (e.g. `es: {...}`) in each file below.
import common from './common'
import customer from './customer'
import chatbot from './chatbot'
import adminLayout from './admin-layout'
import adminUi from './admin-ui'
import adminOverview from './admin-overview'
import adminOrders from './admin-orders'
import adminMenu from './admin-menu'
import adminTables from './admin-tables'
import adminChatbot from './admin-chatbot'
import adminLogin from './admin-login'
import adminAssistant from './admin-assistant'

const FILES = [
  common, customer, chatbot,
  adminLayout, adminUi, adminOverview, adminOrders, adminMenu,
  adminTables, adminChatbot, adminLogin, adminAssistant,
]

export const DICTIONARIES = { en: {}, fr: {}, ar: {} }

for (const file of FILES) {
  for (const code of Object.keys(DICTIONARIES)) {
    Object.assign(DICTIONARIES[code], file[code])
  }
}
