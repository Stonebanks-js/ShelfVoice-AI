import {
  Apple,
  Candy,
  Cookie,
  Croissant,
  CupSoda,
  Droplets,
  Egg,
  Milk,
  Package,
  SprayCan,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";

// A product's face (E-37): its photo when the shop has one, otherwise a tile
// in its category's colour with a drawn mark, so a list of products reads
// like a shelf instead of a column of identical icons.

type Look = { tone: number; icon: LucideIcon };

// Matched against the product's name first (eggs in Dairy get an egg), then
// its category; English and Hindi words, since owners speak both.
const LOOKS: Array<[RegExp, Look]> = [
  [/egg|anda|अंडा/i, { tone: 1, icon: Egg }],
  [/dairy|milk|butter|paneer|curd|dahi|ghee|cheese|doodh|दूध|मक्खन|पनीर|दही|घी/i, { tone: 1, icon: Milk }],
  [/bread|bakery|bun|pav|rusk|cake|ब्रेड/i, { tone: 7, icon: Croissant }],
  [/biscuit|cookie|parle|marie|बिस्कुट/i, { tone: 3, icon: Cookie }],
  [/snack|namkeen|chips|kurkure|lays|bhujia|maggi|noodle|नमकीन|मैगी/i, { tone: 3, icon: Cookie }],
  [/sweet|chocolate|candy|toffee|mithai|मिठाई/i, { tone: 5, icon: Candy }],
  [/beverage|drink|tea|chai|coffee|juice|cola|soda|water|चाय|पानी/i, { tone: 4, icon: CupSoda }],
  [/\boil\b|\btel\b|तेल/i, { tone: 2, icon: Droplets }],
  [/staple|atta|flour|rice|chawal|dal|sugar|salt|namak|wheat|grain|आटा|चावल|दाल|चीनी|नमक/i, { tone: 2, icon: Wheat }],
  [/personal|soap|shampoo|toothpaste|colgate|cream|lotion|साबुन/i, { tone: 5, icon: Droplets }],
  [/household|clean|detergent|surf|vim|harpic|phenyl|सफाई/i, { tone: 6, icon: SprayCan }],
  [/fruit|vegetable|sabzi|apple|banana|onion|potato|tomato|फल|सब्जी/i, { tone: 8, icon: Apple }],
];

function lookFor(name: string, category?: string | null): Look {
  for (const text of [name, category]) {
    if (!text) continue;
    const hit = LOOKS.find(([pattern]) => pattern.test(text));
    if (hit) return hit[1];
  }
  // Anything else keeps a steady colour of its own, picked from its name.
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { tone: (hash % 8) + 1, icon: Package };
}

const SIZE = {
  sm: "size-10 rounded-md [&>svg]:size-5",
  md: "size-12 rounded-md [&>svg]:size-6",
  lg: "aspect-square w-full rounded-lg [&>svg]:size-[38%]",
} as const;

export function ProductThumb({
  name,
  category,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  category?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- shop photos come from Storage at their own size
      <img src={imageUrl} alt="" loading="lazy" className={cn("shrink-0 bg-surface-2 object-cover", SIZE[size], className)} />
    );
  }
  const { tone, icon: Icon } = lookFor(name, category);
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center", SIZE[size], className)}
      style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-fg)` }}
    >
      <Icon strokeWidth={1.75} />
    </span>
  );
}
