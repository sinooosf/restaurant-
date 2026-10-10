// ---------------------------------------------------------------------------
// Menu data.
//
// CATEGORIES and MENU_ITEMS start out as the same demo data this project
// always shipped with. Call loadMenuData() once (App.jsx does this during
// the intro) to replace them with whatever's actually in the database. If
// the backend isn't running or the request fails, these built-in arrays
// stay in place so the app still shows a working menu instead of a blank
// screen.
//
// Every export below reads these two `let` bindings at call time, so once
// loadMenuData() reassigns them, every part of the app that already
// imported CATEGORIES/MENU_ITEMS sees the fresh data automatically — ES
// module imports are live references, not one-time copies.
// ---------------------------------------------------------------------------

import { fetchMenu } from '../services/api'

export let CATEGORIES = [
  {
    id: 'pizza',
    name: 'Pizza',
    image: '/images/categories/pizza.png',
    description: 'Wood-fired & fresh',
  },
  {
    id: 'soup',
    name: 'Soups',
    image: '/images/categories/soup.png',
    description: 'Warm & comforting',
  },
  {
    id: 'sandwich',
    name: 'Sandwiches',
    image: '/images/categories/sandwich.png',
    description: 'Stacked & hearty',
  },
  {
    id: 'drink',
    name: 'Drinks',
    image: '/images/categories/drink.png',
    description: 'Cold & refreshing',
  },
]

