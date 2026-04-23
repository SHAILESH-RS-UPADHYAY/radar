// ============================
// RADAR — Company Seed Data
// ============================
// 50+ companies mapped to their ATS providers and board tokens
// This is the backbone of our scraping engine

export interface CompanySeed {
  name: string;
  careers_url: string;
  ats_provider: 'greenhouse' | 'lever' | 'ashby' | 'custom' | null;
  ats_identifier: string | null;
  category: 'MNC' | 'Growth' | 'Startup';
  country: string;
  city: string | null;
  logo_url: string | null;
}

export const COMPANY_SEEDS: CompanySeed[] = [
  // ============================
  // MNC — Multinational Corporations
  // ============================
  { name: 'Google', careers_url: 'https://www.google.com/about/careers/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Microsoft', careers_url: 'https://careers.microsoft.com/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Hyderabad', logo_url: null },
  { name: 'Amazon', careers_url: 'https://www.amazon.jobs/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Meta', careers_url: 'https://www.metacareers.com/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Gurugram', logo_url: null },
  { name: 'Apple', careers_url: 'https://jobs.apple.com/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Hyderabad', logo_url: null },
  { name: 'Netflix', careers_url: 'https://jobs.netflix.com/', ats_provider: 'greenhouse', ats_identifier: 'netflix', category: 'MNC', country: 'India', city: 'Mumbai', logo_url: null },
  { name: 'Uber', careers_url: 'https://www.uber.com/careers/', ats_provider: 'greenhouse', ats_identifier: 'uber', category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Salesforce', careers_url: 'https://www.salesforce.com/company/careers/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Hyderabad', logo_url: null },
  { name: 'Adobe', careers_url: 'https://www.adobe.com/careers.html', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Noida', logo_url: null },
  { name: 'Oracle', careers_url: 'https://www.oracle.com/careers/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Goldman Sachs', careers_url: 'https://www.goldmansachs.com/careers/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'JPMorgan Chase', careers_url: 'https://careers.jpmorgan.com/', ats_provider: 'custom', ats_identifier: null, category: 'MNC', country: 'India', city: 'Mumbai', logo_url: null },
  { name: 'Stripe', careers_url: 'https://stripe.com/jobs', ats_provider: 'greenhouse', ats_identifier: 'stripe', category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Atlassian', careers_url: 'https://www.atlassian.com/company/careers', ats_provider: 'greenhouse', ats_identifier: 'atlassian', category: 'MNC', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Spotify', careers_url: 'https://www.lifeatspotify.com/', ats_provider: 'greenhouse', ats_identifier: 'spotify', category: 'MNC', country: 'India', city: 'Mumbai', logo_url: null },

  // ============================
  // Growth-Stage — Indian Unicorns & High-Growth
  // ============================
  { name: 'Razorpay', careers_url: 'https://razorpay.com/jobs/', ats_provider: 'greenhouse', ats_identifier: 'razorpay', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Zerodha', careers_url: 'https://zerodha.com/careers', ats_provider: 'custom', ats_identifier: null, category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'CRED', careers_url: 'https://careers.cred.club/', ats_provider: 'lever', ats_identifier: 'cred', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Swiggy', careers_url: 'https://careers.swiggy.com/', ats_provider: 'custom', ats_identifier: null, category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Zomato', careers_url: 'https://www.zomato.com/careers', ats_provider: 'custom', ats_identifier: null, category: 'Growth', country: 'India', city: 'Gurugram', logo_url: null },
  { name: 'Postman', careers_url: 'https://www.postman.com/company/careers/', ats_provider: 'greenhouse', ats_identifier: 'postman', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Freshworks', careers_url: 'https://www.freshworks.com/company/careers/', ats_provider: 'greenhouse', ats_identifier: 'freshworks', category: 'Growth', country: 'India', city: 'Chennai', logo_url: null },
  { name: 'PhonePe', careers_url: 'https://www.phonepe.com/careers/', ats_provider: 'custom', ats_identifier: null, category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Groww', careers_url: 'https://groww.in/careers', ats_provider: 'lever', ats_identifier: 'groww', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Meesho', careers_url: 'https://meesho.io/careers', ats_provider: 'lever', ats_identifier: 'meesho', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Lenskart', careers_url: 'https://lenskart.com/careers', ats_provider: 'custom', ats_identifier: null, category: 'Growth', country: 'India', city: 'Delhi', logo_url: null },
  { name: 'Urban Company', careers_url: 'https://www.urbancompany.com/careers', ats_provider: 'lever', ats_identifier: 'urbancompany', category: 'Growth', country: 'India', city: 'Gurugram', logo_url: null },
  { name: 'BrowserStack', careers_url: 'https://www.browserstack.com/careers', ats_provider: 'greenhouse', ats_identifier: 'browserstack', category: 'Growth', country: 'India', city: 'Mumbai', logo_url: null },
  { name: 'Dream11', careers_url: 'https://www.dreamsports.group/careers', ats_provider: 'greenhouse', ats_identifier: 'dream11', category: 'Growth', country: 'India', city: 'Mumbai', logo_url: null },
  { name: 'ShareChat', careers_url: 'https://sharechat.com/careers', ats_provider: 'lever', ats_identifier: 'sharechat', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Jupiter', careers_url: 'https://jupiter.money/careers/', ats_provider: 'ashby', ats_identifier: 'jupiter', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Slice', careers_url: 'https://www.sliceit.com/careers', ats_provider: 'lever', ats_identifier: 'sliceit', category: 'Growth', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Notion', careers_url: 'https://www.notion.so/careers', ats_provider: 'greenhouse', ats_identifier: 'notion', category: 'Growth', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Figma', careers_url: 'https://www.figma.com/careers/', ats_provider: 'greenhouse', ats_identifier: 'figma', category: 'Growth', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Canva', careers_url: 'https://www.canva.com/careers/', ats_provider: 'greenhouse', ats_identifier: 'canva', category: 'Growth', country: 'India', city: 'Remote', logo_url: null },

  // ============================
  // Startups — YC / Remote-First / Early-Stage
  // ============================
  { name: 'Vercel', careers_url: 'https://vercel.com/careers', ats_provider: 'greenhouse', ats_identifier: 'vercel', category: 'Startup', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Supabase', careers_url: 'https://supabase.com/careers', ats_provider: 'ashby', ats_identifier: 'supabase', category: 'Startup', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Resend', careers_url: 'https://resend.com/jobs', ats_provider: 'ashby', ats_identifier: 'resend', category: 'Startup', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Linear', careers_url: 'https://linear.app/careers', ats_provider: 'ashby', ats_identifier: 'linear', category: 'Startup', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Dukaan', careers_url: 'https://mydukaan.io/careers', ats_provider: 'lever', ats_identifier: 'dukaan', category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Instahyre', careers_url: 'https://www.instahyre.com/careers/', ats_provider: 'custom', ats_identifier: null, category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Rocketlane', careers_url: 'https://rocketlane.com/careers', ats_provider: 'lever', ats_identifier: 'rocketlane', category: 'Startup', country: 'India', city: 'Chennai', logo_url: null },
  { name: 'Hasura', careers_url: 'https://hasura.io/careers', ats_provider: 'greenhouse', ats_identifier: 'hasura', category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Chargebee', careers_url: 'https://www.chargebee.com/company/careers/', ats_provider: 'greenhouse', ats_identifier: 'chargebee', category: 'Startup', country: 'India', city: 'Chennai', logo_url: null },
  { name: 'CleverTap', careers_url: 'https://clevertap.com/careers/', ats_provider: 'greenhouse', ats_identifier: 'clevertap', category: 'Startup', country: 'India', city: 'Mumbai', logo_url: null },
  { name: 'Sarvam AI', careers_url: 'https://www.sarvam.ai/careers', ats_provider: 'ashby', ats_identifier: 'sarvam', category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Krutrim', careers_url: 'https://olakrutrim.com/careers', ats_provider: 'custom', ats_identifier: null, category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Polygon', careers_url: 'https://polygon.technology/careers', ats_provider: 'greenhouse', ats_identifier: 'polygon-technology', category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Turing', careers_url: 'https://www.turing.com/careers', ats_provider: 'greenhouse', ats_identifier: 'turing', category: 'Startup', country: 'India', city: 'Remote', logo_url: null },
  { name: 'Navi', careers_url: 'https://navi.com/careers', ats_provider: 'lever', ats_identifier: 'navi', category: 'Startup', country: 'India', city: 'Bangalore', logo_url: null },
  { name: 'Coinbase', careers_url: 'https://www.coinbase.com/careers', ats_provider: 'greenhouse', ats_identifier: 'coinbase', category: 'Startup', country: 'India', city: 'Remote', logo_url: null },
];
