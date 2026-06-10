// Grocery-store categories, in the order you'd walk the aisles.
export const CATEGORIES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Frozen",
  "Snacks",
  "Beverages",
  "Household",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_EMOJI: Record<Category, string> = {
  Produce: "🥦",
  "Meat & Seafood": "🥩",
  "Dairy & Eggs": "🥛",
  Bakery: "🍞",
  Pantry: "🥫",
  Frozen: "🧊",
  Snacks: "🍿",
  Beverages: "🧃",
  Household: "🧻",
  Other: "🛒",
};

// Keyword → category. Longer/multi-word keywords are checked first so
// "cream cheese" wins over "cream" and "peanut butter" over "butter".
const KEYWORDS: Record<string, Category> = {
  // Produce
  apple: "Produce", banana: "Produce", orange: "Produce", lemon: "Produce",
  lime: "Produce", grape: "Produce", berry: "Produce", berries: "Produce",
  strawberr: "Produce", blueberr: "Produce", raspberr: "Produce",
  melon: "Produce", watermelon: "Produce", pineapple: "Produce",
  mango: "Produce", peach: "Produce", pear: "Produce", plum: "Produce",
  avocado: "Produce", tomato: "Produce", potato: "Produce", onion: "Produce",
  garlic: "Produce", ginger: "Produce", carrot: "Produce", celery: "Produce",
  broccoli: "Produce", cauliflower: "Produce", spinach: "Produce",
  kale: "Produce", lettuce: "Produce", arugula: "Produce", cabbage: "Produce",
  "green bean": "Produce", "green beans": "Produce", zucchini: "Produce",
  squash: "Produce", cucumber: "Produce", pepper: "Produce",
  "bell pepper": "Produce", jalapeno: "Produce", jalapeño: "Produce",
  mushroom: "Produce", asparagus: "Produce", corn: "Produce",
  scallion: "Produce", "green onion": "Produce", leek: "Produce",
  shallot: "Produce", cilantro: "Produce", parsley: "Produce",
  basil: "Produce", mint: "Produce", rosemary: "Produce", thyme: "Produce",
  dill: "Produce", chive: "Produce", salad: "Produce", slaw: "Produce",
  "bok choy": "Produce", edamame: "Produce", radish: "Produce",
  beet: "Produce", "sweet potato": "Produce", herbs: "Produce",
  fruit: "Produce", kiwi: "Produce", cherr: "Produce", apricot: "Produce",

  // Meat & Seafood
  chicken: "Meat & Seafood", beef: "Meat & Seafood", steak: "Meat & Seafood",
  "ground beef": "Meat & Seafood", "ground turkey": "Meat & Seafood",
  pork: "Meat & Seafood", bacon: "Meat & Seafood", sausage: "Meat & Seafood",
  ham: "Meat & Seafood", turkey: "Meat & Seafood", lamb: "Meat & Seafood",
  ribs: "Meat & Seafood", brisket: "Meat & Seafood",
  "hot dog": "Meat & Seafood", "hot dogs": "Meat & Seafood",
  salami: "Meat & Seafood", prosciutto: "Meat & Seafood",
  pepperoni: "Meat & Seafood", chorizo: "Meat & Seafood",
  fish: "Meat & Seafood", salmon: "Meat & Seafood", tuna: "Meat & Seafood",
  shrimp: "Meat & Seafood", scallop: "Meat & Seafood", crab: "Meat & Seafood",
  lobster: "Meat & Seafood", cod: "Meat & Seafood", tilapia: "Meat & Seafood",
  halibut: "Meat & Seafood", mussel: "Meat & Seafood", clam: "Meat & Seafood",
  oyster: "Meat & Seafood", calamari: "Meat & Seafood",
  sashimi: "Meat & Seafood", "deli meat": "Meat & Seafood",

  // Dairy & Eggs
  milk: "Dairy & Eggs", cream: "Dairy & Eggs", "half and half": "Dairy & Eggs",
  "heavy cream": "Dairy & Eggs", "whipping cream": "Dairy & Eggs",
  "sour cream": "Dairy & Eggs", "cream cheese": "Dairy & Eggs",
  butter: "Dairy & Eggs", cheese: "Dairy & Eggs", cheddar: "Dairy & Eggs",
  mozzarella: "Dairy & Eggs", parmesan: "Dairy & Eggs", feta: "Dairy & Eggs",
  ricotta: "Dairy & Eggs", brie: "Dairy & Eggs", gouda: "Dairy & Eggs",
  swiss: "Dairy & Eggs", provolone: "Dairy & Eggs", burrata: "Dairy & Eggs",
  yogurt: "Dairy & Eggs", egg: "Dairy & Eggs", eggs: "Dairy & Eggs",
  "cottage cheese": "Dairy & Eggs", "oat milk": "Dairy & Eggs",
  "almond milk": "Dairy & Eggs", "soy milk": "Dairy & Eggs",
  ghee: "Dairy & Eggs", buttermilk: "Dairy & Eggs", queso: "Dairy & Eggs",

  // Bakery
  bread: "Bakery", bagel: "Bakery", bagels: "Bakery", bun: "Bakery",
  buns: "Bakery", roll: "Bakery", rolls: "Bakery", baguette: "Bakery",
  croissant: "Bakery", muffin: "Bakery", tortilla: "Bakery",
  tortillas: "Bakery", pita: "Bakery", naan: "Bakery",
  sourdough: "Bakery", brioche: "Bakery", ciabatta: "Bakery",
  "english muffin": "Bakery", "hamburger bun": "Bakery",
  "hot dog bun": "Bakery", cake: "Bakery", pie: "Bakery", donut: "Bakery",

  // Pantry
  pasta: "Pantry", spaghetti: "Pantry", penne: "Pantry", macaroni: "Pantry",
  noodle: "Pantry", noodles: "Pantry", udon: "Pantry", ramen: "Pantry",
  rice: "Pantry", quinoa: "Pantry", couscous: "Pantry", lentil: "Pantry",
  bean: "Pantry", beans: "Pantry", "black beans": "Pantry",
  chickpea: "Pantry", "garbanzo": "Pantry", flour: "Pantry",
  sugar: "Pantry", "brown sugar": "Pantry", honey: "Pantry",
  "maple syrup": "Pantry", salt: "Pantry", "black pepper": "Pantry",
  "olive oil": "Pantry", "vegetable oil": "Pantry", "canola oil": "Pantry",
  "sesame oil": "Pantry", "coconut oil": "Pantry", oil: "Pantry",
  vinegar: "Pantry", "soy sauce": "Pantry", "fish sauce": "Pantry",
  "oyster sauce": "Pantry", "hoisin": "Pantry", sriracha: "Pantry",
  "hot sauce": "Pantry", ketchup: "Pantry", mustard: "Pantry",
  mayo: "Pantry", mayonnaise: "Pantry", "bbq sauce": "Pantry",
  "tomato sauce": "Pantry", "tomato paste": "Pantry", "pasta sauce": "Pantry",
  marinara: "Pantry", salsa: "Pantry", "canned tomato": "Pantry",
  "crushed tomato": "Pantry", "diced tomato": "Pantry", broth: "Pantry",
  stock: "Pantry", "chicken broth": "Pantry", "coconut milk": "Pantry",
  "curry paste": "Pantry", curry: "Pantry", "peanut butter": "Pantry",
  jam: "Pantry", jelly: "Pantry", nutella: "Pantry", cereal: "Pantry",
  oats: "Pantry", oatmeal: "Pantry", granola: "Pantry",
  "bread crumbs": "Pantry", breadcrumbs: "Pantry", panko: "Pantry",
  "baking powder": "Pantry", "baking soda": "Pantry", vanilla: "Pantry",
  cinnamon: "Pantry", cumin: "Pantry", paprika: "Pantry", oregano: "Pantry",
  "chili powder": "Pantry", "garlic powder": "Pantry",
  "onion powder": "Pantry", turmeric: "Pantry", spice: "Pantry",
  seasoning: "Pantry", "taco seasoning": "Pantry", nuts: "Pantry",
  almond: "Pantry", walnut: "Pantry", pecan: "Pantry", cashew: "Pantry",
  peanut: "Pantry", "pine nut": "Pantry", "sesame seed": "Pantry",
  tahini: "Pantry", miso: "Pantry", mirin: "Pantry", sake: "Pantry",
  "rice wine": "Pantry", cornstarch: "Pantry", "corn starch": "Pantry",
  yeast: "Pantry", chocolate: "Pantry", "chocolate chip": "Pantry",
  raisin: "Pantry", "dried": "Pantry", "canned": "Pantry", soup: "Pantry",
  "mac n cheese": "Pantry", "mac and cheese": "Pantry", risotto: "Pantry",
  arborio: "Pantry", gnocchi: "Pantry", "olive": "Pantry", caper: "Pantry",
  anchov: "Pantry", "wine for cooking": "Pantry", wasabi: "Pantry",
  "nori": "Pantry", "seaweed": "Pantry", "sushi rice": "Pantry",

  // Frozen
  frozen: "Frozen", "ice cream": "Frozen", popsicle: "Frozen",
  "frozen pizza": "Frozen", "frozen peas": "Frozen", "frozen corn": "Frozen",
  "frozen fruit": "Frozen", "frozen berries": "Frozen", waffles: "Frozen",
  "tater tot": "Frozen", "french fries": "Frozen", "fish stick": "Frozen",
  "pot sticker": "Frozen", potsticker: "Frozen", dumpling: "Frozen",
  "ice": "Frozen",

  // Snacks
  chips: "Snacks", crackers: "Snacks", pretzel: "Snacks", popcorn: "Snacks",
  cookie: "Snacks", cookies: "Snacks", "granola bar": "Snacks",
  "fruit snack": "Snacks", "trail mix": "Snacks", candy: "Snacks",
  gummy: "Snacks", "rice cake": "Snacks", "cheese stick": "Snacks",
  "string cheese": "Snacks", goldfish: "Snacks", "snack": "Snacks",

  // Beverages
  water: "Beverages", "sparkling water": "Beverages", soda: "Beverages",
  juice: "Beverages", "orange juice": "Beverages", "apple juice": "Beverages",
  coffee: "Beverages", tea: "Beverages", "iced tea": "Beverages",
  lemonade: "Beverages", kombucha: "Beverages", wine: "Beverages",
  beer: "Beverages", "la croix": "Beverages", lacroix: "Beverages",
  gatorade: "Beverages", "hot chocolate": "Beverages", cocoa: "Beverages",

  // Household
  "paper towel": "Household", "paper towels": "Household",
  "toilet paper": "Household", napkin: "Household", "trash bag": "Household",
  "garbage bag": "Household", "ziploc": "Household", "zip lock": "Household",
  "sandwich bag": "Household", foil: "Household", "aluminum foil": "Household",
  "plastic wrap": "Household", "saran wrap": "Household",
  "parchment paper": "Household", "dish soap": "Household",
  detergent: "Household", "laundry": "Household", sponge: "Household",
  "hand soap": "Household", soap: "Household", shampoo: "Household",
  toothpaste: "Household", "dishwasher": "Household", cleaner: "Household",
  wipes: "Household", batteries: "Household", "light bulb": "Household",
  "dog food": "Household", "cat food": "Household", "pet food": "Household",
};

// Multi-word keywords first, then longer single words, so the most
// specific match wins.
const ORDERED_KEYWORDS = Object.keys(KEYWORDS).sort((a, b) => {
  const aw = a.includes(" ") ? 1 : 0;
  const bw = b.includes(" ") ? 1 : 0;
  if (aw !== bw) return bw - aw;
  return b.length - a.length;
});

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function categorize(name: string): Category {
  const n = normalizeItemName(name);
  for (const kw of ORDERED_KEYWORDS) {
    if (kw.includes(" ") || kw.length <= 4) {
      // short or multi-word keywords need word-boundary matching (with an
      // optional plural) to avoid e.g. "egg" matching "eggplant"
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^a-z])${esc}(e?s)?([^a-z]|$)`, "i");
      if (re.test(n)) return KEYWORDS[kw];
    } else if (n.includes(kw)) {
      return KEYWORDS[kw];
    }
  }
  return "Other";
}