// Fields on every item:
//   id               unique string
//   categoryId       matches a CATEGORIES[].id
//   name             shown on the card
//   price            base price in DH, before discount
//   image            path under /public
//   available        false => card shows an "unavailable" state, can't be added
//   discountPercent  0-100. Editable per item. 0 means "no discount tag shown"
//   isBest           true => surfaces first in its category, and is what the
//                    chatbot recommends when asked for the best dishes
export let MENU_ITEMS = [
  // ---- Pizza ------------------------------------------------------------
  { id: 'pizza-1', categoryId: 'pizza', name: 'Margherita', price: 450, image: '/images/menu/pizza/pizza1.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'pizza-2', categoryId: 'pizza', name: 'Olive & Pepper Supreme', price: 600, image: '/images/menu/pizza/pizza2.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'pizza-3', categoryId: 'pizza', name: 'Hawaiian', price: 550, image: '/images/menu/pizza/pizza3.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'pizza-4', categoryId: 'pizza', name: 'Mushroom Delight', price: 600, image: '/images/menu/pizza/pizza4.jpg', available: true, discountPercent: 20, isBest: false },
  { id: 'pizza-5', categoryId: 'pizza', name: 'Cherry Tomato & Basil', price: 500, image: '/images/menu/pizza/pizza5.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'pizza-6', categoryId: 'pizza', name: 'Supreme', price: 700, image: '/images/menu/pizza/pizza6.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'pizza-7', categoryId: 'pizza', name: 'BBQ Chicken', price: 750, image: '/images/menu/pizza/pizza7.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'pizza-8', categoryId: 'pizza', name: 'Caprese', price: 650, image: '/images/menu/pizza/pizza8.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'pizza-9', categoryId: 'pizza', name: 'Arugula & Prosciutto', price: 850, image: '/images/menu/pizza/pizza9.jpg', available: false, discountPercent: 0, isBest: false },
  { id: 'pizza-10', categoryId: 'pizza', name: 'Garden Veggie Deluxe', price: 550, image: '/images/menu/pizza/pizza10.jpg', available: true, discountPercent: 50, isBest: false },

  // ---- Soups --------------------------------------------------------------
  { id: 'soup-1', categoryId: 'soup', name: 'Spicy Shrimp Soup', price: 280, image: '/images/menu/soup/soup1.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'soup-2', categoryId: 'soup', name: 'Tom Yum Shrimp', price: 270, image: '/images/menu/soup/soup2.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'soup-3', categoryId: 'soup', name: 'Lamb Tomato Stew', price: 260, image: '/images/menu/soup/soup3.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'soup-4', categoryId: 'soup', name: 'Turmeric Chicken Curry', price: 240, image: '/images/menu/soup/soup4.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'soup-5', categoryId: 'soup', name: 'Chorba', price: 180, image: '/images/menu/soup/soup5.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'soup-6', categoryId: 'soup', name: 'Harira', price: 190, image: '/images/menu/soup/soup6.jpg', available: true, discountPercent: 15, isBest: false },
  { id: 'soup-7', categoryId: 'soup', name: 'Creamy Chicken Soup', price: 230, image: '/images/menu/soup/soup7.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'soup-8', categoryId: 'soup', name: 'Spicy Beef Chorba', price: 250, image: '/images/menu/soup/soup8.jpg', available: false, discountPercent: 0, isBest: false },
  { id: 'soup-9', categoryId: 'soup', name: 'Beef & Potato Stew', price: 260, image: '/images/menu/soup/soup9.jpg', available: true, discountPercent: 10, isBest: false },
  { id: 'soup-10', categoryId: 'soup', name: 'Beef & Vegetable Stew', price: 270, image: '/images/menu/soup/soup10.jpg', available: true, discountPercent: 0, isBest: false },

  // ---- Sandwiches ---------------------------------------------------------
  { id: 'sandwich-1', categoryId: 'sandwich', name: 'Club Sandwich', price: 380, image: '/images/menu/sandwich/sandwich1.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'sandwich-2', categoryId: 'sandwich', name: 'Chicken Salad Sub', price: 340, image: '/images/menu/sandwich/sandwich2.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'sandwich-3', categoryId: 'sandwich', name: 'Chicken Caesar Wrap', price: 350, image: '/images/menu/sandwich/sandwich3.jpg', available: true, discountPercent: 20, isBest: false },
  { id: 'sandwich-4', categoryId: 'sandwich', name: 'Loaded Beef Tacos', price: 400, image: '/images/menu/sandwich/sandwich4.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'sandwich-5', categoryId: 'sandwich', name: 'Beef Burrito Wrap', price: 420, image: '/images/menu/sandwich/sandwich5.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'sandwich-6', categoryId: 'sandwich', name: 'Philly Steak Sub', price: 450, image: '/images/menu/sandwich/sandwich6.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'sandwich-7', categoryId: 'sandwich', name: 'Ham & Cheese Sub', price: 320, image: '/images/menu/sandwich/sandwich7.jpg', available: false, discountPercent: 0, isBest: false },
  { id: 'sandwich-8', categoryId: 'sandwich', name: 'BBQ Chicken Sandwich', price: 480, image: '/images/menu/sandwich/sandwich8.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'sandwich-9', categoryId: 'sandwich', name: 'Pulled BBQ Beef Sub', price: 460, image: '/images/menu/sandwich/sandwich9.jpg', available: true, discountPercent: 25, isBest: false },
  { id: 'sandwich-10', categoryId: 'sandwich', name: 'Grilled Chicken Sub', price: 360, image: '/images/menu/sandwich/sandwich10.jpg', available: true, discountPercent: 0, isBest: false },

  // ---- Drinks ---------------------------------------------------------------
  { id: 'drink-1', categoryId: 'drink', name: 'Coca-Cola', price: 120, image: '/images/menu/drink/drink1.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'drink-2', categoryId: 'drink', name: 'Red Bull', price: 220, image: '/images/menu/drink/drink2.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'drink-3', categoryId: 'drink', name: 'Fanta', price: 120, image: '/images/menu/drink/drink3.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'drink-4', categoryId: 'drink', name: 'Sprite', price: 120, image: '/images/menu/drink/drink4.jpg', available: true, discountPercent: 15, isBest: false },
  { id: 'drink-5', categoryId: 'drink', name: 'Schweppes Tonic Water', price: 140, image: '/images/menu/drink/drink5.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'drink-6', categoryId: 'drink', name: 'Pepsi Zero Sugar', price: 120, image: '/images/menu/drink/drink6.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'drink-7', categoryId: 'drink', name: 'Mirinda Citrus', price: 120, image: '/images/menu/drink/drink7.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'drink-8', categoryId: 'drink', name: 'Hamoud Boualem', price: 100, image: '/images/menu/drink/drink8.jpg', available: true, discountPercent: 0, isBest: true },
  { id: 'drink-9', categoryId: 'drink', name: 'Mineral Water', price: 80, image: '/images/menu/drink/drink9.jpg', available: true, discountPercent: 0, isBest: false },
  { id: 'drink-10', categoryId: 'drink', name: 'Zem Energy Drink', price: 200, image: '/images/menu/drink/drink10.jpg', available: false, discountPercent: 0, isBest: false },
]

// Called once at startup (see App.jsx). Swaps the arrays above for whatever
// the backend actually has. Safe to call even if the backend is offline —
// it just leaves the built-in demo data in place and logs a warning.
export async function loadMenuData() {
  try {
    const data = await fetchMenu()
    if (Array.isArray(data.categories) && data.categories.length) CATEGORIES = data.categories
    if (Array.isArray(data.items)) MENU_ITEMS = data.items
  } catch (err) {
    console.warn('Could not load the menu from the backend — using the built-in demo menu instead.', err)
  }
}

// Effective price after discount, rounded to the nearest DH.
export function getFinalPrice(item) {
  if (!item.discountPercent) return item.price
  return Math.round(item.price * (1 - item.discountPercent / 100))
}

// Items for one category, "best" ones pinned to the front (stable order
// otherwise) — this is the rule the chatbot and the menu grid both use.
export function getItemsForCategory(categoryId) {
  return MENU_ITEMS
    .filter((item) => item.categoryId === categoryId)
    .sort((a, b) => Number(b.isBest) - Number(a.isBest))
}

export function getBestItems() {
  return MENU_ITEMS.filter((item) => item.isBest)
}

export function getUnavailableItems() {
  return MENU_ITEMS.filter((item) => !item.available)
}
