// Static option lists for the onboarding wizard.

export const TOP_CITIES: Record<string, string[]> = {
  India: [
    'Bangalore',
    'Mumbai',
    'Delhi',
    'Hyderabad',
    'Chennai',
    'Pune',
    'Kolkata',
    'Ahmedabad',
    'Gurugram',
    'Noida',
    'Chandigarh',
    'Jaipur',
    'Lucknow',
    'Indore',
    'Kochi',
    'Thiruvananthapuram',
    'Coimbatore',
    'Mysore',
    'Bhubaneswar',
    'Guwahati',
    'Nagpur',
    'Patna',
    'Bhopal',
    'Surat',
    'Visakhapatnam',
  ],
  USA: ['San Francisco', 'New York', 'Austin', 'Seattle', 'Chicago', 'Boston', 'Los Angeles'],
  UK: ['London', 'Manchester', 'Edinburgh', 'Cambridge', 'Bristol'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Waterloo', 'Calgary'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
  Singapore: ['Singapore'],
  UAE: ['Dubai', 'Abu Dhabi'],
};

export const REMOTE_REGIONS = [
  'Worldwide',
  'India',
  'USA',
  'UK',
  'Canada',
  'Australia',
  'New Zealand',
  'Germany',
  'Singapore',
  'UAE',
  'Europe',
  'Asia & Pacific',
  'Latin America',
];

export const FIELDS_OF_STUDY = [
  'Computer Science & IT',
  'Electrical & Electronics',
  'Mechanical & Civil',
  'Business & Management (BBA/MBA)',
  'Arts & Humanities',
  'Natural Sciences',
  'Other',
];

export const ROLES = [
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Fullstack Engineer',
  'AI / ML Engineer',
  'Data Scientist',
  'Product Manager',
  'UI / UX Designer',
  'DevOps / SRE',
  'QA / Test Engineer',
  'Security Engineer',
  'Other',
];

export const ORG_CULTURES = [
  { id: 'Garage', icon: '🚀', title: 'The Garage', desc: 'Early-Stage Startups' },
  { id: 'Rocketship', icon: '☄️', title: 'The Rocketship', desc: 'Hyper-Growth (Series B/C)' },
  { id: 'Establishment', icon: '🏢', title: 'The Establishment', desc: 'Mid-Size & Scale-ups' },
  { id: 'Titans', icon: '🏛️', title: 'The Titans', desc: 'MNCs & Fortune 500' },
  { id: 'DeepEnd', icon: '🔬', title: 'The Deep End', desc: 'Research & Deep Tech' },
];
