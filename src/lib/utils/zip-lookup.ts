// Zip code to city/state lookup
// Uses a free API for accurate lookups

export interface ZipLocation {
  city: string
  state: string
  stateAbbr: string
}

export async function lookupZip(zipCode: string): Promise<ZipLocation | null> {
  try {
    // Use zippopotam.us - free, no API key required
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const place = data.places?.[0]

    if (!place) {
      return null
    }

    return {
      city: place['place name'],
      state: place.state,
      stateAbbr: place['state abbreviation'],
    }
  } catch (error) {
    console.error('Zip lookup error:', error)
    return null
  }
}

// Fallback: Extract city from common patterns if API fails
export function extractCityFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    // Remove common prefixes/suffixes
    const cleaned = hostname
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|co|io)$/, '')
      .replace(/medspa|spa|aesthetic|beauty|skin/gi, '')
      .replace(/-/g, ' ')
      .trim()

    // If what's left looks like a city name (2+ chars, no numbers)
    if (cleaned.length >= 2 && !/\d/.test(cleaned)) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
    return null
  } catch {
    return null
  }
}
