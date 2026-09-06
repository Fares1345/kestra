/**
 * Catalogue and copy for the KESTRA storefront.
 *
 * Anything a customer reads is stored as an { en, ar } pair and resolved through
 * i18n.pick(). Prices are in Saudi riyal, VAT-inclusive, and every flavour
 * carries its own price, its own numbers and its own can design — `design`
 * selects a different printed layout in artwork.js, so the six cans are not one
 * template recoloured six times.
 */

export const BRAND = {
  name: 'KESTRA',
  legal: { en: 'Kestra Beverage Co.', ar: 'شركة كسترا للمشروبات' },
  domain: 'KESTRA.SA',
  city: { en: 'RIYADH KSA', ar: 'الرياض' },
  freeShippingAt: 200,
  email: 'hello@kestra.sa',
  phone: '+966 11 200 4470',
};

/* ------------------------------------------------------------------ *
 * the range
 * ------------------------------------------------------------------ */

export const PRODUCTS = [
  {
    id: 'solstice',
    index: '01',
    design: 'block', // wide colour field over a deep ink panel
    name: { en: 'Solstice', ar: 'سولستيس' },
    flavour: { en: 'Blood Orange · Bergamot', ar: 'برتقال دموي · برغموت' },
    accent: '#FF6B2C',
    accentDeep: '#7A2A05',
    ink: '#1A0B03',
    caffeine: 180,
    sugar: 0,
    calories: 15,
    rating: 4.8,
    reviews: 2841,
    packs: { 4: 55, 12: 145, 24: 265 },
    badges: [
      { en: 'Zero sugar', ar: 'بلا سكر' },
      { en: 'Bestseller', ar: 'الأكثر مبيعاً' },
    ],
    serve: { en: '2–4 °C, straight from the can', ar: '٢–٤ °م، مباشرة من العلبة' },
    blurb: {
      en: 'Cold-pressed blood orange cut with Calabrian bergamot. Bright on the front, dry on the finish — the one most people start with, and the one most people stay on.',
      ar: 'برتقال دموي معصور على البارد مع برغموت كالابري. حاد في البداية، جاف في النهاية — النكهة التي يبدأ بها معظم الناس ويبقون عليها.',
    },
    notes: {
      en: ['Blood orange peel', 'Bergamot oil', 'Pink grapefruit', 'Sea salt'],
      ar: ['قشر البرتقال الدموي', 'زيت البرغموت', 'جريب فروت وردي', 'ملح البحر'],
    },
  },
  {
    id: 'glacier',
    index: '02',
    design: 'gradient', // full-bleed wash, no panel, hairline type
    name: { en: 'Glacier', ar: 'غلاسير' },
    flavour: { en: 'Yuzu · White Peach', ar: 'يوزو · خوخ أبيض' },
    accent: '#5CD3E8',
    accentDeep: '#0A4655',
    ink: '#03151A',
    caffeine: 150,
    sugar: 0,
    calories: 10,
    rating: 4.7,
    reviews: 1964,
    packs: { 4: 55, 12: 145, 24: 265 },
    badges: [
      { en: 'Zero sugar', ar: 'بلا سكر' },
      { en: 'Lightest', ar: 'الأخف' },
    ],
    serve: { en: 'Over ice, with a twist of lime', ar: 'على الثلج مع شريحة ليمون' },
    blurb: {
      en: 'Japanese yuzu over white peach. The cleanest thing we make: almost no body, a long cold finish, nothing left on the palate.',
      ar: 'يوزو ياباني فوق خوخ أبيض. أنقى ما نصنع: قوام خفيف جداً، ونهاية باردة طويلة، ولا شيء يبقى على الحنك.',
    },
    notes: {
      en: ['Yuzu zest', 'White peach', 'Green tea', 'Cucumber'],
      ar: ['قشر اليوزو', 'خوخ أبيض', 'شاي أخضر', 'خيار'],
    },
  },
  {
    id: 'vesper',
    index: '03',
    design: 'split', // diagonal split, numeral carried large
    name: { en: 'Vesper', ar: 'فيسبر' },
    flavour: { en: 'Black Cherry · Cola Nut', ar: 'كرز أسود · جوز الكولا' },
    accent: '#E23E62',
    accentDeep: '#5E0C1F',
    ink: '#190207',
    caffeine: 200,
    sugar: 2,
    calories: 25,
    rating: 4.9,
    reviews: 3320,
    packs: { 4: 60, 12: 159, 24: 289 },
    badges: [
      { en: 'Highest caffeine', ar: 'أعلى كافيين' },
      { en: 'Editor pick', ar: 'اختيار المحرر' },
    ],
    serve: { en: 'Cold, late, and on its own', ar: 'بارد، متأخراً، ووحده' },
    blurb: {
      en: 'Dark cherry, cola nut and a whisper of vanilla. The heaviest pour in the range — built for the back half of a long day.',
      ar: 'كرز داكن وجوز كولا ولمسة فانيليا. الأثقل في التشكيلة — مصمم للنصف الأخير من يوم طويل.',
    },
    notes: {
      en: ['Black cherry', 'Cola nut', 'Bourbon vanilla', 'Cocoa husk'],
      ar: ['كرز أسود', 'جوز الكولا', 'فانيليا بوربون', 'قشر الكاكاو'],
    },
  },
  {
    id: 'aurora',
    index: '04',
    design: 'band', // horizontal bands, wordmark set in the top band
    name: { en: 'Aurora', ar: 'أورورا' },
    flavour: { en: 'Alpine Berry · Hibiscus', ar: 'توت جبلي · كركديه' },
    accent: '#8C6BFF',
    accentDeep: '#2E1B72',
    ink: '#0B0620',
    caffeine: 160,
    sugar: 0,
    calories: 10,
    rating: 4.6,
    reviews: 1408,
    packs: { 4: 55, 12: 145, 24: 265 },
    badges: [{ en: 'Zero sugar', ar: 'بلا سكر' }],
    serve: { en: 'Very cold, in a tall glass', ar: 'بارد جداً، في كوب طويل' },
    blurb: {
      en: 'Wild bilberry and blackcurrant lifted with hibiscus. Floral without being sweet, and the only one that stains the glass.',
      ar: 'توت بري وكشمش أسود مع كركديه. زهري دون حلاوة، وهو الوحيد الذي يترك أثراً في الكوب.',
    },
    notes: {
      en: ['Bilberry', 'Blackcurrant', 'Hibiscus', 'Elderflower'],
      ar: ['التوت الأزرق', 'كشمش أسود', 'كركديه', 'زهرة البيلسان'],
    },
  },
  {
    id: 'verde',
    index: '05',
    design: 'outline', // dark can, outlined display type, colour used sparingly
    name: { en: 'Verde', ar: 'فيردي' },
    flavour: { en: 'Kiwi · Lime Leaf', ar: 'كيوي · ورق الليمون' },
    accent: '#63D94F',
    accentDeep: '#154D0F',
    ink: '#04140A',
    caffeine: 150,
    sugar: 0,
    calories: 10,
    rating: 4.5,
    reviews: 987,
    packs: { 4: 58, 12: 152, 24: 275 },
    badges: [
      { en: 'Zero sugar', ar: 'بلا سكر' },
      { en: 'New', ar: 'جديد' },
    ],
    serve: { en: 'Cold, with something salty', ar: 'بارد، مع شيء مالح' },
    blurb: {
      en: 'Green kiwi with kaffir lime leaf and a green-mango edge. Sharp, herbal and faintly savoury — an acquired favourite.',
      ar: 'كيوي أخضر مع ورق الليمون الكافيري وحافة مانجو خضراء. حاد وعشبي ومالح قليلاً — نكهة تُكتسب ثم تُدمن.',
    },
    notes: {
      en: ['Kiwi', 'Kaffir lime leaf', 'Green mango', 'Basil'],
      ar: ['كيوي', 'ورق ليمون كافيري', 'مانجو خضراء', 'ريحان'],
    },
  },
  {
    id: 'monsoon',
    index: '06',
    design: 'duo', // two-tone vertical division
    name: { en: 'Monsoon', ar: 'مونسون' },
    flavour: { en: 'Guava · Coconut Water', ar: 'جوافة · ماء جوز الهند' },
    accent: '#14C6A4',
    accentDeep: '#0A4A3E',
    ink: '#03150F',
    caffeine: 160,
    sugar: 3,
    calories: 30,
    rating: 4.7,
    reviews: 1655,
    packs: { 4: 58, 12: 152, 24: 275 },
    badges: [{ en: 'With electrolytes', ar: 'مع الأملاح' }],
    serve: { en: 'After heat, after effort', ar: 'بعد الحرّ، بعد المجهود' },
    blurb: {
      en: 'Pink guava and young coconut water with added magnesium and potassium. The one to reach for after a long afternoon outdoors.',
      ar: 'جوافة وردية وماء جوز هند صغير مع مغنيسيوم وبوتاسيوم. الخيار الأمثل بعد ظهيرة طويلة في الخارج.',
    },
    notes: {
      en: ['Pink guava', 'Coconut water', 'Lime', 'Pink salt'],
      ar: ['جوافة وردية', 'ماء جوز الهند', 'ليمون', 'ملح وردي'],
    },
  },
];

