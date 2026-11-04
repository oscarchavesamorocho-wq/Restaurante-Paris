const MIGRATIONS = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'mesero', 'cocina', 'despacho')),
    password_hash TEXT NOT NULL,
    google_sub TEXT UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE restaurant_tables (
    id INTEGER PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 20),
    zone TEXT NOT NULL DEFAULT 'Salón',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
  );

  CREATE TABLE dishes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    price_cop INTEGER NOT NULL CHECK (price_cop >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    is_demo INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    table_id INTEGER NOT NULL REFERENCES restaurant_tables(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    people INTEGER NOT NULL CHECK (people BETWEEN 1 AND 12),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'cancelada', 'completada')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_reservations_date ON reservations(date, table_id, status);

  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    table_id INTEGER NOT NULL REFERENCES restaurant_tables(id),
    reservation_id TEXT REFERENCES reservations(id),
    status TEXT NOT NULL DEFAULT 'abierto'
      CHECK (status IN ('abierto', 'en_cocina', 'listo', 'cerrado', 'cancelado')),
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE UNIQUE INDEX idx_orders_active_table
    ON orders(table_id)
    WHERE status IN ('abierto', 'en_cocina', 'listo');
  CREATE INDEX idx_orders_status ON orders(status);

  CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dish_id INTEGER NOT NULL REFERENCES dishes(id),
    dish_name TEXT NOT NULL,
    unit_price_cop INTEGER NOT NULL CHECK (unit_price_cop >= 0),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'en_cola'
      CHECK (status IN ('en_cola', 'preparando', 'listo', 'en_ruta', 'entregado', 'cancelado')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_order_items_status ON order_items(status);
  CREATE INDEX idx_order_items_order ON order_items(order_id);

  CREATE TABLE dispatches (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    status TEXT NOT NULL DEFAULT 'en_ruta' CHECK (status IN ('en_ruta', 'entregado')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    delivered_at TEXT
  );
  CREATE INDEX idx_dispatches_status ON dispatches(status);

  CREATE TABLE dispatch_items (
    dispatch_id TEXT NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL UNIQUE REFERENCES order_items(id),
    PRIMARY KEY (dispatch_id, item_id)
  );
  `,
];

export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let index = current; index < MIGRATIONS.length; index += 1) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRATIONS[index]);
      db.exec(`PRAGMA user_version = ${index + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return MIGRATIONS.length;
}
