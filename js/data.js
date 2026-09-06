/**
 * Catalogue + copy for the KESTRA storefront.
 * Colours here drive both the CSS accent theme and the 3D can artwork,
 * so every product only needs describing once.
 */

export const BRAND = {
  name: 'KESTRA',
  legal: 'Kestra Beverage Co.',
  domain: 'KESTRA.CO',
  claim: 'Sparkling energy, engineered.',
  // Named for the kestrel, which holds a dead-still hover in a forty-mile wind
  // by correcting continuously. That is the product, not the marketing.
  origin:
    'Named for the kestrel, which hangs dead still in a forty-mile wind by correcting continuously. Not more energy. Better held.',
  city: 'RENO NV',
  freeShippingAt: 45,
};

export const PRODUCTS = [
  {
    id: 'solstice',
    index: '01',
    name: 'Solstice',
    flavour: 'Blood Orange · Bergamot',
    accent: '#FF6B2C',
    accentDeep: '#7A2A05',
    ink: '#1A0B03',
    caffeine: 180,
    sugar: 0,
    calories: 15,
    rating: 4.8,
    reviews: 2841,
    badges: ['Zero sugar', 'Bestseller'],
    blurb:
      'Cold-pressed blood orange cut with Calabrian bergamot. Bright on the front, dry on the finish — the one most people start with.',
    notes: ['Blood orange peel', 'Bergamot oil', 'Pink grapefruit', 'Sea salt'],
  },
  {
    id: 'glacier',
    index: '02',
    name: 'Glacier',
    flavour: 'Yuzu · White Peach',
    accent: '#5CD3E8',
    accentDeep: '#0A4655',
    ink: '#03151A',
    caffeine: 150,
    sugar: 0,
    calories: 10,
    rating: 4.7,
    reviews: 1964,
    badges: ['Zero sugar', 'Light roast caffeine'],
    blurb:
      'Japanese yuzu over white peach. The cleanest thing we make: almost no body, a long cold finish, nothing left on the palate.',
    notes: ['Yuzu zest', 'White peach', 'Green tea', 'Cucumber'],
  },
  {
    id: 'vesper',
    index: '03',
    name: 'Vesper',
    flavour: 'Black Cherry · Cola Nut',
    accent: '#E23E62',
    accentDeep: '#5E0C1F',
    ink: '#190207',
    caffeine: 200,
    sugar: 2,
    calories: 25,
    rating: 4.9,
    reviews: 3320,
    badges: ['Highest caffeine', 'Editor pick'],
    blurb:
      'Dark cherry, cola nut and a whisper of vanilla. The heaviest pour in the range — built for the back half of a long day.',
    notes: ['Black cherry', 'Cola nut', 'Bourbon vanilla', 'Cocoa husk'],
  },
  {
    id: 'aurora',
    index: '04',
    name: 'Aurora',
    flavour: 'Alpine Berry · Hibiscus',
    accent: '#8C6BFF',
    accentDeep: '#2E1B72',
    ink: '#0B0620',
    caffeine: 160,
    sugar: 0,
    calories: 10,
    rating: 4.6,
    reviews: 1408,
    badges: ['Zero sugar'],
    blurb:
      'Wild bilberry and blackcurrant lifted with hibiscus. Floral without being sweet, and the only one that stains the glass.',
    notes: ['Bilberry', 'Blackcurrant', 'Hibiscus', 'Elderflower'],
  },
  {
    id: 'verde',
    index: '05',
    name: 'Verde',
    flavour: 'Kiwi · Lime Leaf',
    accent: '#63D94F',
    accentDeep: '#154D0F',
    ink: '#04140A',
    caffeine: 150,
    sugar: 0,
    calories: 10,
    rating: 4.5,
    reviews: 987,
    badges: ['Zero sugar', 'New'],
    blurb:
      'Green kiwi with kaffir lime leaf and a green-mango edge. Sharp, herbal and faintly savoury — an acquired favourite.',
    notes: ['Kiwi', 'Kaffir lime leaf', 'Green mango', 'Basil'],
  },
  {
    id: 'monsoon',
    index: '06',
    name: 'Monsoon',
    flavour: 'Guava · Coconut Water',
    accent: '#14C6A4',
    accentDeep: '#0A4A3E',
    ink: '#03150F',
    caffeine: 160,
    sugar: 3,
    calories: 30,
    rating: 4.7,
    reviews: 1655,
    badges: ['With electrolytes'],
    blurb:
      'Pink guava and young coconut water with added magnesium and potassium. The one to reach for after heat or altitude.',
    notes: ['Pink guava', 'Coconut water', 'Lime', 'Pink salt'],
  },
];

/** Pack tiers are shared across every SKU. */
export const PACKS = [
  { id: '4', cans: 4, price: 14, label: '4 cans' },
  { id: '12', cans: 12, price: 36, label: '12 cans', tag: 'Most popular' },
  { id: '24', cans: 24, price: 66, label: '24 cans', tag: 'Best value' },
];

export const SUBSCRIPTION_DISCOUNT = 0.15;

