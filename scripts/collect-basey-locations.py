"""
Comprehensive Location Data Collector for Basey, Samar
Uses Google Maps API, OpenStreetMap, and PSA data to gather all known locations
"""

import json
import time
import requests  # type: ignore
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, asdict
import os

@dataclass
class Location:
    name: str
    type: str  # barangay, sitio, landmark, poi
    lat: float
    lng: float
    source: str  # google, osm, geojson, psa
    address: str = ""
    place_id: str = ""
    verified: bool = False

class BaseyLocationCollector:
    def __init__(self, google_api_key: Optional[str] = None):
        self.google_api_key = google_api_key
        self.locations: Dict[str, Location] = {}
        self.basey_center = (11.2792, 125.0650)
        self.search_radius = 15000  # 15km
        
        # Official PSA Barangay List for Basey, Samar (from 2020 Census)
        self.psa_barangays = [
            "Amandayehan", "Anglit", "Bacubac", "Balante", "Balo-og", "Balud",
            "Baybay", "Binungtu-an", "Bulao", "Buenavista", "Burgos", "Buscada",
            "Cambayan", "Can-Abay", "Can-Manila", "Canca-iyas", "Catadman",
            "Cogon", "Del Pilar", "Dolongan", "Guintigui-an", "Guirang",
            "Iba", "Inuntan", "Lawa-an", "Lo-og", "Loyo", "Mabini",
            "Magallanes", "Manlilinab", "May-it", "Mercado", "Mongabong",
            "New San Agustin", "Old San Agustin", "Palaypay", "Panugmonon",
            "Pelit", "Roxas", "Salvacion", "San Antonio", "San Fernando",
            "Sawa", "Serum", "Sogponon", "Sugca", "Sulod", "Tinaogan",
            "Tingib", "Villa Aurora", "Basiao"
        ]
        
    def load_existing_geojson(self, filepath: str):
        """Load locations from existing GeoJSON file"""
        print("Loading existing GeoJSON data...")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            for feature in data.get('features', []):
                props = feature.get('properties', {})
                geom = feature.get('geometry', {})
                
                geom_type = geom.get('type')
                if (geom_type == 'Polygon' or geom_type == 'MultiPolygon') and props.get('BARANGAY'):
                    # Calculate centroid from polygon coordinates
                    coords = []
                    if geom_type == 'Polygon':
                        coords = geom.get('coordinates', [])[0]
                    elif geom_type == 'MultiPolygon':
                        # For MultiPolygon, get the first polygon's outer ring
                        multi_coords = geom.get('coordinates', [])
                        if multi_coords and len(multi_coords) > 0:
                            coords = multi_coords[0][0]
                    
                    if coords:
                        lats = [c[1] for c in coords]
                        lngs = [c[0] for c in coords]
                        centroid_lat = sum(lats) / len(lats)
                        centroid_lng = sum(lngs) / len(lngs)
                        
                        name = props['BARANGAY'].title()
                        key = self._normalize_name(name)
                        
                        if key not in self.locations:
                            self.locations[key] = Location(
                                name=name,
                                type='barangay',
                                lat=centroid_lat,
                                lng=centroid_lng,
                                source='geojson',
                                address=f"{name}, Basey, Samar",
                                verified=True
                            )
            print(f"Loaded {len(self.locations)} locations from GeoJSON")
        except Exception as e:
            print(f"Error loading GeoJSON: {e}")
    
    def _normalize_name(self, name: str) -> str:
        """Normalize location name for comparison"""
        return name.lower().strip().replace('-', '').replace(' ', '')
    
    def search_google_places(self):
        """Search Google Places API for locations in Basey"""
        if not self.google_api_key:
            print("⚠️  Google API key not provided, skipping Google search")
            return
            
        print("\n🔍 Searching Google Places API...")
        
        # Expanded search types - focus on sitios and landmarks
        search_queries = [
            "sitio in Basey Samar Philippines",
            "purok in Basey Samar Philippines",
            "zone in Basey Samar Philippines",
            "church in Basey Samar Philippines",
            "chapel in Basey Samar Philippines",
            "school in Basey Samar Philippines",
            "elementary school Basey Samar",
            "high school Basey Samar",
            "hospital Basey Samar Philippines",
            "health center Basey Samar",
            "clinic Basey Samar",
            "barangay hall Basey Samar",
            "plaza Basey Samar Philippines",
            "park Basey Samar Philippines",
            "cave Basey Samar Philippines",
            "falls Basey Samar Philippines",
            "waterfall Basey Samar",
            "beach Basey Samar Philippines",
            "resort Basey Samar Philippines",
            "restaurant Basey Samar",
            "hotel Basey Samar Philippines",
            "lodging Basey Samar",
            "gas station Basey Samar",
            "terminal Basey Samar Philippines",
            "port Basey Samar Philippines",
            "wharf Basey Samar",
            "cemetery Basey Samar Philippines",
            "museum Basey Samar",
            "tourist spot Basey Samar",
            "sports complex Basey Samar",
            "gymnasium Basey Samar",
            "basketball court Basey Samar",
            "barangay Basey Samar"
        ]
        
        for query in search_queries:
            try:
                url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
                params = {
                    'query': query,
                    'key': self.google_api_key,
                    'region': 'ph'
                }
                
                response = requests.get(url, params=params)
                data = response.json()
                
                if data.get('status') == 'OK':
                    for result in data.get('results', []):
                        self._add_location_from_google(result)
                
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                print(f"Error searching Google for '{query}': {e}")
    
    def _add_location_from_google(self, result: dict):
        """Add a location from Google Places result"""
        name = result.get('name', '')
        location = result.get('geometry', {}).get('location', {})
        
        if not name or not location:
            return
            
        # Check if it's within Basey area
        if not self._is_within_basey(location['lat'], location['lng']):
            return
        
        key = self._normalize_name(name)
        
        # Determine type
        types = result.get('types', [])
        location_type = self._determine_type(types, name)
        
        if key not in self.locations:
            self.locations[key] = Location(
                name=name,
                type=location_type,
                lat=location['lat'],
                lng=location['lng'],
                source='google',
                address=result.get('formatted_address', ''),
                place_id=result.get('place_id', ''),
                verified=True
            )
            print(f"  ✓ Added: {name} ({location_type})")
    
    def search_openstreetmap(self):
        """Search OpenStreetMap via Nominatim for locations"""
        print("\n🗺️  Searching OpenStreetMap...")
        
        search_queries = [
            "Basey, Samar, Philippines barangay",
            "Basey, Samar, Philippines village",
            "Basey, Samar, Philippines hamlet",
            "Basey, Samar, Philippines landmark",
        ]
        
        for query in search_queries:
            try:
                url = "https://nominatim.openstreetmap.org/search"
                params = {
                    'q': query,
                    'format': 'json',
                    'limit': 50,
                    'countrycodes': 'ph',
                    'addressdetails': 1
                }
                
                headers = {
                    'User-Agent': 'BaseyFareGuide/1.0'
                }
                
                response = requests.get(url, params=params, headers=headers)
                data = response.json()
                
                for result in data:
                    self._add_location_from_osm(result)
                
                time.sleep(1)  # OSM requires rate limiting
                
            except Exception as e:
                print(f"Error searching OSM for '{query}': {e}")
    
    def _add_location_from_osm(self, result: dict):
        """Add a location from OpenStreetMap result"""
        name = result.get('display_name', '').split(',')[0]
        lat = float(result.get('lat', 0))
        lng = float(result.get('lon', 0))
        
        if not name or not self._is_within_basey(lat, lng):
            return
        
        key = self._normalize_name(name)
        
        # Only add if not already exists from more reliable source
        if key not in self.locations:
            osm_type = result.get('type', '')
            location_type = 'landmark' if osm_type in ['building', 'amenity'] else 'barangay'
            
            self.locations[key] = Location(
                name=name,
                type=location_type,
                lat=lat,
                lng=lng,
                source='osm',
                address=result.get('display_name', ''),
                verified=True
            )
            print(f"  ✓ Added: {name} ({location_type})")
    
    def verify_psa_barangays(self):
        """Ensure all PSA official barangays are in the collection"""
        print("\n📋 Verifying PSA Official Barangays...")
        
        missing = []
        for barangay in self.psa_barangays:
            key = self._normalize_name(barangay)
            if key not in self.locations:
                missing.append(barangay)
                print(f"  ⚠️  Missing: {barangay}")
        
        if not missing:
            print("  ✓ All PSA barangays are present!")
        else:
            print(f"\n  Found {len(missing)} missing barangays")
            print("  These need to be geocoded manually or with additional API calls")
        
        return missing
    
    def _is_within_basey(self, lat: float, lng: float) -> bool:
        """Check if coordinates are within Basey municipality"""
        # Rough bounding box for Basey
        lat_min, lat_max = 11.2, 11.6
        lng_min, lng_max = 124.9, 125.4
        
        return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max
    
    def _determine_type(self, types: List[str], name: str) -> str:
        """Determine location type from Google Place types"""
        name_lower = name.lower()
        
        # Check name first
        if 'barangay' in name_lower or 'brgy' in name_lower:
            return 'barangay'
        if 'sitio' in name_lower or 'purok' in name_lower or 'zone' in name_lower:
            return 'sitio'
        
        # Check Google types for landmarks
        landmark_types = [
            'church', 'place_of_worship', 'school', 'hospital', 'health',
            'town_hall', 'local_government_office', 'city_hall',
            'tourist_attraction', 'park', 'natural_feature', 'museum',
            'cemetery', 'stadium', 'point_of_interest', 'establishment',
            'lodging', 'restaurant', 'store', 'gas_station'
        ]
        
        if any(t in types for t in landmark_types):
            return 'landmark'
        
        # Locality types might be barangays
        if 'locality' in types or 'sublocality' in types or 'neighborhood' in types:
            return 'barangay'
        
        return 'poi'
    
    def add_known_landmarks(self):
        """Add well-known Basey landmarks manually"""
        print("\n🏛️  Adding known Basey landmarks...")
        
        landmarks = [
            {"name": "Basey Church (San Miguel Archangel Parish)", "lat": 11.2792, "lng": 125.0650, "type": "landmark"},
            {"name": "Basey Municipal Hall", "lat": 11.2795, "lng": 125.0653, "type": "landmark"},
            {"name": "Basey Public Market", "lat": 11.2790, "lng": 125.0645, "type": "landmark"},
            {"name": "Sohoton National Park", "lat": 11.4167, "lng": 125.1167, "type": "landmark"},
            {"name": "Sohoton Cave", "lat": 11.4200, "lng": 125.1200, "type": "landmark"},
            {"name": "Basey Bridge", "lat": 11.2798, "lng": 125.0660, "type": "landmark"},
        ]
        
        for landmark in landmarks:
            key = self._normalize_name(landmark['name'])
            if key not in self.locations:
                self.locations[key] = Location(
                    name=landmark['name'],
                    type=landmark['type'],
                    lat=landmark['lat'],
                    lng=landmark['lng'],
                    source='manual',
                    address=f"{landmark['name']}, Basey, Samar",
                    verified=True
                )
                print(f"  ✓ Added: {landmark['name']}")
    
    def export_to_json(self, output_file: str):
        """Export collected locations to JSON file"""
        print(f"\n💾 Exporting to {output_file}...")
        
        # Convert to dict and organize by type
        organized = {
            'metadata': {
                'municipality': 'Basey',
                'province': 'Samar',
                'total_locations': len(self.locations),
                'last_updated': time.strftime('%Y-%m-%d %H:%M:%S'),
                'sources': ['geojson', 'google', 'osm', 'psa', 'manual']
            },
            'locations': {}
        }
        
        for key, loc in self.locations.items():
            if loc.type not in organized['locations']:
                organized['locations'][loc.type] = []
            
            organized['locations'][loc.type].append({
                'name': loc.name,
                'coordinates': {
                    'lat': round(loc.lat, 6),
                    'lng': round(loc.lng, 6)
                },
                'source': loc.source,
                'address': loc.address,
                'verified': loc.verified
            })
        
        # Sort each type by name
        for loc_type in organized['locations']:
            organized['locations'][loc_type].sort(key=lambda x: x['name'])
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(organized, f, indent=2, ensure_ascii=False)
        
        # Print summary
        print("\n📊 Collection Summary:")
        print(f"  Total Locations: {len(self.locations)}")
        for loc_type in organized['locations']:
            count = len(organized['locations'][loc_type])
            print(f"  {loc_type.title()}s: {count}")
        
        print(f"\n✅ Successfully exported to {output_file}")

