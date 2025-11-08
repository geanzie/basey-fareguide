"""
Find NEW sitios and landmarks not in existing database
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

# Google API setup
google_api_key = os.environ.get('GOOGLE_MAPS_API_KEY')

if not google_api_key:
    print("❌ Please set GOOGLE_MAPS_API_KEY environment variable")
    exit(1)

# Focused search queries
queries = [
    # Sitios and subdivisions
    "sitio Basey Samar",
    "purok Basey Samar",
    
    # Schools
    "elementary school Basey Samar",
    "high school Basey Samar",
    "school Basey Samar",
    
    # Religious sites
    "church Basey Samar",
    "chapel Basey Samar",
    
    # Health facilities
    "health center Basey Samar",
    "clinic Basey Samar",
    
    # Government
    "barangay hall Basey Samar",
    
    # Tourist spots
    "cave Basey Samar",
    "falls Basey Samar",
    "beach Basey Samar",
    "resort Basey Samar",
    
    # Infrastructure
    "terminal Basey Samar",
    "port Basey Samar",
    
    # Other landmarks
    "plaza Basey Samar",
    "market Basey Samar",
    "cemetery Basey Samar",
    "sports complex Basey Samar"
]

new_locations = []
seen_names = set()

def is_within_basey(lat, lng):
    """Check if coordinates are within Basey"""
    return 11.2 <= lat <= 11.6 and 124.9 <= lng <= 125.4

def determine_type(types, name):
    """Determine location type"""
    name_lower = name.lower()
    
    if 'sitio' in name_lower or 'purok' in name_lower:
        return 'sitio'
    if 'barangay' in name_lower:
        return 'barangay'
    
    landmark_types = ['church', 'school', 'hospital', 'health', 'town_hall', 
                     'tourist_attraction', 'park', 'museum', 'cemetery', 
                     'stadium', 'lodging', 'restaurant', 'store']
    
    if any(t in types for t in landmark_types):
        return 'landmark'
    
    return 'poi'

print("🔍 Searching Google Places API...\n")

for i, query in enumerate(queries, 1):
    print(f"[{i}/{len(queries)}] Searching: {query}")
    
    try:
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            'query': query,
            'key': google_api_key,
            'region': 'ph'
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if data.get('status') == 'OK':
            results = data.get('results', [])
            print(f"  Found {len(results)} results")
            
            for result in results:
                name = result.get('name', '')
                location = result.get('geometry', {}).get('location', {})
                
                if not name or not location:
                    continue
                
                lat = location.get('lat')
                lng = location.get('lng')
                
                if not is_within_basey(lat, lng):
                    continue
                
                name_lower = name.lower().strip()
                
                # Skip if already exists or seen
                if name_lower in existing_names or name_lower in seen_names:
                    continue
                
                seen_names.add(name_lower)
                
                types = result.get('types', [])
                loc_type = determine_type(types, name)
                
                new_locations.append({
                    'name': name,
                    'type': loc_type,
                    'coordinates': {'lat': lat, 'lng': lng},
                    'source': 'google',
                    'address': result.get('formatted_address', ''),
                    'verified': True
                })
                
                print(f"  ✓ NEW: {name} ({loc_type})")
        
        elif data.get('status') == 'ZERO_RESULTS':
            print("  No results")
        else:
            print(f"  Status: {data.get('status')}")
        
        time.sleep(0.3)  # Rate limiting
        
    except Exception as e:
        print(f"  Error: {e}")

print(f"\n✨ Found {len(new_locations)} NEW locations!\n")

if new_locations:
    # Group by type
    by_type = {}
    for loc in new_locations:
        by_type.setdefault(loc['type'], []).append(loc['name'])
    
    print("📍 New Locations by Type:\n")
    for loc_type, names in sorted(by_type.items()):
        print(f"  {loc_type.upper()}S ({len(names)}):")
        for name in sorted(names):
            print(f"    • {name}")
    
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
else:
    print("✅ No new locations found - database is complete!")