/** Pack tiers. Prices come from each product, so flavours can differ. */
export const PACKS = [
  { id: '4', cans: 4 },
  { id: '12', cans: 12, tag: 'pdp.mostPopular' },
  { id: '24', cans: 24, tag: 'pdp.bestValue' },
];

export const priceFor = (product, packId) => product.packs[packId];

export const SUBSCRIPTION_DISCOUNT = 0.15;
export const MIX_TARGET = 12;
/** The mixed twelve is priced off the flavours in it, at the 12-pack rate. */
export const mixedPackPrice = (counts) =>
  Math.round(
    PRODUCTS.reduce((sum, p) => sum + (counts[p.id] || 0) * (p.packs[12] / 12), 0)
  );

/* ------------------------------------------------------------------ *
 * formula, nutrition, specification
 * ------------------------------------------------------------------ */

export const FORMULA = [
  {
    label: { en: 'Caffeine', ar: 'الكافيين' },
    amount: { en: '150–200 mg', ar: '١٥٠–٢٠٠ ملغ' },
    source: { en: 'Green coffee bean', ar: 'حبوب البن الخضراء' },
    value: 200,
    max: 200,
    note: {
      en: 'Extracted from unroasted arabica rather than synthesised. Releases over roughly forty minutes instead of all at once.',
      ar: 'مستخلص من أرابيكا غير محمّصة لا مركّب صناعياً. يتحرر خلال أربعين دقيقة تقريباً بدل دفعة واحدة.',
    },
  },
  {
    label: { en: 'L-theanine', ar: 'إل-ثيانين' },
    amount: { en: '200 mg', ar: '٢٠٠ ملغ' },
    source: { en: 'Camellia sinensis', ar: 'نبات الشاي' },
    value: 200,
    max: 200,
    note: {
      en: 'Paired one-to-one against caffeine. Takes the edge off the peak and is the reason there is no shake at the top.',
      ar: 'موازَن واحداً لواحد مقابل الكافيين. يخفف حدة الذروة، ولهذا لا توجد رجفة في الأعلى.',
    },
  },
  {
    label: { en: 'Electrolytes', ar: 'الأملاح المعدنية' },
    amount: { en: '380 mg', ar: '٣٨٠ ملغ' },
    source: { en: 'Sea mineral complex', ar: 'مركّب معادن بحرية' },
    value: 380,
    max: 400,
    note: {
      en: 'Sodium, potassium and magnesium in the ratio you actually lose them. Replaces what a hard hour in the heat costs you.',
      ar: 'صوديوم وبوتاسيوم ومغنيسيوم بالنسبة التي تفقدها فعلاً. يعوّض ما تكلفك ساعة شاقة في الحر.',
    },
  },
  {
    label: { en: 'B-complex', ar: 'مجموعة فيتامين ب' },
    amount: { en: 'B3 · B6 · B12', ar: 'ب٣ · ب٦ · ب١٢' },
    source: { en: 'Methylated forms', ar: 'صور مُمثيَلة' },
    value: 160,
    max: 200,
    note: {
      en: 'Methylcobalamin over cyanocobalamin, because a third of people convert the cheap one poorly.',
      ar: 'ميثيل كوبالامين بدل السيانوكوبالامين، لأن ثلث الناس لا يحوّلون الرخيص بكفاءة.',
    },
  },
];

