// The database uses snake_case columns; the frontend (unchanged from the
// mock-data version) expects camelCase fields. These helpers are the only
// place that translation happens.

export function serializeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    description: row.description,
  }
}

export function serializeMenuItem(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    price: row.price,
    image: row.image,
    available: row.available,
    discountPercent: row.discount_percent,
    isBest: row.is_best,
    description: row.description || '',
  }
}

export function serializeTable(row) {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind || 'table',
    seats: row.seats ?? 4,
    posX: row.pos_x ?? null,
    posY: row.pos_y ?? null,
  }
}

export function serializeFaq(row) {
  return { id: row.id, keyword: row.keyword, answer: row.answer }
}

export function serializeOrder(row, items) {
  return {
    id: row.id,
    // The "#22" people see: today's running number (restarts at 1 every day).
    // `id` stays the unique database id the app uses behind the scenes.
    number: row.daily_number ?? row.id,
    tableId: row.table_id,
    status: row.status,
    total: row.total,
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    items: items.map((line) => ({
      id: line.item_id,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unit_price,
    })),
  }
}
