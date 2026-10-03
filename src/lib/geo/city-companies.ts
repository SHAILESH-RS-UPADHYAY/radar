// ============================
// RADAR — Which companies are really in which city
// ============================
// Two signals are combined by /api/companies:
//   1. LIVE  — companies whose scraped, currently-open jobs list this city (hard evidence, with counts)
//   2. KNOWN — the curated list below: well-established engineering offices / HQs in each city
// Only cities in this file get a KNOWN list; any other city still works through LIVE evidence.

/** Spellings that refer to the same city, used to match free-text job locations. */
const CITY_ALIASES: Record<string, string[]> = {
  Bangalore: ['bangalore', 'bengaluru', 'banglore', 'bangaluru'],
  Mumbai: ['mumbai', 'bombay', 'navi mumbai', 'thane'],
  Delhi: ['delhi', 'new delhi', 'ncr', 'delhi ncr'],
  Gurugram: ['gurugram', 'gurgaon'],
  Noida: ['noida', 'greater noida'],
  Hyderabad: ['hyderabad', 'secunderabad'],
  Chennai: ['chennai', 'madras'],
  Pune: ['pune'],
  Kolkata: ['kolkata', 'calcutta'],
  Ahmedabad: ['ahmedabad', 'gandhinagar'],
  Kochi: ['kochi', 'cochin'],
  Thiruvananthapuram: ['thiruvananthapuram', 'trivandrum'],
  Coimbatore: ['coimbatore'],
  Jaipur: ['jaipur'],
  // The tricity: one job market.
  Chandigarh: ['chandigarh', 'mohali', 'sas nagar', 'panchkula', 'zirakpur', 'kharar'],
  'San Francisco': ['san francisco', 'sf', 'bay area'],
  'New York': ['new york', 'nyc'],
  London: ['london'],
  Toronto: ['toronto'],
  Singapore: ['singapore'],
  Dubai: ['dubai'],
};

