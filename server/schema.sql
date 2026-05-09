CREATE TABLE IF NOT EXISTS restaurants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  tagline VARCHAR(180) NOT NULL,
  address_line VARCHAR(220) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  hours_summary VARCHAR(80) NOT NULL,
  admin_passcode_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id VARCHAR(64) PRIMARY KEY,
  restaurant_id VARCHAR(64) NOT NULL,
  table_code VARCHAR(40) NOT NULL,
  qr_token VARCHAR(80) NOT NULL UNIQUE,
  status ENUM('free', 'occupied') NOT NULL DEFAULT 'free',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_restaurant_table (restaurant_id, table_code),
  CONSTRAINT fk_tables_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(64) PRIMARY KEY,
  restaurant_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  price INT NOT NULL,
  prep_time VARCHAR(30) NOT NULL,
  tag_label VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  availability TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(64) NOT NULL,
  table_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'preparing', 'served', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  subtotal INT NOT NULL,
  gst INT NOT NULL,
  total INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id CHAR(36) NOT NULL,
  menu_item_id VARCHAR(64) NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS waiter_calls (
  id CHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(64) NOT NULL,
  table_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waiter_calls_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT fk_waiter_calls_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
);
