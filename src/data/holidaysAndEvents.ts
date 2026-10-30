/**
 * Public Holidays & Daily Real-World Events Service
 * Supports international and regional holidays, movable dates, and daily historical events.
 * Fully offline-capable with optional live "On This Day" Wikipedia enrichment and localStorage caching.
 */

export type IndianSubRegion = 'in-mh' | 'in-pb' | 'in-gj' | 'in-wb' | 'in-tn' | 'in-te' | 'in-ka' | 'in-kl';
export type RegionCode = 'all' | 'international' | 'us' | 'uk' | 'in' | 'ca' | IndianSubRegion;

const INDIAN_SUB_REGIONS: RegionCode[] = ['in-mh', 'in-pb', 'in-gj', 'in-wb', 'in-tn', 'in-te', 'in-ka', 'in-kl'];

/** True if a holiday should show for the selected region (sub-regions also get pan-India days). */
function matchesRegion(h: { regions: RegionCode[] }, region: RegionCode): boolean {
  if (region === 'all') return true;
  if (h.regions.includes(region) || h.regions.includes('international')) return true;
  return INDIAN_SUB_REGIONS.includes(region) && h.regions.includes('in');
}

export interface CalendarHoliday {
  id: string;
  name: string;
  dateStr: string; // YYYY-MM-DD
  isPublicHoliday: boolean;
  regions: RegionCode[];
  icon?: string;
  description?: string;
}

export interface RealWorldEvent {
  year?: number;
  title: string;
  description?: string;
  category: 'history' | 'science' | 'space' | 'culture' | 'tech';
}

export const REGION_OPTIONS: { code: RegionCode; label: string; flag: string }[] = [
  { code: 'all', label: 'All Regions', flag: '🌍' },
  { code: 'international', label: 'International', flag: '🌐' },
  { code: 'us', label: 'United States', flag: '🇺🇸' },
  { code: 'uk', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'in', label: 'India (All)', flag: '🇮🇳' },
  { code: 'in-mh', label: 'Marathi (Maharashtra)', flag: '🚩' },
  { code: 'in-pb', label: 'Punjabi (Punjab)', flag: '🪯' },
  { code: 'in-gj', label: 'Gujarati (Gujarat)', flag: '🦁' },
  { code: 'in-wb', label: 'Bengali (West Bengal)', flag: '🐯' },
  { code: 'in-tn', label: 'Tamil (Tamil Nadu)', flag: '🛕' },
  { code: 'in-te', label: 'Telugu (AP & Telangana)', flag: '🌾' },
  { code: 'in-ka', label: 'Kannada (Karnataka)', flag: '🏵️' },
  { code: 'in-kl', label: 'Malayali (Kerala)', flag: '🥥' },
  { code: 'ca', label: 'Canada', flag: '🇨🇦' },
];

/**
 * Computes Western Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Finds the Nth weekday of a given month (e.g. 4th Thursday in November)
 * weekday: 0 = Sun, 1 = Mon, ..., 4 = Thu
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) break;
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return d;
    }
  }
  return firstDay;
}

/**
 * Finds the last weekday of a given month (e.g. last Monday in May)
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  for (let day = lastDay.getDate(); day >= 1; day--) {
    const d = new Date(year, month, day);
    if (d.getDay() === weekday) return d;
  }
  return lastDay;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Base recurring fixed holidays by MM-DD
 */