export const FORMULA = [
  {
    label: 'Caffeine',
    amount: '150–200 mg',
    source: 'Green coffee bean',
    note: 'Extracted from unroasted arabica rather than synthesised. Releases over roughly forty minutes instead of all at once.',
  },
  {
    label: 'L-theanine',
    amount: '200 mg',
    source: 'Camellia sinensis',
    note: 'Paired 1:1 against caffeine. Takes the edge off the peak and is the reason there is no shake at the top.',
  },
  {
    label: 'Electrolytes',
    amount: '380 mg',
    source: 'Sea mineral complex',
    note: 'Sodium, potassium and magnesium in the ratio you actually lose them. Replaces what a hard hour costs you.',
  },
  {
    label: 'B-complex',
    amount: 'B3 · B6 · B12',
    source: 'Methylated forms',
    note: 'Methylcobalamin over cyanocobalamin, because a third of people convert the cheap one poorly.',
  },
];

export const SPECS = [
  { k: 'Volume', v: '355 mL / 12 fl oz' },
  { k: 'Carbonation', v: '3.4 volumes CO₂' },
  { k: 'Sweetener', v: 'Allulose + steviol glycosides' },
  { k: 'Colour', v: 'From fruit and vegetable concentrate' },
  { k: 'Can', v: '73% recycled aluminium' },
  { k: 'Serve', v: '2–4 °C, straight from the can' },
];

export const REVIEWS = [
  {
    name: 'Dana Okonjo',
    role: 'Trauma surgeon · Chicago',
    product: 'Vesper',
    rating: 5,
    body:
      'I work fourteen-hour nights and I have tried everything on the shelf. This is the first one that does not leave me jittery at hour ten or flattened at hour twelve. The taper is the whole point.',
  },
  {
    name: 'Marcus Feld',
    role: 'Cat 2 road cyclist · Girona',
    product: 'Monsoon',
    rating: 5,
    body:
      'The electrolyte load is real, not decorative. I run one on the second climb of a five-hour ride and I am not cramping at the top any more. It also does not taste like sunscreen, which is a low bar the category keeps failing.',
  },
  {
    name: 'Priya Raghunathan',
    role: 'Games producer · Montréal',
    product: 'Glacier',
    rating: 4,
    body:
      'Extremely clean. Almost too clean — the first can felt like it was not doing anything, and then I noticed I had been heads-down for three hours. Wish the yuzu came through a touch harder.',
  },
  {
    name: 'Tobias Lindqvist',
    role: 'Bakery owner · Malmö',
    product: 'Solstice',
    rating: 5,
    body:
      'Four in the morning, five days a week, for eight months. The bergamot keeps it from getting boring, which matters more than anyone admits when you drink the same thing every day.',
  },
  {
    name: 'Elena Vasquez',
    role: 'Air traffic controller · Denver',
    product: 'Aurora',
    rating: 4,
    body:
      'I am not allowed to be wrong at hour six, so I care about this more than most people. It holds. My only complaint is that the hibiscus is louder than the berry, which is the opposite of what the can implies.',
  },
  {
    name: 'Sam Whitfield',
    role: 'Long-haul driver · Nashville',
    product: 'Verde',
    rating: 5,
    body:
      'Bought a case expecting to hate the savoury one and now it is the only thing in the cab. It is the only energy drink I have had that does not get sickly by the third can of the week.',
  },
];

export const FAQ = [
  {
    q: 'How much caffeine is in a can?',
    a: 'Between 150 mg and 200 mg depending on the flavour, printed on every can. For reference a double espresso is around 130 mg. Vesper is the strongest at 200 mg; Glacier and Verde sit at 150 mg.',
  },
  {
    q: 'Why does it not give me the crash?',
    a: 'Two reasons. The caffeine comes from green coffee bean extract, which enters the bloodstream more gradually than the synthetic caffeine anhydrous most of the category uses. And every can carries 200 mg of L-theanine, which blunts the peak. You get a longer, lower curve instead of a spike and a hole.',
  },
  {
    q: 'Is it actually zero sugar?',
    a: 'Four of the six are: Solstice, Glacier, Aurora and Verde. Vesper carries 2 g and Monsoon 3 g, both from real fruit concentrate rather than added sugar. We sweeten with allulose and a small amount of steviol glycoside, so there is no cooling aftertaste.',
  },
  {
    q: 'How does the subscription work?',
    a: 'Pick your cans and a cadence — every two, four or six weeks. You save 15% on every order, shipping is always free, and you can skip, swap flavours, change the date or cancel from your account with no phone call and no retention script.',
  },
  {
    q: 'When will it arrive?',
    a: 'Orders placed before 2pm ship the same working day. Two to three days across the contiguous US, four to six for Alaska, Hawaii and Canada. Free over $45. Every order is tracked from the moment it leaves the warehouse in Reno.',
  },
  {
    q: 'What if I do not like it?',
    a: 'Drink the whole pack and tell us it was not for you within thirty days. We refund it in full and you keep the cans — sending part-used drinks back helps nobody.',
  },
];
