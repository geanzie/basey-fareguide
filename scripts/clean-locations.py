"""
Clean and Verify Location Data
Helps review unverified locations and mark them as verified or remove them
"""

import json
import os

def load_locations():
    """Load location data"""
    filepath = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'basey-locations.json')
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f), filepath

def save_locations(data, filepath):
    """Save location data"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def verify_all_osm_locations(data):
    """Mark all OSM locations as verified"""
    count = 0
    for loc_type in data['locations'].values():
        for loc in loc_type:
            if loc.get('source') == 'osm' and not loc.get('verified'):
                loc['verified'] = True
                count += 1
    return count

def remove_barangay_halls_from_sitios(data):
    """Move barangay halls from sitios to landmarks"""
    if 'sitio' not in data['locations']:
        return 0
    
    moved = 0
    to_move = []
    
    for loc in data['locations']['sitio']:
        if 'hall' in loc['name'].lower() or 'barangay' in loc['name'].lower():
            to_move.append(loc)
    
    for loc in to_move:
        data['locations']['sitio'].remove(loc)
        loc['type'] = 'landmark'
        if 'landmark' not in data['locations']:
            data['locations']['landmark'] = []
        data['locations']['landmark'].append(loc)
        moved += 1
    
    # Remove sitio category if empty
    if not data['locations']['sitio']:
        del data['locations']['sitio']
    
    return moved

def list_unverified_by_category(data):
    """Show unverified locations grouped by category"""
    print("\n📋 Unverified Locations by Category:\n")
    
    categories = {
        'Schools': ['school', 'elementary', 'high school', 'learning'],
        'Churches': ['church', 'chapel', 'cathedral', 'parish'],
        'Government': ['hall', 'town hall', 'barangay'],
        'Health': ['hospital', 'clinic', 'health'],
        'Tourism': ['cave', 'waterfall', 'beach', 'resort', 'park'],
        'Infrastructure': ['bridge', 'terminal', 'wharf', 'gymnasium'],
        'Other': []
    }
    
    unverified = []
    for loc_type in data['locations'].values():
        for loc in loc_type:
            if not loc.get('verified'):
                unverified.append(loc)
    
    categorized = {cat: [] for cat in categories}
    
    for loc in unverified:
        name_lower = loc['name'].lower()
        matched = False
        
        for cat, keywords in categories.items():
            if cat == 'Other':
                continue
            if any(kw in name_lower for kw in keywords):
                categorized[cat].append(loc)
                matched = True
                break
        
        if not matched:
            categorized['Other'].append(loc)
    
    for cat, locs in categorized.items():
        if locs:
            print(f"  {cat} ({len(locs)}):")
            for loc in sorted(locs, key=lambda x: x['name'])[:15]:
                print(f"    • {loc['name']}")
            if len(locs) > 15:
                print(f"    ... and {len(locs) - 15} more")
            print()

def main():
    print("=" * 70)
    print("BASEY LOCATION DATA - CLEANING & VERIFICATION")
    print("=" * 70)
    
    data, filepath = load_locations()
    
    print(f"\n📊 Current Status:")
    print(f"  Total Locations: {data['metadata']['total_locations']}")
    
    total_verified = sum(
        1 for loc_type in data['locations'].values() 
        for loc in loc_type if loc.get('verified')
    )
    total_unverified = data['metadata']['total_locations'] - total_verified
    
    print(f"  Verified: {total_verified}")
    print(f"  Unverified: {total_unverified}")
    
    # Show unverified by category
    list_unverified_by_category(data)
    
    # Options
    print("=" * 70)
    print("OPTIONS:")
    print("=" * 70)
    print("1. Verify ALL OSM locations (mark all 101 as verified)")
    print("2. Fix sitios category (move barangay halls to landmarks)")
    print("3. Show detailed verification report")
    print("4. Exit without changes")
    print()
    
    choice = input("Select option (1-4): ").strip()
    
    if choice == '1':
        count = verify_all_osm_locations(data)
        print(f"\n✅ Marked {count} OSM locations as verified")
        
        # Update metadata
        data['metadata']['total_locations'] = sum(
            len(locs) for locs in data['locations'].values()
        )
        
        # Save
        save_locations(data, filepath)
        print(f"💾 Saved to {filepath}")
        
    elif choice == '2':
        moved = remove_barangay_halls_from_sitios(data)
        print(f"\n✅ Moved {moved} barangay halls from sitios to landmarks")
        
        # Update metadata
        data['metadata']['total_locations'] = sum(
            len(locs) for locs in data['locations'].values()
        )
        
        # Save
        save_locations(data, filepath)
        print(f"💾 Saved to {filepath}")
        
    elif choice == '3':
        print("\n📊 Detailed Verification Report:\n")
        
        for loc_type, locs in sorted(data['locations'].items()):
            verified = [loc for loc in locs if loc.get('verified')]
            unverified = [loc for loc in locs if not loc.get('verified')]
            
            print(f"  {loc_type.upper()}S:")
            print(f"    Total: {len(locs)}")
            print(f"    Verified: {len(verified)}")
            print(f"    Unverified: {len(unverified)}")
            
            if unverified:
                print(f"    Sources: ", end='')
                sources = {}
                for loc in unverified:
                    source = loc.get('source', 'unknown')
                    sources[source] = sources.get(source, 0) + 1
                print(', '.join(f"{k}: {v}" for k, v in sources.items()))
            print()
        
    else:
        print("\n👋 No changes made")
    
    print()

if __name__ == '__main__':
    main()
