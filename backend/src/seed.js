// Sets up the database schema and, if it's empty, fills it with the
// starting menu (the same 40 items the frontend originally shipped with),
// 5 tables, and a couple of example chatbot FAQs. Safe to run more than
// once — it only inserts starting data the first time (checked by asking
// "is the categories table empty?"), so re-running this later never wipes
// out anything you've since edited from the dashboard.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CATEGORIES = [
  { id: 'pizza', name: 'Pizza', image: '/images/categories/pizza.png', description: 'Wood-fired & fresh', sortOrder: 0 },
  { id: 'soup', name: 'Soups', image: '/images/categories/soup.png', description: 'Warm & comforting', sortOrder: 1 },
  { id: 'sandwich', name: 'Sandwiches', image: '/images/categories/sandwich.png', description: 'Stacked & hearty', sortOrder: 2 },
  { id: 'drink', name: 'Drinks', image: '/images/categories/drink.png', description: 'Cold & refreshing', sortOrder: 3 },
]

const MENU_ITEMS = [
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

const TABLES = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: `Table ${n}` }))

const CHATBOT_FAQS = [
  { keyword: 'wifi', answer: 'Yes, we have free wifi \u2014 just ask a staff member for the password.' },
  { keyword: 'parking', answer: "There's free parking right outside." },
]

async function seed() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  await pool.query(schema)

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM categories')
  if (rows[0].count > 0) {
    console.log('Database already has data \u2014 skipping seed (nothing was changed).')
    await pool.end()
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const c of CATEGORIES) {
      await client.query(
        'INSERT INTO categories (id, name, image, description, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [c.id, c.name, c.image, c.description, c.sortOrder],
      )
    }

    for (const [index, item] of MENU_ITEMS.entries()) {
      await client.query(
        `INSERT INTO menu_items
          (id, category_id, name, price, image, available, discount_percent, is_best, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [item.id, item.categoryId, item.name, item.price, item.image, item.available, item.discountPercent, item.isBest, index],
      )
    }

    for (const t of TABLES) {
      await client.query('INSERT INTO restaurant_tables (id, label) VALUES ($1,$2)', [t.id, t.label])
    }

    for (const faq of CHATBOT_FAQS) {
      await client.query('INSERT INTO chatbot_faqs (keyword, answer) VALUES ($1,$2)', [faq.keyword, faq.answer])
    }

    await client.query('COMMIT')
    console.log(`Seeded ${CATEGORIES.length} categories, ${MENU_ITEMS.length} menu items, ${TABLES.length} tables, ${CHATBOT_FAQS.length} chatbot FAQs.`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