/** Per 355 mL can. Values shown for the mid-range flavour. */
export const NUTRITION = [
  { k: { en: 'Energy', ar: 'الطاقة' }, v: { en: '15 kcal', ar: '١٥ سعرة' }, dv: '1%' },
  { k: { en: 'Total fat', ar: 'إجمالي الدهون' }, v: { en: '0 g', ar: '٠ غ' }, dv: '0%' },
  { k: { en: 'Sodium', ar: 'الصوديوم' }, v: { en: '180 mg', ar: '١٨٠ ملغ' }, dv: '8%' },
  { k: { en: 'Potassium', ar: 'البوتاسيوم' }, v: { en: '160 mg', ar: '١٦٠ ملغ' }, dv: '3%' },
  { k: { en: 'Magnesium', ar: 'المغنيسيوم' }, v: { en: '40 mg', ar: '٤٠ ملغ' }, dv: '10%' },
  { k: { en: 'Total carbohydrate', ar: 'إجمالي الكربوهيدرات' }, v: { en: '4 g', ar: '٤ غ' }, dv: '1%' },
  { k: { en: 'Total sugars', ar: 'إجمالي السكريات' }, v: { en: '0 g', ar: '٠ غ' }, dv: '—' },
  { k: { en: 'Protein', ar: 'البروتين' }, v: { en: '0 g', ar: '٠ غ' }, dv: '0%' },
  { k: { en: 'Niacin (B3)', ar: 'نياسين (ب٣)' }, v: { en: '16 mg', ar: '١٦ ملغ' }, dv: '100%' },
  { k: { en: 'Vitamin B6', ar: 'فيتامين ب٦' }, v: { en: '1.7 mg', ar: '١٫٧ ملغ' }, dv: '100%' },
  { k: { en: 'Vitamin B12', ar: 'فيتامين ب١٢' }, v: { en: '2.4 µg', ar: '٢٫٤ ميكروغرام' }, dv: '100%' },
  { k: { en: 'Caffeine', ar: 'الكافيين' }, v: { en: '180 mg', ar: '١٨٠ ملغ' }, dv: '—' },
];

