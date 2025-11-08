"""
Find NEW sitios and landmarks using OpenStreetMap (no API key needed)
"""

import json
import time
import requests
import os

# Load existing locations
output_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'basey-locations.json')
existing_names = set()

with open(output_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    for loc_type in data.get('locations', {}).values():
        for loc in loc_type:
            existing_names.add(loc['name'].lower().strip())

print(f"📋 Loaded {len(existing_names)} existing locations to skip\n")

# OpenStreetMap Nominatim queries
queries = [
    # Subdivisions - EXPANDED
    ("sitio", "Basey, Samar"),
    ("purok", "Basey, Samar"),
    ("hamlet", "Basey, Samar"),
    ("village", "Basey, Samar"),
    ("neighbourhood", "Basey, Samar"),
    ("zone", "Basey, Samar"),
    
    # Religious - EXPANDED
    ("church", "Basey, Samar"),
    ("chapel", "Basey, Samar"),
    ("cathedral", "Basey, Samar"),
    ("shrine", "Basey, Samar"),
    
    # Education - EXPANDED
    ("school", "Basey, Samar"),
    ("elementary school", "Basey, Samar"),
    ("high school", "Basey, Samar"),
    ("daycare", "Basey, Samar"),
    ("college", "Basey, Samar"),
    
    # Health - EXPANDED
    ("clinic", "Basey, Samar"),
    ("hospital", "Basey, Samar"),
    ("health center", "Basey, Samar"),
    ("pharmacy", "Basey, Samar"),
    
    # Government - EXPANDED
    ("town_hall", "Basey, Samar"),
    ("government", "Basey, Samar"),
    ("barangay hall", "Basey, Samar"),
    ("police station", "Basey, Samar"),
    ("fire station", "Basey, Samar"),
    
    # Tourism - EXPANDED
    ("cave", "Basey, Samar"),
    ("waterfall", "Basey, Samar"),
    ("beach", "Basey, Samar"),
    ("resort", "Basey, Samar"),
    ("attraction", "Basey, Samar"),
    ("park", "Basey, Samar"),
    ("viewpoint", "Basey, Samar"),
    ("hot spring", "Basey, Samar"),
    
    # Infrastructure - EXPANDED
    ("market", "Basey, Samar"),
    ("terminal", "Basey, Samar"),
    ("port", "Basey, Samar"),
    ("wharf", "Basey, Samar"),
    ("bridge", "Basey, Samar"),
    ("gas station", "Basey, Samar"),
    ("store", "Basey, Samar"),
    ("mall", "Basey, Samar"),
    
    # Community
    ("cemetery", "Basey, Samar"),
    ("plaza", "Basey, Samar"),
    ("gymnasium", "Basey, Samar"),
    ("sports complex", "Basey, Samar"),
    ("restaurant", "Basey, Samar"),
    ("hotel", "Basey, Samar"),
]

new_locations = []
seen_names = set()

def is_within_basey(lat, lng):
    """Check if coordinates are within Basey"""
    return 11.2 <= lat <= 11.6 and 124.9 <= lng <= 125.4

def determine_type(osm_type, name):
    """Determine location type"""
    name_lower = name.lower()
    
    if 'sitio' in name_lower or 'purok' in name_lower:
        return 'sitio'
    if 'barangay' in name_lower or osm_type in ['hamlet', 'village', 'neighbourhood']:
        return 'sitio'  # OSM often marks sitios as hamlets/villages
    
    return 'landmark'

print("🗺️ Searching OpenStreetMap...\n")
print(f"Total queries: {len(queries)} (this will take ~{len(queries)} seconds)\n")

for i, (amenity, location) in enumerate(queries, 1):
    print(f"[{i}/{len(queries)}] {amenity}...", end=' ')
    
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': f'{amenity} {location}',
            'format': 'json',
            'limit': 50,
            'countrycodes': 'ph',
            'addressdetails': 1
        }
        
        headers = {
            'User-Agent': 'BaseyFareGuide/1.0 (Location Data Collection)'
        }
        
        response = requests.get(url, params=params, headers=headers)
        
        if response.status_code == 200:
            results = response.json()
            new_in_query = 0
            
            for result in results:
                name = result.get('display_name', '').split(',')[0].strip()
                
                if not name:
                    continue
                
                lat = float(result.get('lat', 0))
                lng = float(result.get('lon', 0))
                
                if not is_within_basey(lat, lng):
                    continue
                
                name_lower = name.lower().strip()
                
                # Skip if already exists or seen
                if name_lower in existing_names or name_lower in seen_names:
                    continue
                
                # Skip generic names
                if name_lower in ['basey', 'samar', 'eastern samar']:
                    continue
                
                seen_names.add(name_lower)
                
                osm_type = result.get('type', '')
                loc_type = determine_type(osm_type, name)
                
                address = result.get('display_name', '')
                
                new_locations.append({
                    'name': name,
                    'type': loc_type,
                    'coordinates': {'lat': lat, 'lng': lng},
                    'source': 'osm',
                    'address': address,
                    'verified': False  # OSM data should be verified
                })
                
                new_in_query += 1
                print(f"✓ {name} ({loc_type})", end=' ')
            
            if new_in_query == 0:
                print(f"({len(results)} results, 0 new)")
        else:
            print(f"HTTP {response.status_code}")
        
        time.sleep(1.1)  # OSM requires 1 request per second
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Search interrupted by user")
        break
    except Exception as e:
        print(f"Error: {e}")

print(f"\n✨ Found {len(new_locations)} NEW locations!\n")

if new_locations:
    # Group by type
    by_type = {}
    for loc in new_locations:
        by_type.setdefault(loc['type'], []).append(loc['name'])
    
    print("📍 New Locations by Type:\n")
    for loc_type, names in sorted(by_type.items()):
        print(f"  {loc_type.upper()}S ({len(names)}):")
        for name in sorted(names)[:10]:  # Show first 10
            print(f"    • {name}")
        if len(names) > 10:
            print(f"    ... and {len(names) - 10} more")
    
    # Save to file
    print(f"\n💾 Adding to {output_path}...")
    
    with open(output_path, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
    
    # Add new locations
    for loc in new_locations:
        loc_type = loc['type']
        if loc_type not in existing_data['locations']:
            existing_data['locations'][loc_type] = []
        existing_data['locations'][loc_type].append(loc)
    
    # Update metadata
    total = sum(len(locs) for locs in existing_data['locations'].values())
    existing_data['metadata']['total_locations'] = total
    existing_data['metadata']['last_updated'] = time.strftime('%Y-%m-%d %H:%M:%S')
    
    # Sort
    for loc_type in existing_data['locations']:
        existing_data['locations'][loc_type].sort(key=lambda x: x['name'])
    
    # Save
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Success! Total locations now: {total}")
    print(f"\n⚠️ Note: New locations from OSM should be verified for accuracy")
else:
    print("✅ No new locations found")
