// ============================
// RADAR — Company & source seed data
// ============================
// Every scraped entry below was checked against its live endpoint on 2026-09-11.
// `custom` = no public feed we can use yet; the company stays selectable as a dream company
// but is not scraped. To add a company, find its ATS token (see adapters.ts for formats).

import type { CompanyCategory, Provider } from '@/types';

export type SeedProvider = Provider;

export interface CompanySeed {
  name: string;
  careers_url: string;
  ats_provider: SeedProvider;
  ats_identifier: string | null;
  category: CompanyCategory;
  country: string;
  city: string | null;
  logo_url: string | null;
}

const c = (
  name: string,
  careers_url: string,
  ats_provider: SeedProvider,
  ats_identifier: string | null,
  category: CompanySeed['category'],
  city: string | null,
  country = 'India',
): CompanySeed => ({ name, careers_url, ats_provider, ats_identifier, category, country, city, logo_url: null });

export const COMPANY_SEEDS: CompanySeed[] = [
  // ---------- MNC ----------
  c('Amazon', 'https://www.amazon.jobs/', 'amazon', 'IND', 'MNC', 'Bangalore'),
  c('Stripe', 'https://stripe.com/jobs', 'greenhouse', 'stripe', 'MNC', 'Bangalore'),
  c(
    'Salesforce',
    'https://careers.salesforce.com/',
    'workday',
    'salesforce/wd12/External_Career_Site',
    'MNC',
    'Hyderabad',
  ),
  c('Adobe', 'https://www.adobe.com/careers.html', 'workday', 'adobe/wd5/external_experienced', 'MNC', 'Noida'),
  c(
    'Cadence',
    'https://www.cadence.com/en_US/home/company/careers.html',
    'workday',
    'cadence/wd1/External_Careers',
    'MNC',
    'Bangalore',
  ),
  c(
    'NVIDIA',
    'https://www.nvidia.com/en-us/about-nvidia/careers/',
    'workday',
    'nvidia/wd5/NVIDIAExternalCareerSite',
    'MNC',
    'Bangalore',
  ),
  c('Intel', 'https://jobs.intel.com/', 'workday', 'intel/wd1/External', 'MNC', 'Bangalore'),
  c('Cisco', 'https://jobs.cisco.com/', 'workday', 'cisco/wd5/Cisco_Careers', 'MNC', 'Bangalore'),
  c('PayPal', 'https://careers.pypl.com/', 'workday', 'paypal/wd1/jobs', 'MNC', 'Chennai'),
  c('Mastercard', 'https://careers.mastercard.com/', 'workday', 'mastercard/wd1/CorporateCareers', 'MNC', 'Pune'),
  c('ServiceNow', 'https://careers.servicenow.com/', 'smartrecruiters', 'ServiceNow', 'MNC', 'Hyderabad'),
  c('Canva', 'https://www.canva.com/careers/', 'smartrecruiters', 'canva', 'MNC', 'Remote'),
  c('Google', 'https://www.google.com/about/careers/', 'custom', null, 'MNC', 'Bangalore'),
  c('Microsoft', 'https://careers.microsoft.com/', 'custom', null, 'MNC', 'Hyderabad'),
  c('Meta', 'https://www.metacareers.com/', 'custom', null, 'MNC', 'Gurugram'),
  c('Apple', 'https://jobs.apple.com/', 'custom', null, 'MNC', 'Hyderabad'),
  c(
    'Netflix',
    'https://explore.jobs.netflix.net/careers',
    'eightfold',
    'explore.jobs.netflix.net|netflix.com',
    'MNC',
    'Mumbai',
  ),
  c('Uber', 'https://www.uber.com/careers/', 'custom', null, 'MNC', 'Bangalore'),
  c('Oracle', 'https://www.oracle.com/careers/', 'custom', null, 'MNC', 'Bangalore'),
  c('Goldman Sachs', 'https://www.goldmansachs.com/careers/', 'custom', null, 'MNC', 'Bangalore'),
  c('JPMorgan Chase', 'https://careers.jpmorgan.com/', 'custom', null, 'MNC', 'Mumbai'),
  c('Atlassian', 'https://www.atlassian.com/company/careers', 'custom', null, 'MNC', 'Bangalore'),
  c('Spotify', 'https://www.lifeatspotify.com/', 'lever', 'spotify', 'MNC', 'Mumbai'),

  // ---------- Growth ----------
  c('Razorpay', 'https://razorpay.com/jobs/', 'greenhouse', 'razorpaysoftwareprivatelimited', 'Growth', 'Bangalore'),
  c('CRED', 'https://careers.cred.club/', 'lever', 'cred', 'Growth', 'Bangalore'),
  // Moved from Greenhouse to Workable (checked 2026-09-26).
  c('Postman', 'https://apply.workable.com/postman/', 'workable', 'postman', 'Growth', 'Bangalore'),
  c('Freshworks', 'https://www.freshworks.com/company/careers/', 'smartrecruiters', 'Freshworks', 'Growth', 'Chennai'),
  c('Groww', 'https://groww.in/careers', 'greenhouse', 'groww', 'Growth', 'Bangalore'),
  c('Meesho', 'https://meesho.io/careers', 'lever', 'meesho', 'Growth', 'Bangalore'),
  c('BrowserStack', 'https://www.browserstack.com/careers', 'workday', 'browserstack/wd3/External', 'Growth', 'Mumbai'),
  c('Notion', 'https://www.notion.so/careers', 'ashby', 'notion', 'Growth', 'Remote'),
  c('Figma', 'https://www.figma.com/careers/', 'greenhouse', 'figma', 'Growth', 'Remote'),
  c('Zerodha', 'https://zerodha.com/careers', 'custom', null, 'Growth', 'Bangalore'),
  c('Swiggy', 'https://careers.swiggy.com/', 'smartrecruiters', 'swiggy', 'Growth', 'Bangalore'),
  c('Zomato', 'https://www.zomato.com/careers', 'custom', null, 'Growth', 'Gurugram'),
  c('PhonePe', 'https://www.phonepe.com/careers/', 'smartrecruiters', 'PhonePeLimited', 'Growth', 'Bangalore'),
  c('InMobi', 'https://www.inmobi.com/company/careers', 'greenhouse', 'inmobi', 'Growth', 'Bangalore'),
  c('Lenskart', 'https://lenskart.com/careers', 'custom', null, 'Growth', 'Delhi'),
  c('Urban Company', 'https://www.urbancompany.com/careers', 'custom', null, 'Growth', 'Gurugram'),
  c('Dream11', 'https://www.dreamsports.group/careers', 'custom', null, 'Growth', 'Mumbai'),
  c('ShareChat', 'https://sharechat.com/careers', 'custom', null, 'Growth', 'Bangalore'),
  c('Jupiter', 'https://jupiter.money/careers/', 'custom', null, 'Growth', 'Bangalore'),
  c('Slice', 'https://www.sliceit.com/careers', 'custom', null, 'Growth', 'Bangalore'),

  // ---------- Startups ----------
  c('Vercel', 'https://vercel.com/careers', 'greenhouse', 'vercel', 'Startup', 'Remote'),
  c('Supabase', 'https://supabase.com/careers', 'ashby', 'supabase', 'Startup', 'Remote'),
  c('Resend', 'https://resend.com/jobs', 'ashby', 'resend', 'Startup', 'Remote'),
  c('Linear', 'https://linear.app/careers', 'ashby', 'linear', 'Startup', 'Remote'),
  c('Sarvam AI', 'https://www.sarvam.ai/careers', 'ashby', 'sarvam', 'Startup', 'Bangalore'),
  c('Turing', 'https://www.turing.com/careers', 'greenhouse', 'turing', 'Startup', 'Remote'),
  c('Coinbase', 'https://www.coinbase.com/careers', 'greenhouse', 'coinbase', 'Startup', 'Remote'),
  c('Dukaan', 'https://mydukaan.io/careers', 'custom', null, 'Startup', 'Bangalore'),
  c('Instahyre', 'https://www.instahyre.com/careers/', 'custom', null, 'Startup', 'Bangalore'),
  c('Rocketlane', 'https://rocketlane.com/careers', 'custom', null, 'Startup', 'Chennai'),
  c('Hasura', 'https://hasura.io/careers', 'custom', null, 'Startup', 'Bangalore'),
  c('Chargebee', 'https://www.chargebee.com/company/careers/', 'custom', null, 'Startup', 'Chennai'),
  c('CleverTap', 'https://clevertap.com/careers/', 'custom', null, 'Startup', 'Mumbai'),
  c('Krutrim', 'https://olakrutrim.com/careers', 'custom', null, 'Startup', 'Bangalore'),
  c('Polygon', 'https://polygon.technology/careers', 'ashby', 'polygon-labs', 'Startup', 'Bangalore'),
  c('Fi Money', 'https://fi.money/careers', 'lever', 'epifi', 'Startup', 'Bangalore'),
  c('Navi', 'https://navi.com/careers', 'custom', null, 'Startup', 'Bangalore'),

  // ---------- Europe & global: companies hiring through Welcome to the Jungle, read at their own ATS ----------
  // Checked live on 2026-09-26 (open jobs, and sample postings confirming the owner).
  c('Datadog', 'https://job-boards.greenhouse.io/datadog', 'greenhouse', 'datadog', 'MNC', 'New York', 'USA'),
  c('Adyen', 'https://job-boards.greenhouse.io/adyen', 'greenhouse', 'adyen', 'MNC', 'Amsterdam', 'Netherlands'),
  c('Wise', 'https://jobs.smartrecruiters.com/wise', 'smartrecruiters', 'wise', 'MNC', 'London', 'United Kingdom'),
  c('Celonis', 'https://job-boards.greenhouse.io/celonis', 'greenhouse', 'celonis', 'Growth', 'Munich', 'Germany'),
  c('Doctolib', 'https://job-boards.greenhouse.io/doctolib', 'greenhouse', 'doctolib', 'Growth', 'Paris', 'France'),
  c('N26', 'https://job-boards.greenhouse.io/n26', 'greenhouse', 'n26', 'Growth', 'Berlin', 'Germany'),
  c(
    'Miro',
    'https://job-boards.greenhouse.io/realtimeboardglobal',
    'greenhouse',
    'realtimeboardglobal',
    'Growth',
    'Amsterdam',
    'Netherlands',
  ),
  c('Qonto', 'https://jobs.lever.co/qonto', 'lever', 'qonto', 'Growth', 'Paris', 'France'),
  c('Alan', 'https://jobs.ashbyhq.com/alan', 'ashby', 'alan', 'Growth', 'Paris', 'France'),
  c('BlaBlaCar', 'https://jobs.lever.co/blablacar', 'lever', 'blablacar', 'Growth', 'Paris', 'France'),
  c('Back Market', 'https://jobs.ashbyhq.com/backmarket', 'ashby', 'backmarket', 'Growth', 'Paris', 'France'),
  c('Contentsquare', 'https://jobs.lever.co/contentsquare', 'lever', 'contentsquare', 'Growth', 'Paris', 'France'),
  c('Mirakl', 'https://job-boards.greenhouse.io/mirakl', 'greenhouse', 'mirakl', 'Growth', 'Paris', 'France'),
  c('Algolia', 'https://job-boards.greenhouse.io/algolia', 'greenhouse', 'algolia', 'Growth', 'Paris', 'France'),
  c('Dataiku', 'https://job-boards.greenhouse.io/dataiku', 'greenhouse', 'dataiku', 'Growth', 'Paris', 'France'),
  c('Aircall', 'https://jobs.lever.co/aircall', 'lever', 'aircall', 'Growth', 'Paris', 'France'),
  c('Pennylane', 'https://jobs.ashbyhq.com/pennylane', 'ashby', 'pennylane', 'Growth', 'Paris', 'France'),
  c('Ledger', 'https://jobs.ashbyhq.com/ledger', 'ashby', 'ledger', 'Growth', 'Paris', 'France'),
  c('Malt', 'https://jobs.lever.co/malt', 'lever', 'malt', 'Growth', 'Paris', 'France'),
  c('Pigment', 'https://jobs.lever.co/pigment', 'lever', 'pigment', 'Growth', 'Paris', 'France'),
  c('Hugging Face', 'https://apply.workable.com/huggingface/', 'workable', 'huggingface', 'Growth', 'Paris', 'France'),
  c('DeepL', 'https://jobs.ashbyhq.com/deepl', 'ashby', 'deepl', 'Growth', 'Cologne', 'Germany'),
  c(
    'GetYourGuide',
    'https://job-boards.greenhouse.io/getyourguide',
    'greenhouse',
    'getyourguide',
    'Growth',
    'Berlin',
    'Germany',
  ),
  c(
    'Contentful',
    'https://job-boards.greenhouse.io/contentful',
    'greenhouse',
    'contentful',
    'Growth',
    'Berlin',
    'Germany',
  ),
  c('Photoroom', 'https://jobs.ashbyhq.com/photoroom', 'ashby', 'photoroom', 'Startup', 'Paris', 'France'),

  // ---------- Job boards (many employers each) ----------
  c(
    'Hacker News: Who is hiring',
    'https://news.ycombinator.com/submitted?id=whoishiring',
    'hackernews',
    null,
    'Startup',
    'Remote',
    'Global',
  ),
  c('Remotive', 'https://remotive.com/', 'remotive', null, 'Board', 'Remote', 'Global'),
  c('Remote OK', 'https://remoteok.com/', 'remoteok', null, 'Board', 'Remote', 'Global'),
  c('Arbeitnow', 'https://www.arbeitnow.com/', 'arbeitnow', null, 'Board', 'Remote', 'Europe'),
  c('Himalayas', 'https://himalayas.app/', 'himalayas', null, 'Board', 'Remote', 'Global'),
  c('Jobicy', 'https://jobicy.com/', 'jobicy', null, 'Board', 'Remote', 'Global'),
  c('The Muse', 'https://www.themuse.com/', 'themuse', null, 'Board', null, 'Global'),
  c('Adzuna', 'https://www.adzuna.com/', 'adzuna', null, 'Board', null, 'Global'),
  c('Jooble', 'https://jooble.org/', 'jooble', null, 'Board', null, 'Global'),
  c('We Work Remotely', 'https://weworkremotely.com/', 'weworkremotely', null, 'Board', 'Remote', 'Global'),
  c('Working Nomads', 'https://www.workingnomads.com/', 'workingnomads', null, 'Board', 'Remote', 'Global'),
];
