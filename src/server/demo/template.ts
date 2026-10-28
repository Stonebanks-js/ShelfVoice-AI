// The seeded demo shop behind "Try the demo shop" (doc 01, doc 03): 15 common
// kirana products and 90 days of generated sales and deliveries, so the
// order list has real data on camera. A fixed seed makes every copy, and
// every test run, identical. Final stock levels follow the Key Screens order
// list with errata E-19 applied.
export interface TemplateProduct {
  name: string;
  aliases: string[];
  category: string;
  unit: string;
  pricePaise: number;
  dailyRate: number; // average units sold per day
  finalStock: number;
  packSize?: number;
}

export const DEMO_SHOP = {
  name: "Sharma Kirana Store",
  category: "Kirana",
  address: "Shastri Nagar, Meerut",
  phone: "+919876543210",
  hours: {
    mon: [["07:00", "22:00"]], tue: [["07:00", "22:00"]], wed: [["07:00", "22:00"]], thu: [["07:00", "22:00"]],
    fri: [["07:00", "22:00"]], sat: [["07:00", "22:00"]], sun: [["07:00", "22:00"]],
  },
};

export const DEMO_PRODUCTS: TemplateProduct[] = [
  { name: "Maggi 2-Minute Noodles", aliases: ["maggi", "मैगी"], category: "Snacks", unit: "70 g", pricePaise: 1400, dailyRate: 9, finalStock: 18 },
  { name: "Parle-G Biscuit", aliases: ["parle g", "parle", "पारले जी"], category: "Biscuits", unit: "pack", pricePaise: 1000, dailyRate: 20, finalStock: 60, packSize: 48 },
  { name: "Aashirvaad Atta", aliases: ["atta", "आटा"], category: "Atta and rice", unit: "5 kg", pricePaise: 24500, dailyRate: 3, finalStock: 3 },
  { name: "Amul Butter", aliases: ["butter", "मक्खन"], category: "Dairy", unit: "100 g", pricePaise: 5800, dailyRate: 2, finalStock: 9 },
  { name: "Surf Excel", aliases: ["surf"], category: "Household", unit: "1 kg", pricePaise: 14000, dailyRate: 1, finalStock: 3 },
  { name: "Tata Salt", aliases: ["namak", "नमक", "salt"], category: "Staples", unit: "1 kg", pricePaise: 2800, dailyRate: 4, finalStock: 30 },
  { name: "Fortune Sunflower Oil", aliases: ["oil", "tel", "तेल"], category: "Staples", unit: "1 L", pricePaise: 16500, dailyRate: 2, finalStock: 14 },
  { name: "Amul Taaza Milk", aliases: ["doodh", "दूध", "milk"], category: "Dairy", unit: "500 ml", pricePaise: 2800, dailyRate: 25, finalStock: 40 },
  { name: "Britannia Bread", aliases: ["bread", "double roti"], category: "Bakery", unit: "400 g", pricePaise: 4000, dailyRate: 6, finalStock: 8 },
  { name: "Eggs", aliases: ["anda", "अंडा", "ande"], category: "Dairy", unit: "12 pcs", pricePaise: 8400, dailyRate: 3, finalStock: 12 },
  { name: "Kurkure", aliases: ["kurkure masala munch"], category: "Snacks", unit: "pack", pricePaise: 2000, dailyRate: 8, finalStock: 35 },
  { name: "Thums Up", aliases: ["thumsup", "cold drink"], category: "Beverages", unit: "2 L", pricePaise: 9500, dailyRate: 2, finalStock: 10 },
  { name: "Colgate Toothpaste", aliases: ["colgate", "manjan"], category: "Personal care", unit: "100 g", pricePaise: 5500, dailyRate: 1, finalStock: 8 },
  { name: "Lux Soap", aliases: ["lux", "sabun", "साबुन"], category: "Personal care", unit: "100 g", pricePaise: 3500, dailyRate: 2, finalStock: 15 },
  { name: "Toor Dal", aliases: ["arhar dal", "dal", "दाल"], category: "Staples", unit: "1 kg", pricePaise: 14000, dailyRate: 2, finalStock: 11 },
];

// mulberry32: small, fast, seedable.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poisson(mean: number, random: () => number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > limit);
  return k - 1;
}

export interface TemplateMovement {
  productIndex: number;
  kind: "SALE" | "DELIVERY" | "CORRECTION";
  qty: number;
  day: number; // 0 = 89 days ago, 89 = today
}

// Simulates 90 days: an opening delivery, Poisson daily sales with a weekend
// lift, a delivery whenever stock drops below four days of demand, and a
// final correction so stock ends at the planned level. Stock never goes
// below zero, so the stock trigger accepts every row in order.
export function simulateHistory(seed = 20261104, days = 90): TemplateMovement[] {
  const random = rng(seed);
  const movements: TemplateMovement[] = [];
  DEMO_PRODUCTS.forEach((product, productIndex) => {
    let stock = product.dailyRate * 14;
    movements.push({ productIndex, kind: "DELIVERY", qty: stock, day: 0 });
    for (let day = 0; day < days; day++) {
      const weekday = (day + 3) % 7; // fixed calendar so weekends repeat
      const lift = weekday === 5 || weekday === 6 ? 1.3 : 1;
      const sold = Math.min(stock, poisson(product.dailyRate * lift, random));
      if (sold > 0) {
        movements.push({ productIndex, kind: "SALE", qty: sold, day });
        stock -= sold;
      }
      if (day < days - 1 && stock < product.dailyRate * 4) {
        const qty = product.dailyRate * 10;
        movements.push({ productIndex, kind: "DELIVERY", qty, day });
        stock += qty;
      }
    }
    const correction = product.finalStock - stock;
    if (correction !== 0) movements.push({ productIndex, kind: "CORRECTION", qty: correction, day: days - 1 });
  });
  return movements;
}
