// ---------------------------------------------------------------------------
// Dish and category names in French and Arabic.
//
// The menu itself (names, prices) lives in the database and is typed in
// English from the dashboard. For the 40 starting dishes we know the French
// and Arabic names, looked up by the English name. A dish the staff adds
// later that is not in this list simply shows the name as it was typed.
// To translate a new dish: add one line under `items` below.
// ---------------------------------------------------------------------------
const ITEMS = {
  fr: {
    'Margherita': 'Margherita',
    'Olive & Pepper Supreme': 'Suprême Olives & Poivrons',
    'Hawaiian': 'Hawaïenne',
    'Mushroom Delight': 'Délice aux champignons',
    'Cherry Tomato & Basil': 'Tomates cerises & basilic',
    'Supreme': 'Suprême',
    'BBQ Chicken': 'Poulet BBQ',
    'Caprese': 'Caprese',
    'Arugula & Prosciutto': 'Roquette & prosciutto',
    'Garden Veggie Deluxe': 'Jardinière Deluxe',
    'Spicy Shrimp Soup': 'Soupe de crevettes épicée',
    'Tom Yum Shrimp': 'Tom Yum aux crevettes',
    'Lamb Tomato Stew': "Ragoût d'agneau à la tomate",
    'Turmeric Chicken Curry': 'Curry de poulet au curcuma',
    'Chorba': 'Chorba',
    'Harira': 'Harira',
    'Creamy Chicken Soup': 'Velouté de poulet',
    'Spicy Beef Chorba': 'Chorba de bœuf épicée',
    'Beef & Potato Stew': 'Ragoût de bœuf et pommes de terre',
    'Beef & Vegetable Stew': 'Ragoût de bœuf aux légumes',
    'Club Sandwich': 'Club sandwich',
    'Chicken Salad Sub': 'Sub salade de poulet',
    'Chicken Caesar Wrap': 'Wrap poulet César',
    'Loaded Beef Tacos': 'Tacos de bœuf garnis',
    'Beef Burrito Wrap': 'Wrap burrito au bœuf',
    'Philly Steak Sub': 'Sub Philly steak',
    'Ham & Cheese Sub': 'Sub jambon-fromage',
    'BBQ Chicken Sandwich': 'Sandwich poulet BBQ',
    'Pulled BBQ Beef Sub': 'Sub bœuf effiloché BBQ',
    'Grilled Chicken Sub': 'Sub poulet grillé',
    'Coca-Cola': 'Coca-Cola',
    'Red Bull': 'Red Bull',
    'Fanta': 'Fanta',
    'Sprite': 'Sprite',
    'Schweppes Tonic Water': 'Schweppes Tonic',
    'Pepsi Zero Sugar': 'Pepsi Zéro sucre',
    'Mirinda Citrus': 'Mirinda Agrumes',
    'Hamoud Boualem': 'Hamoud Boualem',
    'Mineral Water': 'Eau minérale',
    'Zem Energy Drink': 'Boisson énergisante Zem',
  },
  ar: {
    'Margherita': 'مارغريتا',
    'Olive & Pepper Supreme': 'سوبريم الزيتون والفلفل',
    'Hawaiian': 'هاواي',
    'Mushroom Delight': 'لذّة الفطر',
    'Cherry Tomato & Basil': 'طماطم كرزية وريحان',
    'Supreme': 'سوبريم',
    'BBQ Chicken': 'دجاج باربيكيو',
    'Caprese': 'كابريزي',
    'Arugula & Prosciutto': 'جرجير وبروشوتو',
    'Garden Veggie Deluxe': 'خضار الحديقة ديلوكس',
    'Spicy Shrimp Soup': 'شوربة الروبيان الحارة',
    'Tom Yum Shrimp': 'توم يوم بالروبيان',
    'Lamb Tomato Stew': 'يخنة لحم الضأن بالطماطم',
    'Turmeric Chicken Curry': 'كاري الدجاج بالكركم',
    'Chorba': 'شوربة',
    'Harira': 'حريرة',
    'Creamy Chicken Soup': 'شوربة الدجاج الكريمية',
    'Spicy Beef Chorba': 'شوربة لحم البقر الحارة',
    'Beef & Potato Stew': 'يخنة لحم البقر والبطاطس',
    'Beef & Vegetable Stew': 'يخنة لحم البقر بالخضار',
    'Club Sandwich': 'كلوب ساندويتش',
    'Chicken Salad Sub': 'ساندويتش سلطة الدجاج',
    'Chicken Caesar Wrap': 'راب دجاج سيزر',
    'Loaded Beef Tacos': 'تاكو لحم البقر المحمّل',
    'Beef Burrito Wrap': 'راب بوريتو لحم البقر',
    'Philly Steak Sub': 'ساندويتش فيلي ستيك',
    'Ham & Cheese Sub': 'ساندويتش هام وجبن',
    'BBQ Chicken Sandwich': 'ساندويتش دجاج باربيكيو',
    'Pulled BBQ Beef Sub': 'ساندويتش لحم بقر مسحّب باربيكيو',
    'Grilled Chicken Sub': 'ساندويتش دجاج مشوي',
    'Coca-Cola': 'كوكاكولا',
    'Red Bull': 'ريد بول',
    'Fanta': 'فانتا',
    'Sprite': 'سبرايت',
    'Schweppes Tonic Water': 'شويبس تونيك',
    'Pepsi Zero Sugar': 'بيبسي زيرو سكر',
    'Mirinda Citrus': 'ميرندا حمضيات',
    'Hamoud Boualem': 'حمود بوعلام',
    'Mineral Water': 'مياه معدنية',
    'Zem Energy Drink': 'مشروب الطاقة زيم',
  },
}

const CATEGORIES = {
  fr: { Pizza: 'Pizzas', Soups: 'Soupes', Sandwiches: 'Sandwichs', Drinks: 'Boissons' },
  ar: { Pizza: 'بيتزا', Soups: 'شوربات', Sandwiches: 'ساندويتشات', Drinks: 'مشروبات' },
}

const DESCRIPTIONS = {
  fr: {
    'Wood-fired & fresh': 'Cuite au feu de bois, toujours fraîche',
    'Warm & comforting': 'Chaudes et réconfortantes',
    'Stacked & hearty': 'Généreux et copieux',
    'Cold & refreshing': 'Fraîches et désaltérantes',
  },
  ar: {
    'Wood-fired & fresh': 'مخبوزة على الحطب وطازجة',
    'Warm & comforting': 'دافئة ومريحة',
    'Stacked & hearty': 'مشبعة وغنية',
    'Cold & refreshing': 'باردة ومنعشة',
  },
}

export const itemName = (item, code) => ITEMS[code]?.[item?.name] ?? item?.name ?? ''
export const categoryName = (category, code) => CATEGORIES[code]?.[category?.name] ?? category?.name ?? ''
export const categoryDescription = (category, code) =>
  DESCRIPTIONS[code]?.[category?.description] ?? category?.description ?? ''

// True when `term` is found in the dish name in ANY language, so a customer
// can search "poulet" or "دجاج" or "chicken" no matter which language is on.
export function itemMatchesSearch(item, term) {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return [item.name, ITEMS.fr[item.name], ITEMS.ar[item.name]].some(
    (name) => name && name.toLowerCase().includes(needle)
  )
}