export const SPECS = [
  { k: { en: 'Volume', ar: 'الحجم' }, v: { en: '355 mL / 12 fl oz', ar: '٣٥٥ مل' } },
  { k: { en: 'Carbonation', ar: 'الكربنة' }, v: { en: '3.4 volumes CO₂', ar: '٣٫٤ حجم ثاني أكسيد الكربون' } },
  { k: { en: 'Sweetener', ar: 'المحلّي' }, v: { en: 'Allulose + steviol glycosides', ar: 'ألولوز + جليكوسيدات ستيفيول' } },
  { k: { en: 'Colour', ar: 'اللون' }, v: { en: 'From fruit and vegetable concentrate', ar: 'من مركّز الفواكه والخضروات' } },
  { k: { en: 'Can', ar: 'العلبة' }, v: { en: '73% recycled aluminium', ar: '٧٣٪ ألمنيوم معاد تدويره' } },
  { k: { en: 'Certification', ar: 'الاعتماد' }, v: { en: 'SFDA registered · Halal', ar: 'مسجّل لدى الغذاء والدواء · حلال' } },
];

/* ------------------------------------------------------------------ *
 * shipping across the Kingdom
 * ------------------------------------------------------------------ */

export const SHIPPING = {
  fee: 25,
  freeAt: 200,
  zones: [
    { city: { en: 'Riyadh', ar: 'الرياض' }, min: 1, max: 1 },
    { city: { en: 'Jeddah · Makkah · Madinah', ar: 'جدة · مكة · المدينة' }, min: 2, max: 3 },
    { city: { en: 'Dammam · Khobar · Dhahran', ar: 'الدمام · الخبر · الظهران' }, min: 2, max: 3 },
    { city: { en: 'Abha · Tabuk · Hail · other regions', ar: 'أبها · تبوك · حائل · بقية المناطق' }, min: 3, max: 5 },
  ],
};

