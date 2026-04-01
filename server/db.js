import mysql from "mysql2/promise";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config.js";

const RESTAURANT_SEEDS = [
  {
    id: "gulab-ji-chai-bani-park",
    name: "Gulab Ji Chai",
    slug: "gulab-ji-chai-bani-park",
    tagline: "Iconic Jaipur chai, fast breakfast, and everyday comfort snacks.",
    addressLine: "A/C-2, Sawai Jai Singh Highway, Sen Colony, Bani Park, Jaipur 302016",
    phone: "+91 98296 64488",
    hoursSummary: "Open daily, around 7:00 AM to 11:00 PM",
    adminPasscode: "1234",
  },
];

const MENU_TEMPLATE = [
  ["gulab-ji-chai", "Gulab Ji Chai", "Gulabji Special", 30, "3 min", "Signature", "House chai served hot in the branch's classic everyday style."],
  ["kulhad-chai", "Kulhad Chai", "Gulabji Special", 40, "4 min", "Clay cup", "Traditional chai served in a kulhad for an earthy finish."],
  ["hot-coffee", "Hot Coffee", "Gulabji Special", 35, "4 min", "Cafe classic", "Fresh hot coffee for a quick caffeine break."],
  ["kulhad-coffee", "Kulhad Coffee", "Gulabji Special", 50, "5 min", "Popular", "Strong coffee poured into a kulhad for a richer cafe feel."],
  ["samosa", "Samosa", "Gulabji Special", 25, "4 min", "Quick bite", "Crisp samosa served as a fast tea-time snack."],
  ["kachori", "Kachori", "Gulabji Special", 25, "4 min", "Jaipur staple", "Flaky kachori with a savory spiced filling."],
  ["bun-samosa", "Bun Samosa", "Gulabji Special", 60, "5 min", "Best seller", "A samosa tucked into a bun for a filling breakfast combo."],
  ["bun-kachori", "Bun Kachori", "Gulabji Special", 60, "5 min", "Street favorite", "Soft bun paired with a crisp kachori for a Jaipur-style snack."],
  ["bread-kachori", "Bread Kachori", "Gulabji Special", 45, "5 min", "Fast", "Bread-served kachori for a lighter alternative to the bun combo."],
  ["bread-samosa", "Bread Samosa", "Gulabji Special", 45, "5 min", "Fast", "Bread and samosa combo for a quick tea partner."],
  ["butter-bread-slice", "Butter Bread Slice", "Gulabji Special", 45, "4 min", "Simple", "Toasted bread slice finished with butter."],
  ["bun-butter", "Bun Butter", "Gulabji Special", 35, "3 min", "Classic", "Soft bun with a buttery finish."],
  ["sada-bun", "Sada Bun", "Gulabji Special", 10, "2 min", "Plain", "Fresh plain bun served simple."],
  ["sada-bread", "Sada Bread (4 Pcs)", "Gulabji Special", 10, "2 min", "Plain", "Plain bread pieces for a minimal order."],
  ["green-tea", "Green Tea", "Chai", 60, "4 min", "Light", "Fresh green tea for a lighter hot beverage."],
  ["honey-tea", "Honey Tea", "Chai", 60, "4 min", "Warm", "Tea sweetened with honey for a mellow finish."],
  ["lemon-tea", "Lemon Tea", "Chai", 60, "4 min", "Refreshing", "Hot lemon tea with a citrus lift."],
  ["black-tea", "Black Tea", "Chai", 60, "4 min", "Strong", "No-milk tea with a stronger brew profile."],
  ["black-coffee", "Black Coffee", "Chai", 60, "4 min", "Pure", "Straight black coffee for a sharper kick."],
  ["butter-scotch-shake", "Butter Scotch Shake", "Shakes and Coolers", 120, "6 min", "Cooler", "Creamy butterscotch shake served chilled."],
  ["vanilla-shake", "Vanilla Shake", "Shakes and Coolers", 110, "6 min", "Classic", "Smooth vanilla shake for an easy sweet option."],
  ["chocolate-shake", "Chocolate Shake", "Shakes and Coolers", 130, "6 min", "Popular", "Rich chocolate shake served cold."],
  ["milk-rose", "Milk Rose", "Shakes and Coolers", 110, "5 min", "Sweet", "Rose-flavored milk drink served chilled."],
  ["pudina-shikanji", "Pudina Shikanji", "Shakes and Coolers", 85, "5 min", "Fresh", "Minty shikanji for a sharp summer cooler."],
  ["mango-shake", "Mango Shake", "Shakes and Coolers", 120, "6 min", "Seasonal", "Creamy mango shake for a sweeter fruit option."],
  ["cold-coffee", "Cold Coffee", "Shakes and Coolers", 100, "5 min", "Cafe cooler", "Chilled cold coffee for the all-day crowd."],
  ["cold-coffee-ice-cream", "Cold Coffee (Ice Cream)", "Shakes and Coolers", 120, "6 min", "Popular", "Cold coffee topped with ice cream for extra richness."],
  ["kitkat-shake", "Kitkat Shake", "Shakes and Coolers", 130, "6 min", "Youth favorite", "Chocolate shake blended with KitKat."],
  ["oreo-shake", "Oreo Shake", "Shakes and Coolers", 130, "6 min", "Popular", "Oreo cookie shake served thick and chilled."],
  ["strawberry-shake", "Strawberry Shake", "Shakes and Coolers", 110, "6 min", "Sweet", "Strawberry flavored milkshake."],
  ["nutella-shake", "Nutella Shake", "Shakes and Coolers", 130, "6 min", "Indulgent", "Nutella-blended shake for a dessert-style drink."],
  ["blue-lagoon", "Blue Lagoon", "Shakes and Coolers", 130, "5 min", "Mocktail", "Bright blue mocktail served cold."],
  ["lemon-ice-tea", "Lemon Ice Tea", "Shakes and Coolers", 110, "5 min", "Iced", "Refreshing lemon iced tea."],
  ["peach-ice-tea", "Peach Ice Tea", "Shakes and Coolers", 120, "5 min", "Iced", "Peach-flavored iced tea."],
  ["strawberry-ice-tea", "Strawberry Ice Tea", "Shakes and Coolers", 120, "5 min", "Iced", "Strawberry-infused iced tea."],
  ["virgin-mojito", "Virgin Mojito", "Shakes and Coolers", 120, "5 min", "Mocktail", "Mint-lime cooler served chilled."],
  ["lassi", "Lassi", "Shakes and Coolers", 85, "5 min", "Classic", "Traditional chilled lassi."],
  ["mango-lassi", "Mango Lassi", "Shakes and Coolers", 95, "5 min", "Fruit", "Sweet mango lassi."],
  ["gulab-lassi", "Gulab Lassi", "Shakes and Coolers", 95, "5 min", "Rose special", "Rose-flavored lassi served chilled."],
  ["tangy-aloo-roll", "Tangy Aloo Roll", "Rolls", 100, "8 min", "Filling", "Aloo roll with a tangy masala profile."],
  ["mexican-roll", "Mexican Roll", "Rolls", 120, "8 min", "Fusion", "Spicy roll with Mexican-style seasoning."],
  ["paneer-tikka-roll", "Paneer Tikka Roll", "Rolls", 130, "9 min", "Popular", "Paneer tikka wrapped in a soft roll."],
  ["veg-roll", "Veg. Roll", "Rolls", 110, "8 min", "Quick", "Mixed veg roll for a simple savory bite."],
  ["masala-bread", "Masala Bread", "Maggi & Chaat", 100, "7 min", "Spiced", "Toast-style bread with masala seasoning."],
  ["chote-tikiya", "Chote Tikiya", "Maggi & Chaat", 100, "8 min", "Chaat", "Small spiced tikkis served as a snack item."],
  ["plain-maggi", "Plain Maggi", "Maggi & Chaat", 110, "7 min", "Classic", "Simple Maggi noodles."],
  ["masala-maggi", "Masala Maggi", "Maggi & Chaat", 130, "8 min", "Popular", "Masala Maggi with extra seasoning."],
  ["butter-maggi", "Butter Maggi", "Maggi & Chaat", 130, "8 min", "Rich", "Maggi tossed with butter."],
  ["firangi-maggi", "Firangi Maggi", "Maggi & Chaat", 150, "9 min", "Fusion", "A heavier fusion-style Maggi option."],
  ["cheese-maggi", "Cheese Maggi", "Maggi & Chaat", 140, "8 min", "Cheesy", "Maggi finished with cheese."],
  ["poha", "Poha", "Maggi & Chaat", 100, "6 min", "Breakfast", "Classic poha for the morning crowd."],
  ["french-fries", "French Fries", "Maggi & Chaat", 120, "6 min", "Fast", "Crisp fries served hot."],
  ["peri-peri-fries", "Peri Pari Fries", "Maggi & Chaat", 130, "6 min", "Spicy", "Peri peri seasoned fries."],
  ["chilli-paneer", "Chilli Paneer", "Maggi & Chaat", 120, "9 min", "Indo-Chinese", "Paneer tossed in a chilli-style sauce."],
  ["honey-chilli-potato", "Honey Chilli Potato", "Maggi & Chaat", 130, "9 min", "Popular", "Crisp potatoes in a honey chilli glaze."],
  ["pao-bhaji", "Pao Bhaji", "Maggi & Chaat", 120, "10 min", "Popular", "Bhaji served with buttered pao."],
  ["chole-bhature", "Chole Bhature", "Maggi & Chaat", 130, "10 min", "North Indian", "Chole served with bhature."],
  ["chowmein", "Chowmein", "Maggi & Chaat", 120, "9 min", "Noodles", "Street-style chowmein."],
  ["hakka-noodles", "Hakka Noodles", "Maggi & Chaat", 110, "9 min", "Noodles", "Veg hakka noodles."],
  ["dahi-papdi", "Dahi Papdi", "Maggi & Chaat", 100, "7 min", "Chaat", "Crunchy papdi topped with dahi and chutneys."],
  ["aloo-chaat", "Aloo Chaat", "Maggi & Chaat", 100, "7 min", "Chaat", "Tangy and spiced aloo chaat."],
  ["red-sauce-pasta", "Red Sauce Pasta", "Maggi & Chaat", 170, "11 min", "Cafe pasta", "Pasta in red sauce."],
  ["white-sauce-pasta", "White Sauce Pasta", "Maggi & Chaat", 190, "11 min", "Creamy", "Pasta in white sauce."],
  ["pink-sauce-pasta", "Pink Sauce Pasta", "Maggi & Chaat", 180, "11 min", "Creamy", "Pasta in a pink sauce mix."],
  ["extra-pao", "Extra Pao", "Maggi & Chaat", 35, "2 min", "Add-on", "Extra pao for pao bhaji."],
  ["extra-bhatura", "Extra Bhatura", "Maggi & Chaat", 35, "2 min", "Add-on", "Extra bhatura for chole bhature."],
  ["cheese-corn-sandwich", "Cheese Corn Sandwich", "Sandwiches", 130, "8 min", "Cheesy", "Cheese and corn sandwich served grilled."],
  ["chatpata-chola-sandwich", "Chatpata Chola Sandwich", "Sandwiches", 120, "8 min", "Fusion", "Spiced chola-filled sandwich."],
  ["barbeque-paneer-sandwich", "Barbeque Paneer Sandwich", "Sandwiches", 130, "9 min", "Popular", "Paneer sandwich with barbeque flavor."],
  ["grilled-veg-mayo-sandwich", "Grilled Veg Mayo Sandwich", "Sandwiches", 120, "8 min", "Grilled", "Veg mayo sandwich served grilled."],
  ["grilled-cheese-sandwich", "Grilled Cheese Sandwich", "Sandwiches", 110, "8 min", "Classic", "Cheese sandwich with a grilled finish."],
  ["mexican-grilled-sandwich", "Mexican Grilled Sandwich", "Sandwiches", 130, "9 min", "Fusion", "Mexican-style grilled sandwich."],
  ["paneer-tikka-sandwich", "Paneer Tikka Sandwich", "Sandwiches", 130, "9 min", "Popular", "Paneer tikka sandwich."],
  ["cottage-cheese-sandwich", "Cottage Cheese Sandwich", "Sandwiches", 130, "9 min", "Rich", "Cottage cheese sandwich."],
  ["veg-sandwich-non-grilled", "Veg Sandwich (Non Grilled)", "Sandwiches", 85, "6 min", "Simple", "Plain veg sandwich without grilling."],
  ["indian-style-sandwich", "Indian Style Sandwich", "Sandwiches", 100, "7 min", "Classic", "Indian masala style sandwich."],
  ["bombay-veg-sandwich", "Bombay Veg. Sandwich", "Sandwiches", 120, "8 min", "Bombay style", "Bombay-style veg sandwich."],
  ["coleslaw-sandwich", "Coleslaw Sandwich", "Sandwiches", 110, "7 min", "Cool", "Sandwich with creamy coleslaw filling."],
  ["veg-fried-rice", "Veg. Fried Rice", "Mini Meals", 130, "10 min", "Meal", "Vegetable fried rice for a light meal."],
  ["rice-with-rajma", "Rice With Rajma", "Mini Meals", 140, "10 min", "Meal", "Rajma served with rice."],
  ["rice-with-chole", "Rice With Chole", "Mini Meals", 130, "10 min", "Meal", "Chole served with rice."],
  ["aloo-paratha", "Aloo Paratha", "Mini Meals", 110, "9 min", "Breakfast", "Stuffed aloo paratha."],
  ["pyaaz-paratha", "Pyaaz Paratha", "Mini Meals", 120, "9 min", "Breakfast", "Stuffed onion paratha."],
  ["paneer-bhurji-with-pao", "Paneer Bhurji With Pao", "Mini Meals", 140, "10 min", "Meal", "Paneer bhurji served with pao."],
];