const FIXED_HOLIDAYS: Array<{
  mmdd: string;
  name: string;
  regions: RegionCode[];
  isPublicHoliday: boolean;
  icon?: string;
  description?: string;
}> = [
  // January
  { mmdd: '01-01', name: "New Year's Day", regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: true, icon: '🎉' },
  { mmdd: '01-04', name: 'World Braille Day', regions: ['international'], isPublicHoliday: false, icon: '⠃' },
  { mmdd: '01-26', name: 'Republic Day (India)', regions: ['in'], isPublicHoliday: true, icon: '🇮🇳' },
  { mmdd: '01-27', name: 'International Holocaust Remembrance Day', regions: ['international'], isPublicHoliday: false, icon: '🕯️' },

  // February
  { mmdd: '02-02', name: 'Groundhog Day', regions: ['us', 'ca'], isPublicHoliday: false, icon: '🦔' },
  { mmdd: '02-04', name: 'World Cancer Day', regions: ['international'], isPublicHoliday: false, icon: '🎗️' },
  { mmdd: '02-14', name: "Valentine's Day", regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '❤️' },
  { mmdd: '02-21', name: 'International Mother Language Day', regions: ['international'], isPublicHoliday: false, icon: '🗣️' },

  // March
  { mmdd: '03-08', name: "International Women's Day", regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '💜' },
  { mmdd: '03-14', name: 'Pi Day', regions: ['international', 'us'], isPublicHoliday: false, icon: '🥧' },
  { mmdd: '03-17', name: "St. Patrick's Day", regions: ['international', 'us', 'uk', 'ca'], isPublicHoliday: false, icon: '☘️' },
  { mmdd: '03-20', name: 'International Day of Happiness', regions: ['international'], isPublicHoliday: false, icon: '😊' },
  { mmdd: '03-21', name: 'World Poetry Day', regions: ['international'], isPublicHoliday: false, icon: '📜' },
  { mmdd: '03-22', name: 'World Water Day', regions: ['international'], isPublicHoliday: false, icon: '💧' },

  // April
  { mmdd: '04-01', name: "April Fools' Day", regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '🃏' },
  { mmdd: '04-07', name: 'World Health Day', regions: ['international'], isPublicHoliday: false, icon: '🩺' },
  { mmdd: '04-14', name: 'Ambedkar Jayanti', regions: ['in'], isPublicHoliday: true, icon: '🇮🇳' },
  { mmdd: '04-22', name: 'Earth Day', regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '🌍' },
  { mmdd: '04-23', name: 'World Book Day', regions: ['international'], isPublicHoliday: false, icon: '📚' },
  { mmdd: '04-25', name: 'World Malaria Day', regions: ['international'], isPublicHoliday: false, icon: '🦟' },

  // May
  { mmdd: '05-01', name: 'International Workers\' Day / May Day', regions: ['international', 'uk', 'in'], isPublicHoliday: true, icon: '🛠️' },
  { mmdd: '05-03', name: 'World Press Freedom Day', regions: ['international'], isPublicHoliday: false, icon: '📰' },
  { mmdd: '05-04', name: 'Star Wars Day', regions: ['international', 'us'], isPublicHoliday: false, icon: '✨' },
  { mmdd: '05-09', name: 'Europe Day', regions: ['international', 'uk'], isPublicHoliday: false, icon: '🇪🇺' },

  // June
  { mmdd: '06-05', name: 'World Environment Day', regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '🌱' },
  { mmdd: '06-08', name: 'World Oceans Day', regions: ['international'], isPublicHoliday: false, icon: '🌊' },
  { mmdd: '06-19', name: 'Juneteenth', regions: ['us'], isPublicHoliday: true, icon: '✊🏽' },
  { mmdd: '06-21', name: 'International Yoga Day & World Music Day', regions: ['international', 'in'], isPublicHoliday: false, icon: '🧘' },

  // July
  { mmdd: '07-01', name: 'Canada Day', regions: ['ca'], isPublicHoliday: true, icon: '🇨🇦' },
  { mmdd: '07-04', name: 'Independence Day (US)', regions: ['us'], isPublicHoliday: true, icon: '🎆' },
  { mmdd: '07-11', name: 'World Population Day', regions: ['international'], isPublicHoliday: false, icon: '👥' },
  { mmdd: '07-14', name: 'Bastille Day', regions: ['international'], isPublicHoliday: false, icon: '🇫🇷' },
  { mmdd: '07-20', name: 'International Moon Day', regions: ['international'], isPublicHoliday: false, icon: '🌕' },
  { mmdd: '07-30', name: 'International Day of Friendship', regions: ['international'], isPublicHoliday: false, icon: '🤝' },

  // August
  { mmdd: '08-12', name: 'International Youth Day', regions: ['international'], isPublicHoliday: false, icon: '🌟' },
  { mmdd: '08-15', name: 'Independence Day (India)', regions: ['in'], isPublicHoliday: true, icon: '🇮🇳' },
  { mmdd: '08-19', name: 'World Photography Day', regions: ['international'], isPublicHoliday: false, icon: '📷' },
  { mmdd: '08-26', name: 'Women\'s Equality Day', regions: ['us', 'international'], isPublicHoliday: false, icon: '⚖️' },

  // September
  { mmdd: '09-08', name: 'International Literacy Day', regions: ['international'], isPublicHoliday: false, icon: '📖' },
  { mmdd: '09-15', name: 'International Day of Democracy', regions: ['international'], isPublicHoliday: false, icon: '🗳️' },
  { mmdd: '09-21', name: 'International Day of Peace', regions: ['international'], isPublicHoliday: false, icon: '🕊️' },
  { mmdd: '09-27', name: 'World Tourism Day', regions: ['international'], isPublicHoliday: false, icon: '✈️' },

  // October
  { mmdd: '10-02', name: 'Gandhi Jayanti', regions: ['in', 'international'], isPublicHoliday: true, icon: '🕊️' },
  { mmdd: '10-05', name: 'World Teachers\' Day', regions: ['international'], isPublicHoliday: false, icon: '🧑‍🏫' },
  { mmdd: '10-10', name: 'World Mental Health Day', regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '🧠' },
  { mmdd: '10-24', name: 'United Nations Day', regions: ['international'], isPublicHoliday: false, icon: '🇺🇳' },
  { mmdd: '10-31', name: 'Halloween', regions: ['international', 'us', 'uk', 'ca'], isPublicHoliday: false, icon: '🎃' },

  // November
  { mmdd: '11-10', name: 'World Science Day for Peace and Development', regions: ['international'], isPublicHoliday: false, icon: '🔬' },
  { mmdd: '11-11', name: 'Veterans Day / Remembrance Day', regions: ['us', 'uk', 'ca'], isPublicHoliday: true, icon: '🌺' },
  { mmdd: '11-14', name: 'World Diabetes Day', regions: ['international'], isPublicHoliday: false, icon: '💙' },
  { mmdd: '11-20', name: 'World Children\'s Day', regions: ['international'], isPublicHoliday: false, icon: '🎈' },

  // December
  { mmdd: '12-01', name: 'World AIDS Day', regions: ['international'], isPublicHoliday: false, icon: '🎗️' },
  { mmdd: '12-10', name: 'Human Rights Day', regions: ['international'], isPublicHoliday: false, icon: '🌐' },
  { mmdd: '12-24', name: 'Christmas Eve', regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '🕯️' },
  { mmdd: '12-25', name: 'Christmas Day', regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: true, icon: '🎄' },
  { mmdd: '12-26', name: 'Boxing Day', regions: ['uk', 'ca'], isPublicHoliday: true, icon: '🎁' },
  { mmdd: '12-31', name: "New Year's Eve", regions: ['international', 'us', 'uk', 'in', 'ca'], isPublicHoliday: false, icon: '🥂' },
  // India: national & regional (fixed dates)
  { mmdd: '01-12', name: 'National Youth Day (Swami Vivekananda)', regions: ['in'], isPublicHoliday: false, icon: '🧑‍🎓' },
  { mmdd: '01-13', name: 'Lohri', regions: ['in', 'in-pb'], isPublicHoliday: false, icon: '🔥' },
  { mmdd: '01-23', name: 'Netaji Subhas Chandra Bose Jayanti', regions: ['in', 'in-wb'], isPublicHoliday: false, icon: '🇮🇳' },
  { mmdd: '01-30', name: "Martyrs' Day (Gandhi Punyatithi)", regions: ['in'], isPublicHoliday: false, icon: '🕊️' },
  { mmdd: '02-19', name: 'Chhatrapati Shivaji Maharaj Jayanti', regions: ['in-mh'], isPublicHoliday: true, icon: '🚩' },
  { mmdd: '02-27', name: 'Marathi Bhasha Gaurav Din', regions: ['in-mh'], isPublicHoliday: false, icon: '📖' },
  { mmdd: '02-28', name: 'National Science Day', regions: ['in'], isPublicHoliday: false, icon: '🔬' },
  { mmdd: '03-23', name: 'Shaheed Diwas (Bhagat Singh, Rajguru, Sukhdev)', regions: ['in', 'in-pb'], isPublicHoliday: false, icon: '🕯️' },
  { mmdd: '04-14', name: 'Baisakhi / Vaisakhi', regions: ['in', 'in-pb'], isPublicHoliday: true, icon: '🌾' },
  { mmdd: '04-14', name: 'Tamil New Year (Puthandu)', regions: ['in-tn'], isPublicHoliday: true, icon: '🌺' },
  { mmdd: '04-14', name: 'Vishu', regions: ['in-kl'], isPublicHoliday: true, icon: '🌼' },
  { mmdd: '04-15', name: 'Poila Boishakh (Bengali New Year)', regions: ['in-wb'], isPublicHoliday: true, icon: '🪔' },
  { mmdd: '05-01', name: 'Maharashtra Day', regions: ['in-mh'], isPublicHoliday: true, icon: '🚩' },
  { mmdd: '05-01', name: 'Gujarat Day', regions: ['in-gj'], isPublicHoliday: true, icon: '🦁' },
  { mmdd: '05-09', name: 'Rabindra Jayanti', regions: ['in-wb'], isPublicHoliday: false, icon: '✍️' },
  { mmdd: '06-02', name: 'Telangana Formation Day', regions: ['in-te'], isPublicHoliday: true, icon: '🌾' },
  { mmdd: '07-26', name: 'Kargil Vijay Diwas', regions: ['in'], isPublicHoliday: false, icon: '🎖️' },
  { mmdd: '08-01', name: 'Lokmanya Tilak Punyatithi / Annabhau Sathe Jayanti', regions: ['in-mh'], isPublicHoliday: false, icon: '📜' },
  { mmdd: '09-05', name: "Teachers' Day", regions: ['in'], isPublicHoliday: false, icon: '🍎' },
  { mmdd: '09-14', name: 'Hindi Diwas', regions: ['in'], isPublicHoliday: false, icon: '🔤' },
  { mmdd: '09-15', name: "Engineers' Day", regions: ['in', 'in-ka'], isPublicHoliday: false, icon: '⚙️' },
  { mmdd: '10-31', name: 'National Unity Day (Sardar Patel Jayanti)', regions: ['in', 'in-gj'], isPublicHoliday: false, icon: '🇮🇳' },
  { mmdd: '11-01', name: 'Karnataka Rajyotsava', regions: ['in-ka'], isPublicHoliday: true, icon: '🏵️' },
  { mmdd: '11-01', name: 'Andhra Pradesh Formation Day', regions: ['in-te'], isPublicHoliday: false, icon: '🌾' },
  { mmdd: '11-01', name: 'Kerala Piravi', regions: ['in-kl'], isPublicHoliday: true, icon: '🥥' },
  { mmdd: '11-14', name: "Children's Day (Nehru Jayanti)", regions: ['in'], isPublicHoliday: false, icon: '🎈' },
  { mmdd: '11-26', name: 'Constitution Day (Samvidhan Divas)', regions: ['in'], isPublicHoliday: false, icon: '📘' },
  { mmdd: '12-06', name: 'Mahaparinirvan Din (Dr. Ambedkar)', regions: ['in', 'in-mh'], isPublicHoliday: false, icon: '🕯️' },
  { mmdd: '12-22', name: 'National Mathematics Day', regions: ['in', 'in-tn'], isPublicHoliday: false, icon: '➗' },
];