/* ------------------------------------------------------------------ *
 * reviews
 * ------------------------------------------------------------------ */

export const REVIEWS = [
  {
    name: { en: 'Dr. Nouf Al-Harbi', ar: 'د. نوف الحربي' },
    role: { en: 'Emergency physician · Riyadh', ar: 'طبيبة طوارئ · الرياض' },
    product: 'vesper',
    rating: 5,
    date: { en: '12 Aug', ar: '١٢ أغسطس' },
    helpful: 214,
    body: {
      en: 'I work fourteen-hour nights and I have tried everything on the shelf. This is the first one that does not leave me jittery at hour ten or flattened at hour twelve. The taper is the whole point.',
      ar: 'أعمل مناوبات ليلية من أربع عشرة ساعة وجرّبت كل ما في السوق. هذا أول مشروب لا يتركني مرتجفة في الساعة العاشرة ولا منهارة في الثانية عشرة. الانحدار التدريجي هو كل الفكرة.',
    },
  },
  {
    name: { en: 'Faisal Al-Otaibi', ar: 'فيصل العتيبي' },
    role: { en: 'Road cyclist · Jeddah', ar: 'دراج طرق · جدة' },
    product: 'monsoon',
    rating: 5,
    date: { en: '3 Aug', ar: '٣ أغسطس' },
    helpful: 176,
    body: {
      en: 'The electrolyte load is real, not decorative. I run one on the second climb of a long ride in this heat and I am not cramping at the top any more. It also does not taste like sunscreen, which is a low bar the category keeps failing.',
      ar: 'كمية الأملاح حقيقية لا شكلية. أشربه في الصعود الثاني من جولة طويلة في هذا الحر ولم أعد أصاب بالتشنج في القمة. كما أنه لا يشبه طعم واقي الشمس، وهو معيار بسيط تفشل فيه الفئة باستمرار.',
    },
  },
  {
    name: { en: 'Layla Bakhsh', ar: 'ليلى بخش' },
    role: { en: 'Product designer · Khobar', ar: 'مصممة منتجات · الخبر' },
    product: 'glacier',
    rating: 4,
    date: { en: '28 Jul', ar: '٢٨ يوليو' },
    helpful: 98,
    body: {
      en: 'Extremely clean. Almost too clean — the first can felt like it was not doing anything, and then I noticed I had been heads-down for three hours. Wish the yuzu came through a touch harder.',
      ar: 'نظيف للغاية. نظيف أكثر من اللازم تقريباً — شعرت أن العلبة الأولى لا تفعل شيئاً، ثم انتبهت أنني عملت ثلاث ساعات دون توقف. أتمنى لو كان اليوزو أوضح قليلاً.',
    },
  },
  {
    name: { en: 'Abdulrahman Kanoo', ar: 'عبدالرحمن كانو' },
    role: { en: 'Bakery owner · Madinah', ar: 'صاحب مخبز · المدينة' },
    product: 'solstice',
    rating: 5,
    date: { en: '21 Jul', ar: '٢١ يوليو' },
    helpful: 143,
    body: {
      en: 'Four in the morning, six days a week, for eight months. The bergamot keeps it from getting boring, which matters more than anyone admits when you drink the same thing every day.',
      ar: 'الرابعة فجراً، ستة أيام في الأسبوع، منذ ثمانية أشهر. البرغموت يمنعه من أن يصبح مملاً، وهذا أهم مما يعترف به أحد حين تشرب الشيء نفسه كل يوم.',
    },
  },
  {
    name: { en: 'Sara Almutairi', ar: 'سارة المطيري' },
    role: { en: 'Air traffic controller · Dammam', ar: 'مراقبة حركة جوية · الدمام' },
    product: 'aurora',
    rating: 4,
    date: { en: '14 Jul', ar: '١٤ يوليو' },
    helpful: 87,
    body: {
      en: 'I am not allowed to be wrong at hour six, so I care about this more than most people. It holds. My only complaint is that the hibiscus is louder than the berry, which is the opposite of what the can implies.',
      ar: 'لا يُسمح لي بالخطأ في الساعة السادسة، لذا يهمني هذا أكثر من غيري. وهو يثبت فعلاً. ملاحظتي الوحيدة أن الكركديه أوضح من التوت، وهو عكس ما توحي به العلبة.',
    },
  },
  {
    name: { en: 'Yousef Al-Ghamdi', ar: 'يوسف الغامدي' },
    role: { en: 'Long-haul driver · Abha', ar: 'سائق مسافات طويلة · أبها' },
    product: 'verde',
    rating: 5,
    date: { en: '2 Jul', ar: '٢ يوليو' },
    helpful: 121,
    body: {
      en: 'Bought a case expecting to hate the savoury one and now it is the only thing in the cab. It is the only energy drink I have had that does not get sickly by the third can of the week.',
      ar: 'اشتريت كرتوناً وأنا أتوقع أن أكره النكهة المالحة، والآن هي الوحيدة في الشاحنة. هو مشروب الطاقة الوحيد الذي لا يصبح مقززاً عند العلبة الثالثة في الأسبوع.',
    },
  },
];