export async function createDatabasePool() {
  const adminConnection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  await adminConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await adminConnection.end();

  const pool = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true,
    namedPlaceholders: true,
  });

  const schema = await readFile(resolve("server", "schema.sql"), "utf8");
  await pool.query(schema);
  await pool.query(
    `
      ALTER TABLE orders
      MODIFY COLUMN status ENUM('pending', 'preparing', 'served', 'paid') NOT NULL DEFAULT 'pending'
    `,
  );
  await seedDefaults(pool);
  return pool;
}

function hashPasscode(passcode) {
  return createHash("sha256").update(passcode).digest("hex");
}

async function seedDefaults(pool) {
  for (const restaurant of RESTAURANT_SEEDS) {
    await pool.query(
      `
        INSERT INTO restaurants (id, name, slug, tagline, address_line, phone, hours_summary, admin_passcode_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          tagline = VALUES(tagline),
          address_line = VALUES(address_line),
          phone = VALUES(phone),
          hours_summary = VALUES(hours_summary),
          admin_passcode_hash = VALUES(admin_passcode_hash)
      `,
      [
        restaurant.id,
        restaurant.name,
        restaurant.slug,
        restaurant.tagline,
        restaurant.addressLine,
        restaurant.phone,
        restaurant.hoursSummary,
        hashPasscode(restaurant.adminPasscode),
      ],
    );

    for (let tableNumber = 1; tableNumber <= 12; tableNumber += 1) {
      await pool.query(
        `
          INSERT INTO restaurant_tables (id, restaurant_id, table_code, qr_token)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE qr_token = VALUES(qr_token)
        `,
        [
          `${restaurant.id}-table-${tableNumber}`,
          restaurant.id,
          `T${tableNumber}`,
          `${restaurant.slug}-table-${tableNumber}`,
        ],
      );
    }

    for (const menuItem of MENU_TEMPLATE) {
      await pool.query(
        `
          INSERT INTO menu_items (id, restaurant_id, name, category, price, prep_time, tag_label, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            category = VALUES(category),
            price = VALUES(price),
            prep_time = VALUES(prep_time),
            tag_label = VALUES(tag_label),
            description = VALUES(description)
        `,
        [`${restaurant.id}-${menuItem[0]}`, restaurant.id, ...menuItem.slice(1)],
      );
    }
  }
}
