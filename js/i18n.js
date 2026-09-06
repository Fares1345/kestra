/**
 * Bilingual store: English and Arabic, with real RTL.
 *
 * Every user-facing string lives here rather than in markup, so switching
 * language flips the whole page — direction, numerals, currency formatting and
 * the printed can artwork included. The choice persists per visitor.
 *
 * Arabic is not a translation of the English marketing copy word for word; it
 * is written to read naturally in Arabic, because copy that has obviously been
 * run through a translator is exactly what makes a store feel fake.
 */

const STORE_KEY = 'kestra.lang';

export const LANGS = {
  en: { code: 'en', dir: 'ltr', label: 'EN', name: 'English', locale: 'en-SA' },
  ar: { code: 'ar', dir: 'rtl', label: 'ع', name: 'العربية', locale: 'ar-SA' },
};

/* ------------------------------------------------------------------ *
 * copy
 * ------------------------------------------------------------------ */

export const STRINGS = {
  en: {
    'brand.claim': 'Sparkling energy, engineered',
    'brand.origin':
      'Named for the kestrel, which hangs dead still in a forty-mile wind by correcting continuously. Not more energy — better held.',

    'nav.skip': 'Skip to the shop',
    'nav.shop': 'Shop',
    'nav.pack': 'Build a pack',
    'nav.formula': 'Formula',
    'nav.reviews': 'Reviews',
    'nav.faq': 'FAQ',
    'nav.menu': 'Menu',
    'nav.cartOpen': 'Open cart',
    'nav.home': 'Kestra, home',
    'nav.lang': 'العربية',
    'nav.langAria': 'Switch to Arabic',

    'loader.text': 'Chilling the can',
    'intro.skip': 'Skip intro',

    'hero.title': 'Energy that<br>holds its line.',
    'hero.lede':
      'Caffeine from unroasted arabica, buffered one-to-one with L-theanine. It comes up over forty minutes, sits flat for four hours, and leaves without taking the evening with it.',
    'hero.buy': 'Buy now',
    'hero.explore': 'Explore flavours',
    'hero.rail': 'Turn the can',
    'hero.scroll': 'Scroll',
    'stat.caffeine': 'Caffeine',
    'stat.sugar': 'Sugar',
    'stat.volume': 'Volume',
    'stat.rated': 'Rated',
    'unit.mg': 'mg',
    'unit.g': 'g',
    'unit.ml': 'mL',
    'unit.kcal': 'kcal',
    'unit.outOf5': '/5',

    'ticker.0': 'Zero sugar',
    'ticker.1': '200 mg L-theanine',
    'ticker.2': 'No crash',
    'ticker.3': 'Free delivery over SAR 200',
    'ticker.4': 'Riyadh next day',
    'ticker.5': '73% recycled aluminium',

    'shop.eyebrow': 'The range',
    'shop.title': 'Six cans. One curve.',
    'shop.lede':
      'Every flavour runs the same formula underneath — what changes is the fruit, the acid and how hard the caffeine is pushed. Start with Solstice if you have no idea.',
    'shop.filterAll': 'Everything',
    'shop.filterZero': 'Zero sugar',
    'shop.filterStrong': '180 mg+',
    'shop.filterNew': 'New',
    'shop.filterAria': 'Filter the range',
    'shop.of': 'of',
    'shop.quickLook': 'Quick look',
    'shop.add': 'Quick add',
    'shop.perPack': '/ 12 cans',
    'shop.caffeineLabel': 'mg caffeine',
    'shop.sugarLabel': 'g sugar',

    'pack.eyebrow': 'Build a pack',
    'pack.title': 'Twelve cans,<br>your split.',
    'pack.lede':
      'Nobody drinks one flavour forever. Set the ratio you actually want and we pack it that way — same price as any other twelve.',
    'pack.selected': 'selected',
    'pack.add': 'Add mixed pack',
    'pack.more': 'Pick {n} more',
    'pack.full': 'Pack is full',
    'pack.clear': 'Clear',
    'pack.fill': 'Fill the rest',
    'pack.aria': 'Cans selected',
    'pack.boxAria': 'Live preview of your twelve-pack',

    'formula.eyebrow': 'The formula',
    'formula.title': 'Four things,<br>done properly.',
    'formula.lede':
      'There is no proprietary blend and no ingredient here to make the label look busy. Everything is dosed at the level the research actually used.',
    'formula.specTitle': 'Specification',
    'nutrition.title': 'Nutrition facts',
    'nutrition.per': 'Per 355 mL can',
    'nutrition.amount': 'Amount',
    'nutrition.dv': '% DV*',
    'nutrition.footnote':
      '* Percentage of daily value based on a 2,000 kcal diet. Values verified by SFDA-registered laboratory analysis.',

    'reviews.eyebrow': 'Reviews',
    'reviews.title': 'Written by people<br>who bought it.',
    'reviews.lede':
      'Collected after delivery, unedited, and published including the three-star ones.',
    'reviews.verified': 'Verified purchase',
    'reviews.drinks': 'Drinks',
    'reviews.helpful': 'Helpful',
    'reviews.of5': 'out of 5',

    'faq.eyebrow': 'Questions',
    'faq.title': 'Before you order.',

    'signup.title': 'Get the next drop first.',
    'signup.lede': 'One email a month. New flavours, restocks, and nothing else.',
    'signup.placeholder': 'you@example.com',
    'signup.cta': 'Join',
    'signup.done': 'You are on the list. Welcome.',
    'signup.email': 'Email address',

    'cart.title': 'Your cart',
    'cart.close': 'Close cart',
    'cart.empty': 'Your cart is empty.',
    'cart.browse': 'Browse the range',
    'cart.freeAway': '{amount} away from free delivery',
    'cart.freeDone': 'Free delivery unlocked',
    'cart.promo': 'Promo code',
    'cart.apply': 'Apply',
    'cart.subtotal': 'Subtotal',
    'cart.discount': 'Discount',
    'cart.vat': 'VAT (15%)',
    'cart.shipping': 'Delivery',
    'cart.free': 'Free',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.vatNote': 'All prices include 15% VAT.',
    'cart.eta': 'Estimated delivery',
    'cart.cans': 'cans',
    'cart.remove': 'Remove',
    'cart.decrease': 'Decrease quantity',
    'cart.increase': 'Increase quantity',
    'cart.mixed': 'Mixed pack',
    'cart.subscription': 'Subscription',
    'cart.added': '{name} added',
    'cart.removed': 'Removed from cart',
    'cart.promoOk': '{code} applied — {pct}% off',
    'cart.promoBad': 'That code is not recognised',
    'cart.live': '{n} cans in cart',
    'cart.liveEmpty': 'Cart is empty',

    'pay.title': 'Payment',
    'pay.applePay': 'Apple Pay',
    'pay.mada': 'mada',
    'pay.card': 'Card',
    'pay.secure': 'Secured by 3-D Secure. Card details are never stored.',
    'pay.placed': 'Order placed — {amount}. Confirmation sent to your email.',
    'pay.demo': 'Demonstration checkout — no payment is taken.',

    'pdp.notes': 'Tasting notes',
    'pdp.pack': 'Pack size',
    'pdp.subscribe': 'Subscribe & save 15%',
    'pdp.subscribeNote': 'Delivered every 4 weeks. Skip or cancel anytime.',
    'pdp.addToCart': 'Add to cart',
    'pdp.perCan': '{amount} per can',
    'pdp.close': 'Close',
    'pdp.serve': 'Best served',
    'pdp.calories': 'Calories',
    'pdp.rating': 'Rating',
    'pdp.mostPopular': 'Most popular',
    'pdp.bestValue': 'Best value',
    'pdp.cans': 'cans',
    'pdp.inStock': 'In stock — ships today',

    'footer.shop': 'Shop',
    'footer.company': 'Company',
    'footer.support': 'Support',
    'footer.all': 'All flavours',
    'footer.subscribe': 'Subscribe',
    'footer.hours': 'Sun–Thu, 9am–6pm AST',
    'footer.rights': 'All rights reserved.',
    'footer.legal':
      'Not recommended for children, pregnant women, or people sensitive to caffeine. This is a demonstration storefront — no order is placed and no payment is taken.',
    'footer.vat': 'VAT No. 3•• ••• ••• ••••3',
    'footer.address': 'Kestra Beverage Co.<br>King Fahd Road, Al Olaya, Riyadh 12214<br>Kingdom of Saudi Arabia',
    'footer.delivery': 'Delivery across the Kingdom',
  },

  ar: {
    'brand.claim': 'طاقة فوّارة، بهندسة دقيقة',
    'brand.origin':
      'الاسم مأخوذ من العُوسق، الطائر الذي يثبت في الهواء وسط ريح عاتية عبر تصحيح مستمر. ليست طاقة أكثر، بل طاقة محكومة.',

    'nav.skip': 'تخطي إلى المتجر',
    'nav.shop': 'المتجر',
    'nav.pack': 'اصنع علبتك',
    'nav.formula': 'التركيبة',
    'nav.reviews': 'التقييمات',
    'nav.faq': 'الأسئلة',
    'nav.menu': 'القائمة',
    'nav.cartOpen': 'فتح السلة',
    'nav.home': 'كسترا، الرئيسية',
    'nav.lang': 'English',
    'nav.langAria': 'التبديل إلى الإنجليزية',

    'loader.text': 'نبرّد العلبة',
    'intro.skip': 'تخطي المقدمة',

    'hero.title': 'طاقة تثبت<br>على خطها.',
    'hero.lede':
      'كافيين من حبوب أرابيكا غير محمّصة، موازَن بمقدار مماثل من إل-ثيانين. يرتفع خلال أربعين دقيقة، ويستقر أربع ساعات، ثم ينسحب دون أن يأخذ مساءك معه.',
    'hero.buy': 'اشترِ الآن',
    'hero.explore': 'استكشف النكهات',
    'hero.rail': 'أدر العلبة',
    'hero.scroll': 'مرّر',
    'stat.caffeine': 'الكافيين',
    'stat.sugar': 'السكر',
    'stat.volume': 'الحجم',
    'stat.rated': 'التقييم',
    'unit.mg': 'ملغ',
    'unit.g': 'غ',
    'unit.ml': 'مل',
    'unit.kcal': 'سعرة',
    'unit.outOf5': '/٥',

    'ticker.0': 'خالٍ من السكر',
    'ticker.1': '٢٠٠ ملغ إل-ثيانين',
    'ticker.2': 'بلا هبوط مفاجئ',
    'ticker.3': 'توصيل مجاني فوق ٢٠٠ ريال',
    'ticker.4': 'الرياض خلال يوم',
    'ticker.5': '٧٣٪ ألمنيوم معاد تدويره',

    'shop.eyebrow': 'التشكيلة',
    'shop.title': 'ست علب. منحنى واحد.',
    'shop.lede':
      'كل نكهة تقوم على التركيبة نفسها؛ ما يتغيّر هو الفاكهة والحموضة ومقدار دفع الكافيين. ابدأ بـ«سولستيس» إن لم تكن متأكداً.',
    'shop.filterAll': 'الكل',
    'shop.filterZero': 'بلا سكر',
    'shop.filterStrong': '١٨٠ ملغ فأكثر',
    'shop.filterNew': 'جديد',
    'shop.filterAria': 'تصفية التشكيلة',
    'shop.of': 'من',
    'shop.quickLook': 'نظرة سريعة',
    'shop.add': 'إضافة سريعة',
    'shop.perPack': '/ ١٢ علبة',
    'shop.caffeineLabel': 'ملغ كافيين',
    'shop.sugarLabel': 'غ سكر',

    'pack.eyebrow': 'اصنع علبتك',
    'pack.title': 'اثنتا عشرة علبة،<br>بتوزيعك أنت.',
    'pack.lede':
      'لا أحد يشرب نكهة واحدة إلى الأبد. حدّد النسبة التي تريدها فعلاً ونحن نعبّئها كذلك — بالسعر نفسه.',
    'pack.selected': 'مختارة',
    'pack.add': 'أضف العلبة المخصصة',
    'pack.more': 'اختر {n} أخرى',
    'pack.full': 'اكتملت العلبة',
    'pack.clear': 'مسح',
    'pack.fill': 'أكمل الباقي',
    'pack.aria': 'العلب المختارة',
    'pack.boxAria': 'معاينة حيّة لعلبتك',

    'formula.eyebrow': 'التركيبة',
    'formula.title': 'أربعة عناصر،<br>بإتقان.',
    'formula.lede':
      'لا توجد خلطة سرية ولا مكوّن هنا لتزيين الملصق. كل عنصر بالجرعة التي استخدمتها الدراسات فعلاً.',
    'formula.specTitle': 'المواصفات',
    'nutrition.title': 'القيمة الغذائية',
    'nutrition.per': 'لكل علبة ٣٥٥ مل',
    'nutrition.amount': 'الكمية',
    'nutrition.dv': '٪ ق.ي*',
    'nutrition.footnote':
      '* النسبة المئوية للقيمة اليومية بناءً على نظام غذائي ٢٠٠٠ سعرة. القيم موثّقة بتحليل مختبري معتمد لدى الهيئة العامة للغذاء والدواء.',

    'reviews.eyebrow': 'التقييمات',
    'reviews.title': 'كتبها من<br>اشتروها فعلاً.',
    'reviews.lede': 'تُجمع بعد التوصيل، وتُنشر دون تحرير، بما فيها تقييمات الثلاث نجوم.',
    'reviews.verified': 'شراء موثّق',
    'reviews.drinks': 'يشرب',
    'reviews.helpful': 'مفيد',
    'reviews.of5': 'من ٥',

    'faq.eyebrow': 'أسئلة',
    'faq.title': 'قبل أن تطلب.',

    'signup.title': 'كن أول من يعرف.',
    'signup.lede': 'رسالة واحدة شهرياً. نكهات جديدة وإعادة توفير، لا أكثر.',
    'signup.placeholder': 'you@example.com',
    'signup.cta': 'انضم',
    'signup.done': 'أصبحت في القائمة. أهلاً بك.',
    'signup.email': 'البريد الإلكتروني',

    'cart.title': 'سلّتك',
    'cart.close': 'إغلاق السلة',
    'cart.empty': 'سلتك فارغة.',
    'cart.browse': 'تصفّح التشكيلة',
    'cart.freeAway': 'يفصلك {amount} عن التوصيل المجاني',
    'cart.freeDone': 'حصلت على التوصيل المجاني',
    'cart.promo': 'رمز الخصم',
    'cart.apply': 'تطبيق',
    'cart.subtotal': 'المجموع الفرعي',
    'cart.discount': 'الخصم',
    'cart.vat': 'ضريبة القيمة المضافة (١٥٪)',
    'cart.shipping': 'التوصيل',
    'cart.free': 'مجاني',
    'cart.total': 'الإجمالي',
    'cart.checkout': 'إتمام الطلب',
    'cart.vatNote': 'جميع الأسعار شاملة ضريبة القيمة المضافة ١٥٪.',
    'cart.eta': 'موعد التوصيل المتوقع',
    'cart.cans': 'علبة',
    'cart.remove': 'إزالة',
    'cart.decrease': 'إنقاص الكمية',
    'cart.increase': 'زيادة الكمية',
    'cart.mixed': 'علبة مخصصة',
    'cart.subscription': 'اشتراك',
    'cart.added': 'تمت إضافة {name}',
    'cart.removed': 'أُزيلت من السلة',
    'cart.promoOk': 'طُبّق {code} — خصم {pct}٪',
    'cart.promoBad': 'هذا الرمز غير معروف',
    'cart.live': '{n} علبة في السلة',
    'cart.liveEmpty': 'السلة فارغة',

    'pay.title': 'الدفع',
    'pay.applePay': 'Apple Pay',
    'pay.mada': 'مدى',
    'pay.card': 'بطاقة',
    'pay.secure': 'محمي بخدمة 3-D Secure. لا تُحفظ بيانات البطاقة.',
    'pay.placed': 'تم الطلب — {amount}. أُرسل التأكيد إلى بريدك.',
    'pay.demo': 'واجهة دفع تجريبية — لا يتم تحصيل أي مبلغ.',

    'pdp.notes': 'ملاحظات التذوّق',
    'pdp.pack': 'حجم العبوة',
    'pdp.subscribe': 'اشترك ووفّر ١٥٪',
    'pdp.subscribeNote': 'يصلك كل ٤ أسابيع. يمكنك التخطي أو الإلغاء متى شئت.',
    'pdp.addToCart': 'أضف إلى السلة',
    'pdp.perCan': '{amount} للعلبة',
    'pdp.close': 'إغلاق',
    'pdp.serve': 'يُقدَّم بأفضل حال',
    'pdp.calories': 'السعرات',
    'pdp.rating': 'التقييم',
    'pdp.mostPopular': 'الأكثر طلباً',
    'pdp.bestValue': 'أفضل قيمة',
    'pdp.cans': 'علبة',
    'pdp.inStock': 'متوفر — يُشحن اليوم',

    'footer.shop': 'المتجر',
    'footer.company': 'الشركة',
    'footer.support': 'الدعم',
    'footer.all': 'كل النكهات',
    'footer.subscribe': 'الاشتراك',
    'footer.hours': 'الأحد–الخميس، ٩ص–٦م بتوقيت السعودية',
    'footer.rights': 'جميع الحقوق محفوظة.',
    'footer.legal':
      'غير موصى به للأطفال أو الحوامل أو من لديهم حساسية من الكافيين. هذا متجر تجريبي — لا يتم تنفيذ طلبات ولا تحصيل مدفوعات.',
    'footer.vat': 'الرقم الضريبي ٣•• ••• ••• ••••٣',
    'footer.address': 'شركة كسترا للمشروبات<br>طريق الملك فهد، العليا، الرياض ١٢٢١٤<br>المملكة العربية السعودية',
    'footer.delivery': 'توصيل لجميع مناطق المملكة',
  },
};