export function cityAliases(city: string): string[] {
  const key = Object.keys(CITY_ALIASES).find(
    (k) => k.toLowerCase() === city.trim().toLowerCase() || CITY_ALIASES[k].includes(city.trim().toLowerCase()),
  );
  return key ? CITY_ALIASES[key] : [city.trim().toLowerCase()];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A whole-word hit: "sf" in "San Francisco, SF" yes, in "transfer" no; "Pune / Remote" holds both segments. */
const hasPlace = (location: string, alias: string) => new RegExp(`(^|[^a-z])${escape(alias)}($|[^a-z])`).test(location);

export type PlaceFit =
  { kind: 'any' } | { kind: 'city'; city: string } | { kind: 'remote'; wanted: boolean } | { kind: 'elsewhere' };

/**
 * Where a job sits relative to the user's cities ('Remote' among them means remote roles are wanted).
 * Shared by scoring and the dashboard's location filter so both read locations the same way.
 */
export function placeFit(cities: string[], location: string | null | undefined, workType?: string | null): PlaceFit {
  const wanted = cities.map((c) => c.trim()).filter(Boolean);
  if (!wanted.length) return { kind: 'any' };
  const loc = (location || '').toLowerCase();
  const city = wanted
    .filter((c) => c.toLowerCase() !== 'remote')
    .find((c) => cityAliases(c).some((alias) => hasPlace(loc, alias)));
  if (city) return { kind: 'city', city };
  if (workType === 'remote' || hasPlace(loc, 'remote')) {
    return { kind: 'remote', wanted: wanted.some((c) => c.toLowerCase() === 'remote') };
  }
  return { kind: 'elsewhere' };
}

const COUNTRY_ONLY = /^\s*(india|in|ind|pan[ -]india|anywhere in india)\s*$/i;

/**
 * Autopilot's strict city: a job counts only in one of your cities, as a remote role (if you allow remote) or, when
 * you allow it, a posting that names only the country ("India"). Unlike placeFit, nothing else gets through.
 */
export function inStrictCity(
  cities: string[],
  location: string | null | undefined,
  workType: string | null | undefined,
  opts: { remote: boolean; countryOnly: boolean },
): boolean {
  const fit = placeFit(cities, location, workType);
  if (fit.kind === 'city') return true;
  if (fit.kind === 'remote') return opts.remote;
  return opts.countryOnly && COUNTRY_ONLY.test(location || '');
}

export function canonicalCity(city: string): string {
  const lower = city.trim().toLowerCase();
  return (
    Object.keys(CITY_ALIASES).find((k) => k.toLowerCase() === lower || CITY_ALIASES[k].includes(lower)) || city.trim()
  );
}

type Tier = 'MNC' | 'Growth' | 'Startup';

// Engineering offices / headquarters that are publicly established in each city.
const KNOWN: Record<string, Record<Tier, string[]>> = {
  Bangalore: {
    MNC: [
      'Google',
      'Microsoft',
      'Amazon',
      'Apple',
      'Adobe',
      'Oracle',
      'Intel',
      'Cisco',
      'NVIDIA',
      'Salesforce',
      'SAP',
      'IBM',
      'Goldman Sachs',
      'JPMorgan Chase',
      'Walmart Global Tech',
      'Target',
      'Uber',
      'Atlassian',
      'Qualcomm',
      'Samsung R&D',
      'Texas Instruments',
      'VMware',
      'Infosys',
      'Wipro',
      'Stripe',
      'Visa',
      'LinkedIn',
      'Intuit',
      'ServiceNow',
      'Mastercard',
    ],
    Growth: [
      'Flipkart',
      'Swiggy',
      'Razorpay',
      'CRED',
      'Zerodha',
      'PhonePe',
      'Meesho',
      'Groww',
      'ShareChat',
      'Postman',
      'Dunzo',
      'Udaan',
      'Ola',
      'BrowserStack',
      'InMobi',
      'Myntra',
    ],
    Startup: ['Sarvam AI', 'Krutrim', 'Jupiter', 'Slice', 'Hasura', 'Dukaan', 'Instahyre', 'Navi', 'Setu', 'Fi Money'],
  },
  Hyderabad: {
    MNC: [
      'Microsoft',
      'Google',
      'Amazon',
      'Apple',
      'Meta',
      'Salesforce',
      'Oracle',
      'Qualcomm',
      'Deloitte',
      'ServiceNow',
      'Uber',
      'Novartis',
      'JPMorgan Chase',
      'Goldman Sachs',
      'Intel',
      'AMD',
      'Micron',
      'Wells Fargo',
      'Infosys',
      'TCS',
    ],
    Growth: ['Darwinbox', 'Keka', 'Swiggy'],
    Startup: ['Skyroot Aerospace'],
  },
  Gurugram: {
    MNC: [
      'Google',
      'Microsoft',
      'Amazon',
      'Meta',
      'American Express',
      'Deloitte',
      'Accenture',
      'Samsung R&D',
      'Adobe',
      'Mastercard',
      'Uber',
      'Airbnb',
      'Expedia',
    ],
    Growth: ['Zomato', 'Urban Company', 'PolicyBazaar', 'MakeMyTrip', 'Cars24', 'Delhivery', 'Info Edge', 'Blinkit'],
    Startup: ['Spinny'],
  },
  Noida: {
    MNC: ['Adobe', 'Microsoft', 'Samsung R&D', 'Qualcomm', 'Cadence', 'HCLTech', 'Barclays'],
    Growth: ['Paytm', 'Info Edge', 'PW (Physics Wallah)'],
    Startup: ['Appinventiv', 'Classplus'],
  },
  Delhi: {
    MNC: ['Google', 'Microsoft', 'Amazon', 'Adobe', 'Samsung R&D'],
    Growth: ['Lenskart', 'Zomato', 'OYO', 'Delhivery'],
    Startup: [],
  },
  Mumbai: {
    MNC: [
      'Google',
      'Amazon',
      'Microsoft',
      'JPMorgan Chase',
      'Morgan Stanley',
      'Goldman Sachs',
      'Deutsche Bank',
      'Barclays',
      'Accenture',
      'Netflix',
      'Spotify',
      'TCS',
      'Reliance Jio',
    ],
    Growth: ['BrowserStack', 'Dream11', 'Nykaa', 'Upstox', 'CleverTap', 'Zepto', 'Haptik'],
    Startup: [],
  },
  Pune: {
    MNC: [
      'Microsoft',
      'Amazon',
      'Google',
      'Barclays',
      'Mastercard',
      'Deutsche Bank',
      'Persistent Systems',
      'Infosys',
      'TCS',
      'Siemens',
      'Bajaj Finserv',
      'NVIDIA',
      'Eaton',
    ],
    Growth: ['Druva', 'PubMatic', 'FirstCry'],
    Startup: [],
  },
  Chennai: {
    MNC: ['Amazon', 'PayPal', 'Microsoft', 'Walmart Global Tech', 'Cognizant', 'TCS', 'Infosys', 'Ford'],
    Growth: ['Freshworks', 'Zoho', 'Chargebee', 'Rocketlane'],
    Startup: ['Kissflow'],
  },
  Kolkata: { MNC: ['TCS', 'Cognizant', 'Accenture', 'IBM', 'PwC'], Growth: [], Startup: [] },
  Ahmedabad: { MNC: ['TCS', 'Infosys'], Growth: [], Startup: [] },
  Kochi: { MNC: ['EY', 'IBM', 'UST'], Growth: [], Startup: [] },
  Thiruvananthapuram: { MNC: ['UST', 'TCS', 'Infosys'], Growth: [], Startup: [] },
  Coimbatore: { MNC: ['Cognizant', 'Bosch'], Growth: [], Startup: [] },
  Jaipur: { MNC: ['Genpact'], Growth: [], Startup: [] },
  Chandigarh: { MNC: ['Infosys'], Growth: [], Startup: [] },
};

export interface KnownCompany {
  name: string;
  tier: Tier;
  city: string;
}

export function knownCompaniesIn(cities: string[]): KnownCompany[] {
  const out = new Map<string, KnownCompany>();
  for (const raw of cities) {
    const city = canonicalCity(raw);
    const entry = KNOWN[city];
    if (!entry) continue;
    for (const tier of ['MNC', 'Growth', 'Startup'] as Tier[]) {
      for (const name of entry[tier]) if (!out.has(name)) out.set(name, { name, tier, city });
    }
  }
  return [...out.values()];
}