export const RATING_SUMMARY = { average: 4.8, count: 12175, breakdown: [76, 17, 5, 1, 1] };

/* ------------------------------------------------------------------ *
 * questions
 * ------------------------------------------------------------------ */

export const FAQ = [
  {
    q: { en: 'How much caffeine is in a can?', ar: 'كم نسبة الكافيين في العلبة؟' },
    a: {
      en: 'Between 150 mg and 200 mg depending on the flavour, printed on every can. For reference a double espresso is around 130 mg. Vesper is the strongest at 200 mg; Glacier and Verde sit at 150 mg.',
      ar: 'بين ١٥٠ و٢٠٠ ملغ حسب النكهة، ومطبوعة على كل علبة. للمقارنة، الإسبريسو المزدوج نحو ١٣٠ ملغ. «فيسبر» الأقوى عند ٢٠٠ ملغ، بينما «غلاسير» و«فيردي» عند ١٥٠ ملغ.',
    },
  },
  {
    q: { en: 'Why does it not give me the crash?', ar: 'لماذا لا يسبب هبوطاً مفاجئاً؟' },
    a: {
      en: 'Two reasons. The caffeine comes from green coffee bean extract, which enters the bloodstream more gradually than the synthetic caffeine anhydrous most of the category uses. And every can carries 200 mg of L-theanine, which blunts the peak. You get a longer, lower curve instead of a spike and a hole.',
      ar: 'لسببين. الكافيين مستخلص من حبوب البن الخضراء، ويدخل الدم بتدرّج أكبر من الكافيين الصناعي الذي تستخدمه معظم المنتجات. كما تحمل كل علبة ٢٠٠ ملغ من إل-ثيانين الذي يخفف الذروة. تحصل على منحنى أطول وأهدأ بدل قفزة تعقبها حفرة.',
    },
  },
  {
    q: { en: 'Is it actually zero sugar?', ar: 'هل هو فعلاً بلا سكر؟' },
    a: {
      en: 'Four of the six are: Solstice, Glacier, Aurora and Verde. Vesper carries 2 g and Monsoon 3 g, both from real fruit concentrate rather than added sugar. We sweeten with allulose and a small amount of steviol glycoside, so there is no cooling aftertaste.',
      ar: 'أربع من الست: سولستيس وغلاسير وأورورا وفيردي. «فيسبر» يحتوي ٢ غ و«مونسون» ٣ غ، وكلاهما من مركّز الفاكهة لا من سكر مضاف. نحلّي بالألولوز وقليل من جليكوسيد الستيفيول، فلا يوجد طعم بارد لاحق.',
    },
  },
  {
    q: { en: 'Is it halal and SFDA registered?', ar: 'هل هو حلال ومسجّل لدى الغذاء والدواء؟' },
    a: {
      en: 'Yes to both. Every batch is produced in a halal-certified facility with no alcohol-derived carriers in any flavouring, and the product is registered with the Saudi Food and Drug Authority. Certificates are available on request.',
      ar: 'نعم لكليهما. تُنتج كل دفعة في منشأة معتمدة حلال دون أي حوامل مشتقة من الكحول في النكهات، والمنتج مسجّل لدى الهيئة العامة للغذاء والدواء. الشهادات متاحة عند الطلب.',
    },
  },
  {
    q: { en: 'When will it arrive?', ar: 'متى يصل الطلب؟' },
    a: {
      en: 'Orders placed before 2pm ship the same working day. Next day in Riyadh, two to three days for Jeddah, Makkah, Madinah, Dammam and Khobar, and three to five for other regions. Free over SAR 200, and every order is tracked from the moment it leaves the Riyadh warehouse.',
      ar: 'الطلبات قبل الثانية ظهراً تُشحن في نفس يوم العمل. اليوم التالي في الرياض، ويومان إلى ثلاثة لجدة ومكة والمدينة والدمام والخبر، وثلاثة إلى خمسة لبقية المناطق. مجاناً فوق ٢٠٠ ريال، ويمكن تتبع كل طلب من لحظة مغادرته مستودع الرياض.',
    },
  },
  {
    q: { en: 'How do I pay?', ar: 'كيف أدفع؟' },
    a: {
      en: 'Apple Pay, mada, and Visa or Mastercard. All card payments run through 3-D Secure and no card details are stored on our side. Cash on delivery is not offered.',
      ar: 'Apple Pay ومدى وفيزا أو ماستركارد. تمر جميع مدفوعات البطاقات عبر 3-D Secure ولا تُحفظ بيانات البطاقة لدينا. الدفع عند الاستلام غير متاح.',
    },
  },
  {
    q: { en: 'How does the subscription work?', ar: 'كيف يعمل الاشتراك؟' },
    a: {
      en: 'Pick your cans and a cadence — every two, four or six weeks. You save 15% on every order, delivery is always free, and you can skip, swap flavours, change the date or cancel from your account with no phone call and no retention script.',
      ar: 'اختر علبك ووتيرة التوصيل — كل أسبوعين أو أربعة أو ستة. توفّر ١٥٪ في كل طلب، والتوصيل مجاني دائماً، ويمكنك التخطي أو تبديل النكهات أو تغيير الموعد أو الإلغاء من حسابك دون مكالمة ودون محاولات إقناع.',
    },
  },
  {
    q: { en: 'What if I do not like it?', ar: 'ماذا لو لم يعجبني؟' },
    a: {
      en: 'Drink the whole pack and tell us it was not for you within thirty days. We refund it in full and you keep the cans — sending part-used drinks back helps nobody.',
      ar: 'اشرب العلبة كاملة وأخبرنا خلال ثلاثين يوماً أنها لم تناسبك. نعيد المبلغ كاملاً وتحتفظ بالعلب — إعادة مشروبات مفتوحة لا تفيد أحداً.',
    },
  },
];