/**
 * Lunar-calendar festivals have no fixed date, so they are listed per year.
 * Dates are the commonly published ones and can differ by a day by region/panchang.
 */
const LUNAR_FESTIVALS: Record<number, Array<[string, string, RegionCode[], boolean, string]>> = {
  2026: [
    ['01-14', 'Makar Sankranti', ['in', 'in-mh', 'in-gj'], true, '🪁'],
    ['01-14', 'Pongal', ['in-tn', 'in-te'], true, '🍚'],
    ['01-23', 'Vasant Panchami / Saraswati Puja', ['in', 'in-wb'], false, '📚'],
    ['02-15', 'Maha Shivaratri', ['in'], true, '🔱'],
    ['03-03', 'Holika Dahan', ['in'], false, '🔥'],
    ['03-04', 'Holi', ['in'], true, '🎨'],
    ['03-19', 'Gudi Padwa (Marathi New Year)', ['in-mh'], true, '🚩'],
    ['03-19', 'Ugadi (Telugu & Kannada New Year)', ['in-te', 'in-ka'], true, '🌿'],
    ['03-21', 'Eid al-Fitr (approx.)', ['in', 'international'], true, '🌙'],
    ['03-26', 'Ram Navami', ['in'], true, '🏹'],
    ['03-31', 'Mahavir Jayanti', ['in'], true, '☸️'],
    ['05-01', 'Buddha Purnima', ['in'], true, '🪷'],
    ['05-27', 'Eid al-Adha / Bakrid (approx.)', ['in', 'international'], true, '🌙'],
    ['06-26', 'Muharram (approx.)', ['in'], true, '🌙'],
    ['07-16', 'Rath Yatra', ['in'], false, '🛕'],
    ['07-29', 'Guru Purnima', ['in', 'in-mh'], false, '🙏'],
    ['08-26', 'Onam (Thiruvonam)', ['in-kl'], true, '🌸'],
    ['08-28', 'Raksha Bandhan', ['in'], false, '🧵'],
    ['09-04', 'Janmashtami', ['in'], true, '🦚'],
    ['09-14', 'Ganesh Chaturthi', ['in', 'in-mh'], true, '🐘'],
    ['10-11', 'Navratri begins', ['in', 'in-gj'], false, '💃'],
    ['10-17', 'Durga Puja begins (Maha Shashthi)', ['in-wb'], false, '🪔'],
    ['10-20', 'Dussehra (Vijayadashami)', ['in'], true, '🏹'],
    ['10-29', 'Karva Chauth', ['in', 'in-pb'], false, '🌕'],
    ['11-06', 'Dhanteras', ['in'], false, '🪙'],
    ['11-08', 'Diwali (Lakshmi Puja)', ['in'], true, '🪔'],
    ['11-08', 'Bandi Chhor Divas', ['in-pb'], false, '🪔'],
    ['11-09', 'Govardhan Puja / Gujarati New Year (Bestu Varas)', ['in-gj'], true, '🎆'],
    ['11-11', 'Bhai Dooj', ['in'], false, '🧡'],
    ['11-15', 'Chhath Puja', ['in'], false, '🌅'],
    ['11-24', 'Guru Nanak Jayanti (Gurpurab)', ['in', 'in-pb'], true, '🙏'],
  ],
  2027: [
    ['01-13', 'Lohri', ['in', 'in-pb'], false, '🔥'],
    ['01-14', 'Makar Sankranti', ['in', 'in-mh', 'in-gj'], true, '🪁'],
    ['01-14', 'Pongal', ['in-tn', 'in-te'], true, '🍚'],
    ['02-11', 'Vasant Panchami / Saraswati Puja', ['in', 'in-wb'], false, '📚'],
    ['03-06', 'Maha Shivaratri', ['in'], true, '🔱'],
    ['03-22', 'Holi', ['in'], true, '🎨'],
    ['04-07', 'Gudi Padwa (Marathi New Year)', ['in-mh'], true, '🚩'],
    ['04-07', 'Ugadi (Telugu & Kannada New Year)', ['in-te', 'in-ka'], true, '🌿'],
    ['04-15', 'Ram Navami', ['in'], true, '🏹'],
    ['05-20', 'Buddha Purnima', ['in'], true, '🪷'],
    ['08-17', 'Raksha Bandhan', ['in'], false, '🧵'],
    ['08-25', 'Janmashtami', ['in'], true, '🦚'],
    ['09-04', 'Ganesh Chaturthi', ['in', 'in-mh'], true, '🐘'],
    ['09-12', 'Onam (Thiruvonam)', ['in-kl'], true, '🌸'],
    ['10-09', 'Dussehra (Vijayadashami)', ['in'], true, '🏹'],
    ['10-29', 'Diwali (Lakshmi Puja)', ['in'], true, '🪔'],
    ['11-15', 'Guru Nanak Jayanti (Gurpurab)', ['in', 'in-pb'], true, '🙏'],
  ],
};