def main():
    # Check for Google API key
    google_api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
    
    if not google_api_key:
        print("⚠️  No Google Maps API key found in environment variable GOOGLE_MAPS_API_KEY")
        print("   The script will still work with GeoJSON, OSM, and manual data")
        print("   To enable Google Places search, set the API key:")
        print("   $env:GOOGLE_MAPS_API_KEY='your-api-key-here'\n")
    
    collector = BaseyLocationCollector(google_api_key)
    
    # Load existing locations from JSON to skip them
    output_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'basey-locations.json')
    existing_locations = set()
    
    try:
        with open(output_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
            for loc_type in existing_data.get('locations', {}).values():
                for loc in loc_type:
                    existing_locations.add(collector._normalize_name(loc['name']))
            print(f"📋 Found {len(existing_locations)} existing locations to skip")
    except FileNotFoundError:
        print("📋 No existing locations file found, will collect all locations")
    
    # Store existing count to track new additions
    initial_count = len(collector.locations)
    
    # Load GeoJSON data (but only add if not in existing)
    geojson_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'Barangay.shp.json')
    collector.load_existing_geojson(geojson_path)
    
    # Search external sources for NEW locations only
    print("\n🔍 Searching for NEW sitios and landmarks...")
    if google_api_key:
        collector.search_google_places()
    
    collector.search_openstreetmap()
    
    # Filter out existing locations
    new_locations = {}
    for key, loc in collector.locations.items():
        if key not in existing_locations:
            new_locations[key] = loc
    
    print(f"\n✨ Found {len(new_locations)} NEW locations!")
    
    # Show new locations by type
    if new_locations:
        print("\n📍 New Locations Found:")
        by_type = {}
        for loc in new_locations.values():
            by_type.setdefault(loc.type, []).append(loc.name)
        
        for loc_type, names in sorted(by_type.items()):
            print(f"\n  {loc_type.upper()}s ({len(names)}):")
            for name in sorted(names):
                print(f"    • {name}")
        
        # Ask user if they want to add these to the file
        print(f"\n💾 Ready to add {len(new_locations)} new locations to {output_path}")
        
        # Merge with existing data
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except FileNotFoundError:
            existing_data = {
                'metadata': {
                    'municipality': 'Basey',
                    'province': 'Samar',
                    'total_locations': 0,
                    'sources': []
                },
                'locations': {}
            }
        
        # Add new locations to existing data
        for loc in new_locations.values():
            loc_type = loc.type
            if loc_type not in existing_data['locations']:
                existing_data['locations'][loc_type] = []
            
            existing_data['locations'][loc_type].append({
                'name': loc.name,
                'type': loc.type,
                'coordinates': {
                    'lat': loc.lat,
                    'lng': loc.lng
                },
                'source': loc.source,
                'address': loc.address,
                'verified': loc.verified
            })
        
        # Update metadata
        total = sum(len(locs) for locs in existing_data['locations'].values())
        existing_data['metadata']['total_locations'] = total
        existing_data['metadata']['last_updated'] = time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Sort locations within each type
        for loc_type in existing_data['locations']:
            existing_data['locations'][loc_type].sort(key=lambda x: x['name'])
        
        # Save updated file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Successfully added new locations! Total now: {total}")
    else:
        print("\n✅ No new locations found - your database is already complete!")

if __name__ == '__main__':
    main()
