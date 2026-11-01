// Ready-made product lists (V-01, E-36): the common items each kind of shop
// stocks, so an owner ticks what they sell instead of speaking every name.
// Prices are typical MRPs in Nov 2026, shown as "check price": owners
// correct any that differ before saving. No tobacco or pan masala.

export type ShopType = "kirana" | "departmental" | "dairy_bakery" | "pan";
export const SHOP_TYPES: ShopType[] = ["kirana", "departmental", "dairy_bakery", "pan"];

export interface StarterItem {
  key: string;
  name: string;
  unit: string;
  pricePaise: number;
  category: string;
  types: ShopType[];
  aliases: string[];
}

// k kirana, d departmental, b dairy and bakery, p pan shop.
const TYPE_CODES: Record<string, ShopType> = { k: "kirana", d: "departmental", b: "dairy_bakery", p: "pan" };

type Row = [name: string, unit: string, rupees: number, types: string, aliases?: string[]];

// Category names match the festival calendar's (W-19), so festival bumps
// apply to products added from these lists.
const ROWS: Record<string, Row[]> = {
  "Atta and rice": [
    ["Aashirvaad Atta", "5 kg", 290, "kd", ["atta", "आटा"]],
    ["Aashirvaad Atta", "10 kg", 560, "kd", ["atta", "आटा"]],
    ["Fortune Chakki Fresh Atta", "5 kg", 265, "kd", ["atta"]],
    ["Pillsbury Chakki Atta", "5 kg", 275, "d"],
    ["Loose Atta", "1 kg", 40, "k", ["atta", "आटा"]],
    ["India Gate Basmati Rice", "1 kg", 180, "kd", ["basmati", "chawal"]],
    ["Daawat Rozana Basmati Rice", "1 kg", 110, "kd", ["basmati", "chawal"]],
    ["Sona Masoori Rice", "5 kg", 375, "d", ["chawal"]],
    ["Loose Rice", "1 kg", 50, "k", ["chawal", "चावल"]],
    ["Fortune Besan", "500 g", 65, "kd", ["besan", "बेसन"]],
    ["Maida", "1 kg", 45, "kd", ["मैदा"]],
    ["Sooji (Rava)", "500 g", 35, "kd", ["suji", "rava", "सूजी"]],
    ["Poha", "500 g", 45, "kd", ["पोहा"]],
  ],
  Staples: [
    ["Tata Salt", "1 kg", 28, "kd", ["namak", "नमक", "salt"]],
    ["Aashirvaad Salt", "1 kg", 25, "d", ["namak"]],
    ["Sugar", "1 kg", 46, "kd", ["cheeni", "chini", "चीनी"]],
    ["Jaggery", "1 kg", 70, "kd", ["gud", "गुड़"]],
    ["Tata Tea Premium", "250 g", 155, "kd", ["chai", "chai patti"]],
    ["Red Label Tea", "250 g", 145, "kd", ["chai patti"]],
    ["Wagh Bakri Tea", "250 g", 145, "kd", ["chai patti"]],
    ["Taj Mahal Tea", "250 g", 185, "d"],
    ["Bru Instant Coffee", "50 g", 160, "kd", ["coffee"]],
    ["Nescafe Classic Coffee", "50 g", 195, "d", ["coffee"]],
    ["Toor Dal", "1 kg", 170, "kd", ["arhar", "arhar dal", "अरहर"]],
    ["Moong Dal", "1 kg", 140, "kd", ["मूंग"]],
    ["Chana Dal", "1 kg", 110, "kd", ["चना दाल"]],
    ["Masoor Dal", "1 kg", 120, "kd", ["मसूर"]],
    ["Urad Dal", "1 kg", 150, "kd", ["उड़द"]],
    ["Rajma", "500 g", 95, "kd", ["राजमा"]],
    ["Kabuli Chana", "500 g", 95, "kd", ["chole", "छोले"]],
    ["Fortune Soyabean Oil", "1 L", 155, "kd", ["tel", "oil"]],
    ["Fortune Kachi Ghani Mustard Oil", "1 L", 185, "kd", ["sarson tel", "सरसों तेल"]],
    ["Dhara Mustard Oil", "1 L", 180, "kd", ["sarson tel"]],
    ["Saffola Gold Oil", "1 L", 205, "d"],
    ["Fortune Rice Bran Oil", "1 L", 175, "d"],
    ["Amul Ghee", "1 L", 650, "kd", ["ghee", "घी"]],
    ["Patanjali Cow Ghee", "1 L", 640, "d", ["ghee"]],
    ["Everest Turmeric Powder", "100 g", 38, "kd", ["haldi", "हल्दी"]],
    ["Everest Red Chilli Powder", "100 g", 50, "kd", ["lal mirch", "लाल मिर्च"]],
    ["Everest Coriander Powder", "100 g", 34, "kd", ["dhaniya", "धनिया"]],
    ["MDH Garam Masala", "100 g", 92, "kd", ["garam masala"]],
    ["MDH Chana Masala", "100 g", 80, "d"],
    ["Jeera", "100 g", 50, "kd", ["cumin", "जीरा"]],
    ["Lijjat Papad", "200 g", 70, "kd", ["papad", "पापड़"]],
    ["Mother's Recipe Mango Pickle", "500 g", 150, "kd", ["achar", "अचार"]],
    ["Dabur Honey", "250 g", 125, "d", ["shahad"]],
  ],
  Dairy: [
    ["Amul Taaza Milk", "500 ml", 28, "kdb", ["doodh", "दूध", "milk"]],
    ["Amul Gold Milk", "500 ml", 34, "kdb", ["doodh", "दूध", "milk"]],
    ["Mother Dairy Full Cream Milk", "500 ml", 34, "db", ["doodh", "milk"]],
    ["Amul Butter", "100 g", 58, "kdb", ["makhan", "मक्खन"]],
    ["Amul Cheese Slices", "200 g", 145, "db", ["cheese"]],
    ["Amul Paneer", "200 g", 95, "kdb", ["पनीर"]],
    ["Amul Masti Dahi", "400 g", 35, "kdb", ["dahi", "curd", "दही"]],
    ["Mother Dairy Dahi", "400 g", 35, "db", ["dahi", "curd"]],
    ["Amul Fresh Cream", "250 ml", 70, "db", ["cream", "malai"]],
    ["Amul Lassi", "200 ml", 25, "bp", ["lassi", "लस्सी"]],
    ["Amul Kool", "180 ml", 30, "bp", ["kool"]],
    ["Eggs", "6 pcs", 48, "kdb", ["ande", "अंडे", "anda"]],
    ["Amul Buttermilk", "200 ml", 15, "kbp", ["chaas", "chhach", "छाछ"]],
    ["Mother Dairy Mishti Doi", "85 g", 20, "b", ["mishti doi"]],
    ["Amul Shrikhand", "200 g", 70, "db", ["shrikhand"]],
  ],
  Bakery: [
    ["Britannia White Bread", "400 g", 45, "kdb", ["bread", "double roti", "ब्रेड"]],
    ["Modern Brown Bread", "400 g", 55, "db", ["brown bread"]],
    ["Pav", "6 pcs", 30, "b", ["pav", "पाव"]],
    ["Bun", "4 pcs", 30, "b", ["bun"]],
    ["Britannia Toastea Rusk", "200 g", 40, "kdb", ["rusk", "toast", "रस्क"]],
    ["Britannia Fruit Cake", "60 g", 20, "kdbp", ["cake"]],
    ["Cream Roll", "1 pc", 10, "bp"],
    ["Khari Biscuit", "200 g", 50, "b", ["khari"]],
    ["Nankhatai", "200 g", 60, "b"],
    ["Atta Cookies", "200 g", 60, "b", ["cookies"]],
    ["Muffin", "1 pc", 25, "b"],
    ["Veg Puff", "1 pc", 20, "b", ["puff", "patties"]],
    ["Burger Bun", "4 pcs", 40, "b"],
    ["Pizza Base", "2 pcs", 40, "bd"],
  ],
  Biscuits: [
    ["Parle-G", "80 g", 10, "kdp", ["parle g", "parle", "पारले"]],
    ["Parle-G", "250 g", 25, "kd", ["parle g", "parle"]],
    ["Britannia Good Day Cashew", "60 g", 10, "kdp", ["good day"]],
    ["Britannia Marie Gold", "250 g", 40, "kd", ["marie"]],
    ["Parle Monaco", "75 g", 10, "kdp", ["monaco"]],
    ["Parle Krackjack", "60 g", 10, "kdp", ["krackjack"]],
    ["Britannia Tiger", "60 g", 10, "kp", ["tiger"]],
    ["Britannia Milk Bikis", "60 g", 10, "kp", ["milk bikis"]],
    ["Parle Hide & Seek", "100 g", 30, "kdp", ["hide and seek"]],
    ["Oreo", "120 g", 35, "kdp"],
    ["Britannia Bourbon", "150 g", 40, "kd", ["bourbon"]],
    ["Sunfeast Dark Fantasy Choco Fills", "75 g", 40, "dp", ["dark fantasy"]],
  ],
  Snacks: [
    ["Lay's Classic Salted", "50 g", 20, "kdp", ["lays", "chips"]],
    ["Lay's India's Magic Masala", "50 g", 20, "kdp", ["lays", "magic masala"]],
    ["Kurkure Masala Munch", "75 g", 20, "kdp", ["kurkure"]],
    ["Bingo Mad Angles", "66 g", 20, "kdp", ["bingo"]],
    ["Uncle Chipps", "50 g", 20, "p", ["chips"]],
    ["Haldiram's Aloo Bhujia", "200 g", 55, "kdp", ["bhujia", "भुजिया"]],
    ["Haldiram's Navratan Mix", "200 g", 60, "kd", ["namkeen", "नमकीन"]],
    ["Haldiram's Moong Dal", "200 g", 55, "kd", ["namkeen"]],
    ["Bikaji Bikaneri Bhujia", "200 g", 55, "d", ["bhujia"]],
  ],
  "Instant food": [
    ["Maggi 2-Minute Noodles", "70 g", 14, "kdp", ["maggi", "मैगी"]],
    ["Maggi 2-Minute Noodles (4 pack)", "280 g", 56, "kd", ["maggi"]],
    ["Sunfeast Yippee Noodles", "65 g", 15, "kd", ["yippee"]],
    ["Saffola Masala Oats", "40 g", 15, "kd", ["oats"]],
    ["Saffola Oats", "1 kg", 199, "d", ["oats"]],
    ["Kellogg's Corn Flakes", "475 g", 205, "d", ["cornflakes"]],
    ["MTR Rava Idli Mix", "500 g", 120, "d", ["idli mix"]],
    ["Kissan Tomato Ketchup", "500 g", 125, "kd", ["ketchup", "sauce"]],
    ["Kissan Mixed Fruit Jam", "500 g", 175, "d", ["jam"]],
    ["Maggi Masala-ae-Magic", "6 g", 5, "k", ["masala magic"]],
  ],
  Beverages: [
    ["Coca-Cola", "750 ml", 40, "kdp", ["coke", "cold drink"]],
    ["Thums Up", "750 ml", 40, "kdp", ["thumbs up", "cold drink"]],
    ["Sprite", "750 ml", 40, "kdp", ["cold drink"]],
    ["Limca", "750 ml", 40, "kp", ["cold drink"]],
    ["Maaza", "600 ml", 45, "kdp", ["mango drink"]],
    ["Frooti", "125 ml", 10, "kdp"],
    ["Real Fruit Juice", "1 L", 120, "d", ["juice"]],
    ["Bisleri Water", "1 L", 20, "kdbp", ["paani", "water", "पानी"]],
    ["Sting Energy Drink", "250 ml", 20, "p", ["sting"]],
    ["Red Bull", "250 ml", 125, "dp"],
    ["Bournvita", "500 g", 245, "kd"],
    ["Horlicks", "500 g", 245, "d"],
  ],
  Chocolates: [
    ["Cadbury Dairy Milk", "13 g", 10, "kdp", ["dairy milk", "chocolate"]],
    ["Cadbury 5 Star", "20 g", 10, "kdp", ["five star"]],
    ["Cadbury Perk", "13 g", 10, "kdp", ["perk"]],
    ["Nestle KitKat", "2 finger", 10, "kdp", ["kitkat"]],
    ["Nestle Munch", "10 g", 10, "kp", ["munch"]],
    ["Cadbury Eclairs", "1 pc", 1, "kp", ["eclairs", "toffee"]],
    ["Pulse Candy", "1 pc", 1, "kp", ["pulse", "toffee"]],
    ["Alpenliebe", "1 pc", 1, "kp", ["toffee"]],
    ["Center Fresh", "1 pc", 2, "p", ["chewing gum"]],
    ["Pass Pass", "1 pc", 2, "p", ["mouth freshener"]],
    ["Saunf Mouth Freshener", "100 g", 40, "p", ["saunf", "सौंफ"]],
  ],
  "Personal care": [
    ["Lifebuoy Soap", "125 g", 38, "kd", ["sabun", "साबुन"]],
    ["Lux Soap", "100 g", 45, "kd", ["sabun"]],
    ["Santoor Soap", "100 g", 40, "kd", ["sabun"]],
    ["Dettol Soap", "75 g", 45, "kd", ["sabun"]],
    ["Dove Soap", "100 g", 70, "d"],
    ["Clinic Plus Shampoo Sachet", "1 pc", 2, "kp", ["shampoo"]],
    ["Head & Shoulders Shampoo", "180 ml", 220, "d", ["shampoo"]],
    ["Colgate Strong Teeth", "100 g", 62, "kd", ["colgate", "toothpaste", "manjan"]],
    ["Pepsodent", "100 g", 55, "d", ["toothpaste"]],
    ["Colgate Toothbrush", "1 pc", 25, "kd", ["brush"]],
    ["Parachute Coconut Oil", "100 ml", 48, "kd", ["nariyal tel", "coconut oil"]],
    ["Dabur Amla Hair Oil", "100 ml", 60, "d", ["amla tel"]],
    ["Gillette Guard Razor", "1 pc", 30, "kd", ["razor"]],
    ["Whisper Choice", "6 pads", 45, "kd", ["whisper", "pads"]],
    ["Pond's Dreamflower Talc", "100 g", 90, "d", ["powder"]],
    ["Himalaya Neem Face Wash", "100 ml", 150, "d", ["face wash"]],
  ],
  Household: [
    ["Surf Excel Easy Wash", "1 kg", 145, "kd", ["surf", "washing powder"]],
    ["Rin Detergent Powder", "1 kg", 104, "kd", ["rin", "washing powder"]],
    ["Tide Plus", "1 kg", 128, "kd", ["tide"]],
    ["Wheel Detergent Powder", "1 kg", 75, "kd", ["wheel"]],
    ["Vim Bar", "155 g", 15, "kd", ["vim", "bartan sabun"]],
    ["Vim Liquid", "250 ml", 55, "d"],
    ["Harpic Power Plus", "500 ml", 104, "kd", ["harpic"]],
    ["Lizol Floor Cleaner", "500 ml", 119, "d", ["lizol", "phenyl"]],
    ["Colin Glass Cleaner", "500 ml", 110, "d"],
    ["Good Knight Refill", "45 ml", 85, "kd", ["good knight", "machhar"]],
    ["Mortein Coil", "10 pcs", 40, "k", ["coil", "machhar coil"]],
    ["Scotch-Brite Scrub Pad", "1 pc", 20, "kd", ["scrubber"]],
    ["Cycle Agarbatti 3 in 1", "1 pack", 50, "kd", ["agarbatti", "अगरबत्ती"]],
    ["Ship Matchbox", "10 boxes", 10, "kp", ["machis", "माचिस"]],
  ],
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const STARTER_ITEMS: StarterItem[] = Object.entries(ROWS).flatMap(([category, rows]) =>
  rows.map(([name, unit, rupees, types, aliases = []]) => ({
    key: `${slug(name)}-${slug(unit)}`,
    name,
    unit,
    pricePaise: rupees * 100,
    category,
    types: [...types].map((code) => TYPE_CODES[code]),
    aliases,
  })),
);

export const starterFor = (type: ShopType) => STARTER_ITEMS.filter((item) => item.types.includes(type));

// Words of a product name, without case, pack sizes or punctuation, for
// matching a name read off a shelf or bill to a list item.
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !/^\d+(g|kg|ml|l|pcs?)?$/.test(w));
}

