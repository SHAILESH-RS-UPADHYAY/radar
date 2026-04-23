// ============================
// RADAR — Haversine Distance Calculator
// ============================
// Calculates straight-line distance between two geographic points
// Used for location-based sorting (nearest jobs first)
// Zero API cost — pure math

/**
 * Calculate distance between two lat/lng points in kilometers
 * Uses the Haversine formula for accuracy on a sphere
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ============================
// Indian Cities Database (No API needed)
// ============================
export const INDIAN_CITIES: Record<string, { lat: number; lng: number; state: string }> = {
  'Mumbai': { lat: 19.076, lng: 72.8777, state: 'Maharashtra' },
  'Delhi': { lat: 28.7041, lng: 77.1025, state: 'Delhi' },
  'Bangalore': { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  'Hyderabad': { lat: 17.385, lng: 78.4867, state: 'Telangana' },
  'Chennai': { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  'Kolkata': { lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  'Pune': { lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714, state: 'Gujarat' },
  'Gurugram': { lat: 28.4595, lng: 77.0266, state: 'Haryana' },
  'Noida': { lat: 28.5355, lng: 77.391, state: 'Uttar Pradesh' },
  'Chandigarh': { lat: 30.7333, lng: 76.7794, state: 'Chandigarh' },
  'Jaipur': { lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  'Lucknow': { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  'Indore': { lat: 22.7196, lng: 75.8577, state: 'Madhya Pradesh' },
  'Kochi': { lat: 9.9312, lng: 76.2673, state: 'Kerala' },
  'Coimbatore': { lat: 11.0168, lng: 76.9558, state: 'Tamil Nadu' },
  'Thiruvananthapuram': { lat: 8.5241, lng: 76.9366, state: 'Kerala' },
  'Nagpur': { lat: 21.1458, lng: 79.0882, state: 'Maharashtra' },
  'Visakhapatnam': { lat: 17.6868, lng: 83.2185, state: 'Andhra Pradesh' },
  'Bhopal': { lat: 23.2599, lng: 77.4126, state: 'Madhya Pradesh' },
  'Mohali': { lat: 30.7046, lng: 76.7179, state: 'Punjab' },
  'Mysuru': { lat: 12.2958, lng: 76.6394, state: 'Karnataka' },
  'Surat': { lat: 21.1702, lng: 72.8311, state: 'Gujarat' },
  'Vadodara': { lat: 22.3072, lng: 73.1812, state: 'Gujarat' },
  'Mangalore': { lat: 12.9141, lng: 74.856, state: 'Karnataka' },
  'Remote': { lat: 0, lng: 0, state: 'Remote' },
};

/**
 * Get coordinates for a city name (fuzzy match)
 */
export function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const normalized = cityName.trim();
  // Direct match
  if (INDIAN_CITIES[normalized]) return INDIAN_CITIES[normalized];
  // Case-insensitive search
  const found = Object.entries(INDIAN_CITIES).find(
    ([name]) => name.toLowerCase() === normalized.toLowerCase()
  );
  if (found) return found[1];
  // Partial match
  const partial = Object.entries(INDIAN_CITIES).find(
    ([name]) => name.toLowerCase().includes(normalized.toLowerCase()) ||
                normalized.toLowerCase().includes(name.toLowerCase())
  );
  return partial ? partial[1] : null;
}