/**
 * Computes all holidays (fixed + dynamic) for a given year.
 */
export function getHolidaysForYear(year: number): CalendarHoliday[] {
  const result: CalendarHoliday[] = [];

  // 1. Add fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    result.push({
      id: `${year}-${h.mmdd}-${h.name}`,
      name: h.name,
      dateStr: `${year}-${h.mmdd}`,
      isPublicHoliday: h.isPublicHoliday,
      regions: h.regions,
      icon: h.icon,
      description: h.description,
    });
  }

  // 2. Dynamic Easter and related observances
  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  result.push({
    id: `${year}-good-friday`,
    name: 'Good Friday',
    dateStr: toDateKey(goodFriday),
    isPublicHoliday: true,
    regions: ['international', 'uk', 'ca', 'in'],
    icon: '✝️',
  });

  result.push({
    id: `${year}-easter-sunday`,
    name: 'Easter Sunday',
    dateStr: toDateKey(easter),
    isPublicHoliday: false,
    regions: ['international', 'us', 'uk', 'ca'],
    icon: '🐣',
  });

  result.push({
    id: `${year}-easter-monday`,
    name: 'Easter Monday',
    dateStr: toDateKey(easterMonday),
    isPublicHoliday: true,
    regions: ['uk', 'ca'],
    icon: '🐣',
  });

  // 3. US & Canada Movable Holidays
  // MLK Jr. Day: 3rd Monday in January (US)
  const mlk = getNthWeekdayOfMonth(year, 0, 1, 3);
  result.push({
    id: `${year}-mlk-day`,
    name: 'Martin Luther King Jr. Day',
    dateStr: toDateKey(mlk),
    isPublicHoliday: true,
    regions: ['us'],
    icon: '🕊️',
  });

  // Presidents' Day / Washington's Birthday: 3rd Monday in February (US)
  const pres = getNthWeekdayOfMonth(year, 1, 1, 3);
  result.push({
    id: `${year}-presidents-day`,
    name: "Presidents' Day",
    dateStr: toDateKey(pres),
    isPublicHoliday: true,
    regions: ['us'],
    icon: '🏛️',
  });

  // Mother's Day: 2nd Sunday in May
  const mothersDay = getNthWeekdayOfMonth(year, 4, 0, 2);
  result.push({
    id: `${year}-mothers-day`,
    name: "Mother's Day",
    dateStr: toDateKey(mothersDay),
    isPublicHoliday: false,
    regions: ['international', 'us', 'ca', 'in'],
    icon: '💐',
  });

  // Memorial Day: Last Monday in May (US)
  const memorial = getLastWeekdayOfMonth(year, 4, 1);
  result.push({
    id: `${year}-memorial-day`,
    name: 'Memorial Day',
    dateStr: toDateKey(memorial),
    isPublicHoliday: true,
    regions: ['us'],
    icon: '🇺🇸',
  });

  // Father's Day: 3rd Sunday in June
  const fathersDay = getNthWeekdayOfMonth(year, 5, 0, 3);
  result.push({
    id: `${year}-fathers-day`,
    name: "Father's Day",
    dateStr: toDateKey(fathersDay),
    isPublicHoliday: false,
    regions: ['international', 'us', 'uk', 'ca', 'in'],
    icon: '👔',
  });

  // Labor Day: 1st Monday in September (US & CA)
  const laborDay = getNthWeekdayOfMonth(year, 8, 1, 1);
  result.push({
    id: `${year}-labor-day`,
    name: 'Labor Day',
    dateStr: toDateKey(laborDay),
    isPublicHoliday: true,
    regions: ['us', 'ca'],
    icon: '👷',
  });

  // Indigenous Peoples' Day / Columbus Day / Thanksgiving CA: 2nd Monday in October
  const secondMonOct = getNthWeekdayOfMonth(year, 9, 1, 2);
  result.push({
    id: `${year}-thanksgiving-ca`,
    name: 'Thanksgiving (Canada) & Indigenous Peoples\' Day (US)',
    dateStr: toDateKey(secondMonOct),
    isPublicHoliday: true,
    regions: ['ca', 'us'],
    icon: '🦃',
  });

  // Thanksgiving US: 4th Thursday in November
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
  result.push({
    id: `${year}-thanksgiving-us`,
    name: 'Thanksgiving Day (US)',
    dateStr: toDateKey(thanksgiving),
    isPublicHoliday: true,
    regions: ['us'],
    icon: '🦃',
  });

  // Black Friday: Day after Thanksgiving
  const blackFriday = new Date(thanksgiving);
  blackFriday.setDate(thanksgiving.getDate() + 1);
  result.push({
    id: `${year}-black-friday`,
    name: 'Black Friday',
    dateStr: toDateKey(blackFriday),
    isPublicHoliday: false,
    regions: ['us', 'international', 'uk', 'ca'],
    icon: '🛍️',
  });

  for (const [mmdd, name, regions, isPublicHoliday, icon] of LUNAR_FESTIVALS[year] || []) {
    result.push({ id: `${year}-${mmdd}-${name}`, name, dateStr: `${year}-${mmdd}`, isPublicHoliday, regions, icon, description: 'Follows the lunar calendar; may differ by a day by region.' });
  }

  return result;
}