/* ------------------------------------------------------------------ *
 * state
 * ------------------------------------------------------------------ */

function initialLang() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && LANGS[saved]) return saved;
  } catch {
    /* private mode */
  }
  return (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

let current = initialLang();
const listeners = new Set();

export const lang = () => current;
export const isRTL = () => LANGS[current].dir === 'rtl';

/** Look up a string, filling {placeholders}. Falls back to English, then the key. */
export function t(key, vars) {
  let out = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** Pick the field for the active language from a { en, ar } pair. */
export function pick(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value[current] ?? value.en;
  return value;
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLanguage(next) {
  if (!LANGS[next] || next === current) return;
  current = next;
  try {
    localStorage.setItem(STORE_KEY, next);
  } catch {
    /* ignore */
  }
  applyDocumentLanguage();
  listeners.forEach((fn) => fn(next));
}

export function toggleLanguage() {
  setLanguage(current === 'en' ? 'ar' : 'en');
}

export function applyDocumentLanguage() {
  const root = document.documentElement;
  root.lang = current;
  root.dir = LANGS[current].dir;
  root.dataset.lang = current;
}

/* ------------------------------------------------------------------ *
 * money and numbers — Saudi riyal, VAT-inclusive
 * ------------------------------------------------------------------ */

export const VAT_RATE = 0.15;

const formatters = new Map();
function formatter(locale) {
  if (!formatters.has(locale)) {
    formatters.set(
      locale,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    );
  }
  return formatters.get(locale);
}

/** Riyal amounts, in the numerals of the active language. */
export function money(amount) {
  return formatter(LANGS[current].locale).format(amount);
}

export function num(value) {
  return new Intl.NumberFormat(LANGS[current].locale).format(value);
}

/** A weekday range for the delivery estimate, in the active locale. */
export function deliveryWindow(minDays, maxDays) {
  const fmt = new Intl.DateTimeFormat(LANGS[current].locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const from = new Date();
  from.setDate(from.getDate() + minDays);
  const to = new Date();
  to.setDate(to.getDate() + maxDays);
  return minDays === maxDays ? fmt.format(from) : `${fmt.format(from)} – ${fmt.format(to)}`;
}