// The list item a name most likely means, or null: every word of one name
// must appear in the other, and most words must be shared, so a bare
// "Maggi" matches nothing rather than guessing a pack. Only used to suggest
// a price the owner still checks.
export function matchStarter(name: string, unit?: string | null): StarterItem | null {
  const read = new Set(words(name));
  if (read.size === 0) return null;
  let best: { item: StarterItem; score: number } | null = null;
  for (const item of STARTER_ITEMS) {
    const own = words(item.name);
    const shared = own.filter((w) => read.has(w)).length;
    if (shared === 0 || (shared < own.length && shared < read.size)) continue;
    // Prefer the closest name, then the same pack size.
    let score = shared / Math.max(own.length, read.size);
    if (unit && item.unit.replace(/\s/g, "").toLowerCase() === unit.replace(/\s/g, "").toLowerCase()) score += 0.5;
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 0.6 ? best.item : null;
}

// The list to open first, from the shop's category as the owner said it.
export function typeForCategory(category: string | null | undefined): ShopType {
  const text = (category ?? "").toLowerCase();
  if (/dairy|bakery|milk|doodh|डेयरी|बेकरी/.test(text)) return "dairy_bakery";
  if (/\bpan\b|paan|पान/.test(text)) return "pan";
  if (/department|supermarket|general store|super market|mart/.test(text)) return "departmental";
  return "kirana";
}

// How a product is told apart from the shop's others: name and pack size,
// without case. The server skips duplicates the same way.
export const haveKey = (name: string, unit: string | null | undefined) => `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