/**
 * Curated daily real-world historical & scientific events across the calendar
 */
const CURATED_DAILY_EVENTS: Record<string, RealWorldEvent[]> = {
  // Jan
  '01-01': [
    { year: 1863, title: 'Emancipation Proclamation issued by Abraham Lincoln', category: 'history' },
    { year: 1983, title: 'ARPANET officially transitions to Internet Protocol (TCP/IP), creating the modern Internet', category: 'tech' },
  ],
  '01-09': [
    { year: 2007, title: 'Steve Jobs unveils the first iPhone at Macworld in San Francisco', category: 'tech' },
  ],
  '01-15': [
    { year: 2001, title: 'Wikipedia goes online, launched by Jimmy Wales and Larry Sanger', category: 'tech' },
  ],
  '01-26': [
    { year: 1950, title: 'Constitution of India comes into effect, establishing the Republic of India', category: 'history' },
  ],
  '01-28': [
    { year: 1986, title: 'Space Shuttle Challenger disaster occurs shortly after liftoff', category: 'space' },
  ],
  // Feb
  '02-11': [
    { year: 1990, title: 'Nelson Mandela is released from Victor Verster Prison after 27 years', category: 'history' },
  ],
  '02-14': [
    { year: 1946, title: 'ENIAC, the first general-purpose electronic computer, is formally dedicated at UPenn', category: 'tech' },
  ],
  '02-18': [
    { year: 1930, title: 'Pluto is discovered by Clyde Tombaugh at Lowell Observatory', category: 'space' },
  ],
  '02-28': [
    { year: 1953, title: 'James Watson and Francis Crick discover the chemical structure of DNA (double helix)', category: 'science' },
  ],
  // Mar
  '03-14': [
    { year: 1879, title: 'Albert Einstein is born in Ulm, Germany', category: 'science' },
    { year: 2018, title: 'Theoretical physicist Stephen Hawking passes away', category: 'science' },
  ],
  '03-24': [
    { year: 1882, title: 'Robert Koch announces the discovery of Mycobacterium tuberculosis, the bacteria causing TB', category: 'science' },
  ],
  // Apr
  '04-12': [
    { year: 1961, title: 'Yuri Gagarin becomes the first human in space aboard Vostok 1', category: 'space' },
    { year: 1981, title: 'First Space Shuttle flight (STS-1) launches aboard Columbia', category: 'space' },
  ],
  '04-15': [
    { year: 1912, title: 'RMS Titanic sinks in the North Atlantic Ocean', category: 'history' },
  ],
  '04-24': [
    { year: 1990, title: 'Hubble Space Telescope is launched into low Earth orbit by Space Shuttle Discovery', category: 'space' },
  ],
  // May
  '05-06': [
    { year: 1954, title: 'Roger Bannister breaks the four-minute mile barrier (3:59.4)', category: 'culture' },
  ],
  '05-10': [
    { year: 1994, title: 'Nelson Mandela is inaugurated as the first black president of South Africa', category: 'history' },
  ],
  '05-29': [
    { year: 1953, title: 'Sir Edmund Hillary and Tenzing Norgay make the first confirmed ascent of Mount Everest', category: 'history' },
  ],
  // Jun
  '06-06': [
    { year: 1944, title: 'D-Day: Allied forces stage the largest amphibious invasion in history at Normandy', category: 'history' },
  ],
  '06-20': [
    { year: 1837, title: 'Queen Victoria ascends to the British throne at age 18', category: 'history' },
  ],
  // Jul
  '07-16': [
    { year: 1969, title: 'Apollo 11 launches from Kennedy Space Center toward the Moon', category: 'space' },
  ],
  '07-20': [
    { year: 1969, title: 'Neil Armstrong and Buzz Aldrin become the first humans to land on the Moon', category: 'space' },
  ],
  '07-25': [
    { year: 1978, title: 'Louise Brown, the first human born through in vitro fertilisation (IVF), is born', category: 'science' },
  ],
  // Aug
  '08-06': [
    { year: 1991, title: 'Tim Berners-Lee publishes the first website on the World Wide Web', category: 'tech' },
  ],
  '08-25': [
    { year: 1989, title: 'Voyager 2 makes its closest approach to Neptune', category: 'space' },
    { year: 2012, title: 'Voyager 1 officially enters interstellar space, becoming the first human-made craft to do so', category: 'space' },
  ],
  '08-28': [
    { year: 1963, title: 'Martin Luther King Jr. delivers his famous "I Have a Dream" speech in Washington, D.C.', category: 'history' },
  ],
  // Sep
  '09-04': [
    { year: 1998, title: 'Google is founded by Larry Page and Sergey Brin while PhD students at Stanford', category: 'tech' },
  ],
  '09-28': [
    { year: 1928, title: 'Alexander Fleming discovers penicillin at St Mary\'s Hospital, London', category: 'science' },
  ],
  // Oct
  '10-04': [
    { year: 1957, title: 'Soviet Union launches Sputnik 1, the first artificial Earth satellite, inaugurating the Space Age', category: 'space' },
  ],
  '10-24': [
    { year: 1945, title: 'United Nations Charter enters into force, formally establishing the UN', category: 'history' },
  ],
  '10-26': [
    { year: 1881, title: 'The Gunfight at the O.K. Corral takes place in Tombstone, Arizona', category: 'history' },
    { year: 2004, title: 'NASA\'s Cassini-Huygens spacecraft performs its first close flyby of Titan', category: 'space' },
    { year: 1977, title: 'The last natural case of smallpox is diagnosed in Somalia, marking eradication', category: 'science' },
  ],
  '10-29': [
    { year: 1969, title: 'First message is sent over ARPANET from UCLA to Stanford, establishing the foundation of the Internet', category: 'tech' },
  ],
  // Nov
  '11-09': [
    { year: 1989, title: 'The Berlin Wall is opened, leading to the reunification of Germany and end of the Cold War', category: 'history' },
  ],
  '11-20': [
    { year: 1998, title: 'First module of the International Space Station (Zarya) launches from Baikonur Cosmodrome', category: 'space' },
  ],
  // Dec
  '12-07': [
    { year: 1972, title: 'Apollo 17 crew captures "The Blue Marble", one of the most iconic photographs of Earth', category: 'space' },
  ],
  '12-17': [
    { year: 1903, title: 'Wright brothers make the first controlled, powered, heavier-than-air human flight at Kitty Hawk', category: 'tech' },
  ],
  '12-25': [
    { year: 2021, title: 'James Webb Space Telescope (JWST) launches successfully aboard Ariane 5 from French Guiana', category: 'space' },
  ],
};

