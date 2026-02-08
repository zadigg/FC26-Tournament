/**
 * Reverse geocode coordinates to get city name
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Use Nominatim reverse geocoding API
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FC26-Tournament-App', // Required by Nominatim
      },
    })

    if (!response.ok) {
      console.error('Reverse geocoding failed:', response.statusText)
      return null
    }

    const data = await response.json()
    
    // Extract city name from address components
    const address = data.address || {}
    
    // Try different possible city name fields (varies by location)
    const cityName = 
      address.city || 
      address.town || 
      address.village || 
      address.municipality ||
      address.county ||
      address.state ||
      address.country ||
      null

    return cityName
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}
