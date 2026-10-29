// ---------------------------------------------------------------------------
// The special ordering links that are not a table:
//   /ToHomeOrder  -> id "home"      orders to take home (no table)
//   /delivery     -> id "delivery"  orders that are delivered: the customer
//                                   gives a phone number and an address
// They are rows of restaurant_tables with their own `kind`, so everything that
// already works for a table link (the list of valid links, the QR links
// screen...) works for them too.
// ---------------------------------------------------------------------------
export const HOME_TABLE_ID = 'home'
export const DELIVERY_TABLE_ID = 'delivery'

// Links where every customer only ever sees their own order, and where there
// is no table to clean or to call a waiter to.
export const isOpenLink = (id) => id === HOME_TABLE_ID || id === DELIVERY_TABLE_ID

// 'delivery' | 'home' | 'table' — what kind of order this table id gives.
export const orderTypeOf = (tableId) =>
  tableId === DELIVERY_TABLE_ID ? 'delivery' : tableId === HOME_TABLE_ID ? 'home' : 'table'
