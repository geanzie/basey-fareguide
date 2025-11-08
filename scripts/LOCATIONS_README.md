# Basey Location Data Collection

This script collects comprehensive location data for Basey, Samar municipality using multiple data sources.

## Features

- ✅ Extracts barangay data from existing GeoJSON file
- ✅ Searches Google Places API for locations (optional)
- ✅ Queries OpenStreetMap (Nominatim) for locations
- ✅ Validates against PSA official barangay list
- ✅ Adds known landmarks manually
- ✅ Exports organized JSON with all locations

## Data Sources

1. **GeoJSON** - Your existing barangay boundary data
2. **Google Places API** - Real-time location data (requires API key)
3. **OpenStreetMap** - Free geographic data
4. **PSA** - Philippine Statistics Authority official barangay list
5. **Manual** - Well-known landmarks added manually

## Installation

```powershell
# Install required Python package
pip install requests
```

## Usage

### Basic Usage (without Google API)
```powershell
cd frontend/scripts
python collect-basey-locations.py
```

### With Google Places API (Recommended)
```powershell
# Set your Google Maps API key
$env:GOOGLE_MAPS_API_KEY="YOUR_API_KEY_HERE"

# Run the script
cd frontend/scripts
python collect-basey-locations.py
```

## Output

The script generates `frontend/src/data/basey-locations.json` with the following structure:

```json
{
  "metadata": {
    "municipality": "Basey",
    "province": "Samar",
    "total_locations": 150,
    "last_updated": "2025-11-08 10:30:00",
    "sources": ["geojson", "google", "osm", "psa", "manual"]
  },
  "locations": {
    "barangay": [
      {
        "name": "Mercado",
        "coordinates": {"lat": 11.280369, "lng": 125.068942},
        "source": "geojson",
        "address": "Mercado, Basey, Samar",
        "verified": true
      }
    ],
    "landmark": [...],
    "poi": [...],
    "sitio": [...]
  }
}
```

## Location Types

- **barangay** - Official barangays (51 in Basey)
- **sitio** - Smaller subdivisions within barangays
- **landmark** - Notable places (churches, schools, markets, etc.)
- **poi** - Points of interest (other notable locations)

## Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Places API" and "Geocoding API"
4. Create credentials (API Key)
5. Restrict the key to your domains/IPs (recommended)

**Free Tier**: Google provides $200/month free credit
- ~100,000 basic requests per month free

## OpenStreetMap Usage

The script uses the free Nominatim API with proper rate limiting (1 request/second).
No API key required, but please respect their [usage policy](https://operations.osmfoundation.org/policies/nominatim/).

## Basey Barangays (PSA Official List)

The script validates against 51 official barangays:
- Amandayehan, Anglit, Bacubac, Balante, Balo-og, Balud, Basiao, Baybay
- Binungtu-an, Bulao, Buenavista, Burgos, Buscada, Cambayan, Can-Abay
- Can-Manila, Canca-iyas, Catadman, Cogon, Del Pilar, Dolongan, Guintigui-an
- Guirang, Iba, Inuntan, Lawa-an, Lo-og, Loyo, Mabini, Magallanes
- Manlilinab, May-it, Mercado, Mongabong, New San Agustin, Old San Agustin
- Palaypay, Panugmonon, Pelit, Roxas, Salvacion, San Antonio, San Fernando
- Sawa, Serum, Sogponon, Sugca, Sulod, Tinaogan, Tingib, Villa Aurora

## Troubleshooting

### Missing Barangays
If the script reports missing barangays, it means they're not in the GeoJSON and weren't found by external APIs. You can:
1. Enable Google Places API for better coverage
2. Manually add coordinates to the script
3. Check the barangay name spelling

### Rate Limiting
- Google: No rate limit with API key (within quota)
- OSM: 1 request per second (enforced by script)

### API Errors
- Check your API key is correct
- Ensure billing is enabled on Google Cloud
- Verify API services are enabled

## Next Steps

After running this script, you can:
1. Use the generated JSON in your fare calculator
2. Create a searchable location dropdown
3. Add autocomplete functionality
4. Display locations on a map
5. Calculate distances between locations

## License

Part of the Basey Fare Guide project.