// In-memory cache for year holidays
const holidaysByYearCache = new Map<number, CalendarHoliday[]>();

/**
 * Returns all holidays matching the date and active region filter.
 */
export function getHolidaysForDate(date: Date, region: RegionCode = 'all'): CalendarHoliday[] {
  const year = date.getFullYear();
  if (!holidaysByYearCache.has(year)) {
    holidaysByYearCache.set(year, getHolidaysForYear(year));
  }

  const allYearHolidays = holidaysByYearCache.get(year) || [];
  const targetKey = toDateKey(date);

  return allYearHolidays.filter((h) => {
    if (h.dateStr !== targetKey) return false;
    return matchesRegion(h, region);
  });
}

/**
 * Gets the primary holiday for a date (if any)
 */
export function getPrimaryHolidayForDate(date: Date, region: RegionCode = 'all'): CalendarHoliday | null {
  const holidays = getHolidaysForDate(date, region);
  if (holidays.length === 0) return null;
  // Prefer public holiday first
  const pub = holidays.find((h) => h.isPublicHoliday);
  return pub || holidays[0] || null;
}

/**
 * Gets upcoming holidays from a given reference date
 */
export function getUpcomingHolidays(
  fromDate: Date,
  count: number = 5,
  region: RegionCode = 'all'
): CalendarHoliday[] {
  const currentYear = fromDate.getFullYear();
  const nextYear = currentYear + 1;

  if (!holidaysByYearCache.has(currentYear)) {
    holidaysByYearCache.set(currentYear, getHolidaysForYear(currentYear));
  }
  if (!holidaysByYearCache.has(nextYear)) {
    holidaysByYearCache.set(nextYear, getHolidaysForYear(nextYear));
  }

  const combined = [
    ...(holidaysByYearCache.get(currentYear) || []),
    ...(holidaysByYearCache.get(nextYear) || []),
  ];

  const fromTime = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();

  return combined
    .filter((h) => {
      const hTime = new Date(h.dateStr).getTime();
      if (hTime < fromTime) return false;
      return matchesRegion(h, region);
    })
    .sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime())
    .slice(0, count);
}

/**
 * Gets curated real-world historical and scientific events for a specific date (MM-DD)
 */
export function getCuratedWorldEventsForDate(date: Date): RealWorldEvent[] {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const key = `${m}-${d}`;
  return CURATED_DAILY_EVENTS[key] || [];
}

/**
 * Fetches real-world events from Wikipedia's open "On This Day" API with localStorage caching.
 * Falls back gracefully to curated local events if offline or request fails.
 */
export async function fetchLiveWorldEvents(date: Date): Promise<RealWorldEvent[]> {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const cacheKey = `onthisday_${m}_${d}`;

  // 1. Check local storage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // 2. Fetch from Wikipedia open API
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${m}/${d}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const events: RealWorldEvent[] = (data.selected || []).slice(0, 5).map((item: any) => ({
        year: item.year,
        title: item.text,
        category: 'history' as const,
      }));

      if (events.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(events));
        } catch {}
        return events;
      }
    }
  } catch {
    // network failure / offline
  }

  // 3. Fallback to curated events
  return getCuratedWorldEventsForDate(date);
}
