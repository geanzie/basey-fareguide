# Archived Calculator Components

**Date Archived:** November 8, 2025  
**Reason:** Consolidation and cleanup of unused/duplicate calculator components

---

## 📦 Files in This Archive

### Unused Calculator Components:
1. **GoogleMapsFareCalculator.tsx** - Duplicate/unused Google Maps calculator
2. **GPSFareCalculator.tsx** - Standalone GPS calculator (not routed)
3. **FareCalculator.tsx** - Legacy fare calculator
4. **FareCalculatorFixed.tsx** - Fixed version of legacy calculator
5. **UnifiedFareCalculator.tsx** - Unified calculator wrapper (not routed)

---

## ✅ Active Calculator Components (Still in Use)

### Primary (Main Implementation):
- **RoutePlannerCalculator.tsx** ⭐
  - Used in: `/dashboard/calculator` (main route)
  - Used in: `/calculator` (public route)
  - Features: Google Maps integration, discount support, full barangay coverage

### Secondary (Available Options):
- **TripTrackerCalculator.tsx**
  - Used in: `/calculator` (selectable option)
  - Features: Real-time GPS tracking

- **SmartFareCalculator.tsx**
  - Used in: `UnifiedFareCalculator.tsx` component
  - Features: Intelligent mode switching

---

## 🔍 Why These Were Archived

### GoogleMapsFareCalculator.tsx
- **Reason:** Duplicate functionality
- **Replaced by:** RoutePlannerCalculator.tsx (which uses the same Google Maps API)
- **Status:** No imports found in codebase
- **Notes:** This was accidentally updated with discount feature, but the actual active component is RoutePlannerCalculator

### GPSFareCalculator.tsx
- **Reason:** Not routed or used in app
- **Replaced by:** TripTrackerCalculator.tsx for GPS functionality
- **Status:** No imports found in codebase

### FareCalculator.tsx & FareCalculatorFixed.tsx
- **Reason:** Legacy calculators from earlier development
- **Replaced by:** RoutePlannerCalculator.tsx
- **Status:** No imports found in codebase

### UnifiedFareCalculator.tsx
- **Reason:** Not routed in the application
- **Status:** No page routes using this component
- **Notes:** Was intended to unify multiple calculators but never fully implemented in routing

---

## 🔄 How to Restore a Component

If you need to restore any of these components:

1. Copy the file from `_archived/` back to `src/components/`
2. Add the import where needed
3. Update the routing if necessary
4. Test thoroughly

---

## 🗑️ Safe to Delete?

These files are kept as backup. After confirming the system works well for 1-2 months, you can safely delete this entire `_archived` folder. All changes are in git history anyway.

---

## 📊 Current Calculator Architecture

```
/dashboard/calculator → RoutePlannerCalculator (PRIMARY)
/calculator → Selection page
  ├── Route Planner → RoutePlannerCalculator
  └── Trip Tracker → TripTrackerCalculator
```

---

**Last Updated:** November 8, 2025  
**Archived By:** System Cleanup & Optimization  
**Impact:** None - No active code references these files
