"""
Location Verification Script for Basey Fare Guide
Verifies coordinates, checks for duplicates, and validates location data
"""

import json
import os
from math import radians, cos, sin, asin, sqrt

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers"""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km * 1000  # Return in meters

def load_locations():
    """Load location data"""
    filepath = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'basey-locations.json')
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def check_duplicates(data):
    """Check for duplicate location names"""
    print("🔍 Checking for duplicates...\n")
    
    all_locations = []
    for loc_type in data['locations'].values():
        all_locations.extend(loc_type)
    
    # Check by name
    names = {}
    for loc in all_locations:
        name_lower = loc['name'].lower().strip()
        if name_lower in names:
            names[name_lower].append(loc)
        else:
            names[name_lower] = [loc]
    
    duplicates = {k: v for k, v in names.items() if len(v) > 1}
    
    if duplicates:
        print(f"⚠️ Found {len(duplicates)} duplicate names:\n")
        for name, locs in duplicates.items():
            print(f"  '{name.title()}' appears {len(locs)} times:")
            for loc in locs:
                print(f"    - Type: {loc['type']}, Source: {loc['source']}, "
                      f"Coords: ({loc['coordinates']['lat']:.6f}, {loc['coordinates']['lng']:.6f})")
            print()
    else:
        print("✅ No duplicate names found\n")
    
    return duplicates

def check_proximity(data):
    """Check for locations that are suspiciously close to each other"""
    print("📍 Checking for locations too close together...\n")
    
    all_locations = []
    for loc_type in data['locations'].values():
        all_locations.extend(loc_type)
    
    too_close = []
    threshold = 10  # meters
    
    for i, loc1 in enumerate(all_locations):
        for loc2 in all_locations[i+1:]:
            if loc1['name'] == loc2['name']:
                continue
            
            dist = haversine(
                loc1['coordinates']['lat'], loc1['coordinates']['lng'],
                loc2['coordinates']['lat'], loc2['coordinates']['lng']
            )
            
            if dist < threshold:
                too_close.append((loc1, loc2, dist))
    
    if too_close:
        print(f"⚠️ Found {len(too_close)} pairs of locations within {threshold}m:\n")
        for loc1, loc2, dist in too_close:
            print(f"  {loc1['name']} & {loc2['name']}: {dist:.1f}m apart")
    else:
        print(f"✅ No locations within {threshold}m of each other\n")
    
    return too_close

def check_bounds(data):
    """Check if all locations are within Basey municipality bounds"""
    print("🗺️ Checking location bounds...\n")
    
    # Approximate bounds for Basey
    lat_min, lat_max = 11.2, 11.6
    lng_min, lng_max = 124.9, 125.4
    
    out_of_bounds = []
    
    for loc_type in data['locations'].values():
        for loc in loc_type:
            lat = loc['coordinates']['lat']
            lng = loc['coordinates']['lng']
            
            if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
                out_of_bounds.append(loc)
    
    if out_of_bounds:
        print(f"⚠️ Found {len(out_of_bounds)} locations outside Basey bounds:\n")
        for loc in out_of_bounds:
            print(f"  {loc['name']}: ({loc['coordinates']['lat']:.6f}, {loc['coordinates']['lng']:.6f})")
            print(f"    Address: {loc.get('address', 'N/A')}")
    else:
        print("✅ All locations within Basey bounds\n")
    
    return out_of_bounds

def check_unverified(data):
    """List unverified locations"""
    print("🔎 Checking verification status...\n")
    
    unverified = []
    
    for loc_type in data['locations'].values():
        for loc in loc_type:
            if not loc.get('verified', False):
                unverified.append(loc)
    
    if unverified:
        print(f"⚠️ Found {len(unverified)} unverified locations:\n")
        
        by_type = {}
        for loc in unverified:
            by_type.setdefault(loc['type'], []).append(loc['name'])
        
        for loc_type, names in sorted(by_type.items()):
            print(f"  {loc_type.upper()}S ({len(names)}):")
            for name in sorted(names)[:10]:
                print(f"    • {name}")
            if len(names) > 10:
                print(f"    ... and {len(names) - 10} more")
        print()
    else:
        print("✅ All locations are verified\n")
    
    return unverified

def show_statistics(data):
    """Show location statistics"""
    print("📊 Location Statistics:\n")
    
    metadata = data['metadata']
    print(f"  Municipality: {metadata['municipality']}")
    print(f"  Province: {metadata['province']}")
    print(f"  Total Locations: {metadata['total_locations']}")
    print(f"  Last Updated: {metadata['last_updated']}\n")
    
    print("  By Type:")
    for loc_type, locs in sorted(data['locations'].items()):
        verified_count = sum(1 for loc in locs if loc.get('verified', False))
        print(f"    {loc_type.title()}s: {len(locs)} ({verified_count} verified)")
    
    print("\n  By Source:")
    sources = {}
    for loc_type in data['locations'].values():
        for loc in loc_type:
            source = loc.get('source', 'unknown')
            sources[source] = sources.get(source, 0) + 1
    
    for source, count in sorted(sources.items()):
        print(f"    {source}: {count}")
    print()

def main():
    print("=" * 60)
    print("BASEY FARE GUIDE - LOCATION VERIFICATION")
    print("=" * 60)
    print()
    
    # Load data
    data = load_locations()
    
    # Run all checks
    show_statistics(data)
    duplicates = check_duplicates(data)
    proximity = check_proximity(data)
    out_of_bounds = check_bounds(data)
    unverified = check_unverified(data)
    
    # Summary
    print("=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    issues = []
    if duplicates:
        issues.append(f"❌ {len(duplicates)} duplicate names")
    if proximity:
        issues.append(f"⚠️ {len(proximity)} location pairs too close")
    if out_of_bounds:
        issues.append(f"❌ {len(out_of_bounds)} locations out of bounds")
    if unverified:
        issues.append(f"⚠️ {len(unverified)} unverified locations")
    
    if issues:
        print("\nIssues found:")
        for issue in issues:
            print(f"  {issue}")
        print("\nRecommendation: Review and clean up the data")
    else:
        print("\n✅ All checks passed! Location data is clean and verified.")
    
    print()

if __name__ == '__main__':
    main()
