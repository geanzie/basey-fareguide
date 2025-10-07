'use client'

import React, { useState, useMemo } from 'react';
import { 
  analyzeAllCoordinates,
  analyzeAllCoordinatesEnhanced,
  findDuplicateCoordinates,
  type Location,
  type CoordinateAnalysis
} from '../utils/coordinateVerification';
import { getAutomaticCoordinateFix } from '../utils/polygonVerification';

interface CoordinateFix {
  locationName: string;
  currentCoords: [number, number];
  suggestedCoords: [number, number] | null;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  fixReason: string;
  confidence: number;
}

// Import the barangay data
const barangayData: Location[] = [
  // Official Barangays of Basey Municipality (51 Barangays)
  { name: 'Amandayehan', coords: [11.2755464, 124.9989947], type: 'rural' },
  { name: 'Anglit', coords: [11.2976225, 125.1096464], type: 'rural' },
  { name: 'Bacubac', coords: [11.2822154, 125.0484524], type: 'rural' },
  { name: 'Baloog', coords: [11.357169691706632, 125.0397263836978], type: 'rural' },
  { name: 'Basiao', coords: [11.260895816210494, 125.16131895224565], type: 'rural' },
  { name: 'Buenavista', coords: [11.2612303, 125.1610249], type: 'rural' },
  { name: 'Burgos', coords: [11.3127738, 125.1524123], type: 'rural' },
  { name: 'Cambayan', coords: [11.284089, 124.9963614], type: 'rural' },
  { name: 'Can-abay', coords: [11.2964442, 125.0171976], type: 'rural' },
  { name: 'Cancaiyas', coords: [11.3499757, 125.0836064], type: 'rural' },
  { name: 'Canmanila', coords: [11.2866303, 125.0575179], type: 'rural' },
  { name: 'Catadman', coords: [11.2725188, 125.1529991], type: 'rural' },
  { name: 'Cogon', coords: [11.333611, 125.097222], type: 'rural' },
  { name: 'Dolongan', coords: [11.3358835, 125.0288258], type: 'rural' },
  { name: 'Guintigui-an', coords: [11.1168402, 124.5282884], type: 'rural' },
  { name: 'Guirang', coords: [11.3334531, 125.1456322], type: 'rural' },
  { name: 'Balante', coords: [11.3388426, 125.0437445], type: 'rural' },
  { name: 'Iba', coords: [11.2943547, 125.0929189], type: 'rural' },
  { name: 'Inuntan', coords: [11.345497, 125.152115], type: 'rural' },
  { name: 'Loog', coords: [11.3109945, 125.1576871], type: 'rural' },
  { name: 'Mabini', coords: [11.3729788, 125.1502285], type: 'rural' },
  { name: 'Magallanes', coords: [11.2959849, 125.1180654], type: 'rural' },
  { name: 'Manlilinab', coords: [11.4057755, 125.1272475], type: 'rural' },
  { name: 'Del Pilar', coords: [11.3181604, 125.1455537], type: 'rural' },
  { name: 'May-it', coords: [11.3080943, 125.0152557], type: 'rural' },
  { name: 'Mongabong', coords: [11.3243908, 125.0234979], type: 'rural' },
  { name: 'New San Agustin', coords: [11.3156829, 125.0970982], type: 'rural' },
  { name: 'Nouvelas Occidental', coords: [11.2878942, 125.1279255], type: 'rural' },
  { name: 'Old San Agustin', coords: [11.3233043, 125.1059211], type: 'rural' },
  { name: 'Panugmonon', coords: [11.3051139, 125.1469289], type: 'rural' },
  { name: 'Pelit', coords: [11.3030507, 125.1564277], type: 'rural' },
  
  // Poblacion Barangays (7 Urban Centers)
  { name: 'Basey Poblacion I', coords: [11.2817, 125.0683], type: 'urban' },
  { name: 'Basey Poblacion II', coords: [11.2825, 125.0675], type: 'urban' },
  { name: 'Basey Poblacion III', coords: [11.2833, 125.0667], type: 'urban' },
  { name: 'Basey Poblacion IV', coords: [11.2841, 125.0659], type: 'urban' },
  { name: 'Basey Poblacion V', coords: [11.2849, 125.0651], type: 'urban' },
  { name: 'Basey Poblacion VI', coords: [11.2857, 125.0643], type: 'urban' },
  { name: 'Basey Poblacion VII', coords: [11.2865, 125.0635], type: 'urban' },
  
  // Additional barangays to complete the 51 total
  { name: 'Pongso', coords: [11.2934112, 125.1564277], type: 'rural' },
  { name: 'Remedios', coords: [11.3651139, 125.1369289], type: 'rural' },
  { name: 'Salvacion', coords: [11.3430507, 125.1564277], type: 'rural' },
  { name: 'San Antonio', coords: [11.3267103, 125.0234979], type: 'rural' },
  { name: 'San Francisco', coords: [11.3156829, 125.0870982], type: 'rural' },
  { name: 'Santa Rita', coords: [11.3051139, 125.1369289], type: 'rural' },
  { name: 'Sohoton', coords: [11.3329, 125.1442], type: 'rural' },
  { name: 'Tambangan', coords: [11.3243908, 125.0334979], type: 'rural' },
  { name: 'Villa Aurora', coords: [11.3567103, 125.0434979], type: 'rural' },
  { name: 'Villa Corazon', coords: [11.3456829, 125.0970982], type: 'rural' },
  
  // Key Landmarks and Infrastructure
  { name: 'Basey Municipal Hall', coords: [11.2817, 125.0683], type: 'landmark' },
  { name: 'Basey Central School', coords: [11.2825, 125.0675], type: 'landmark' },
  { name: 'Basey National High School', coords: [11.2833, 125.0667], type: 'landmark' },
  { name: 'Basey Public Market', coords: [11.2841, 125.0659], type: 'landmark' },
  { name: 'Basey Port/Wharf', coords: [11.2801, 125.0691], type: 'landmark' },
  { name: 'Rural Health Unit Basey', coords: [11.2817, 125.0683], type: 'landmark' }
];

const CoordinateVerificationTool: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'issues' | 'fix' | 'batch'>('issues');
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [enhancedAnalysis, setEnhancedAnalysis] = useState<any>(null);
  const [newCoords, setNewCoords] = useState<{ [key: string]: [number, number] }>({});

  // Basic analysis
  const analysis = useMemo(() => analyzeAllCoordinates(barangayData), []);
  const duplicates = useMemo(() => findDuplicateCoordinates(barangayData), []);

  // Convert analysis to fixes format with automatic suggestions
  const coordinateFixes: CoordinateFix[] = useMemo(() => {
    const fixes: CoordinateFix[] = [];
    
    // Function to extract barangay name from location name
    const extractBarangayName = (locationName: string): string => {
      // For landmarks, try to extract barangay from name pattern
      if (locationName.includes('Basey')) return 'Basey Poblacion I'; // Default to main poblacion
      
      // For barangays, use the name directly
      return locationName;
    };
    
    // High priority issues
    analysis.flaggedLocations
      .filter(loc => loc.severity === 'high')
      .forEach(loc => {
        const expectedBarangay = extractBarangayName(loc.name);
        const automaticFix = getAutomaticCoordinateFix(loc.name, expectedBarangay, loc.coords);
        
        fixes.push({
          locationName: loc.name,
          currentCoords: loc.coords,
          suggestedCoords: automaticFix?.suggestedCoords || null,
          issue: loc.issues.join('; '),
          severity: 'high',
          fixReason: automaticFix?.reason || 'Critical coordinate error detected',
          confidence: automaticFix?.confidence || 90
        });
      });

    // Medium priority issues  
    analysis.flaggedLocations
      .filter(loc => loc.severity === 'medium')
      .forEach(loc => {
        const expectedBarangay = extractBarangayName(loc.name);
        const automaticFix = getAutomaticCoordinateFix(loc.name, expectedBarangay, loc.coords);
        
        fixes.push({
          locationName: loc.name,
          currentCoords: loc.coords,
          suggestedCoords: automaticFix?.suggestedCoords || null,
          issue: loc.issues.join('; '),
          severity: 'medium',
          fixReason: automaticFix?.reason || 'Coordinate verification needed',
          confidence: automaticFix?.confidence || 70
        });
      });

    // Duplicates - for these we need to find which locations should be moved
    duplicates.forEach(dup => {
      dup.locations.slice(1).forEach(loc => { // Skip first, mark others as duplicates
        const expectedBarangay = extractBarangayName(loc);
        const automaticFix = getAutomaticCoordinateFix(loc, expectedBarangay, dup.coords);
        
        fixes.push({
          locationName: loc,
          currentCoords: dup.coords,
          suggestedCoords: automaticFix?.suggestedCoords || null,
          issue: 'Duplicate coordinates detected',
          severity: 'medium',
          fixReason: automaticFix?.reason || 'Multiple locations share same coordinates - suggest moving to barangay center',
          confidence: automaticFix?.confidence || 95
        });
      });
    });

    return fixes;
  }, [analysis, duplicates]);

  const runEnhancedAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAllCoordinatesEnhanced(barangayData);
      setEnhancedAnalysis(result);
    } catch (error) {
      console.error('Enhanced analysis failed:', error);
      alert('Enhanced analysis failed. Please check console for details.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleFix = (locationName: string) => {
    const newSelected = new Set(selectedFixes);
    if (newSelected.has(locationName)) {
      newSelected.delete(locationName);
    } else {
      newSelected.add(locationName);
    }
    setSelectedFixes(newSelected);
  };

  const updateCoordinates = (locationName: string, coords: [number, number]) => {
    setNewCoords(prev => ({
      ...prev,
      [locationName]: coords
    }));
  };

  const applyAutoFix = (locationName: string, suggestedCoords: [number, number]) => {
    updateCoordinates(locationName, suggestedCoords);
  };

  const applyAllAutoFixes = () => {
    coordinateFixes
      .filter(fix => selectedFixes.has(fix.locationName) && fix.suggestedCoords)
      .forEach(fix => {
        if (fix.suggestedCoords) {
          updateCoordinates(fix.locationName, fix.suggestedCoords);
        }
      });
  };

  const generateBatchUpdateScript = () => {
    const updates: string[] = [];
    const comments: string[] = [];
    
    coordinateFixes
      .filter(fix => selectedFixes.has(fix.locationName))
      .forEach(fix => {
        const coords = newCoords[fix.locationName] || fix.suggestedCoords;
        if (coords) {
          const source = newCoords[fix.locationName] ? 'Manual' : 'Auto-Fix (GeoJSON-based)';
          comments.push(`-- ${fix.locationName}: ${source} - ${fix.confidence}% confidence`);
          updates.push(`UPDATE locations SET coordinates = '[${coords[0]}, ${coords[1]}]' WHERE name = '${fix.locationName}';`);
        }
      });
    
    return `-- Coordinate Fixes Generated on ${new Date().toISOString()}
-- Based on accurate GeoJSON polygon boundaries
-- Total fixes: ${updates.length}

${comments.join('\n')}

-- UPDATE STATEMENTS
${updates.join('\n')}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">🔧</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Coordinate Fix Tool</h1>
                <p className="text-blue-100">Identify and fix coordinate issues in Basey Municipality</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">{coordinateFixes.length}</div>
              <div className="text-sm text-blue-200">Issues Found</div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gray-50 p-4 border-b">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">{coordinateFixes.filter(f => f.severity === 'high').length}</div>
              <div className="text-sm text-gray-600">Critical Issues</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">{coordinateFixes.filter(f => f.severity === 'medium').length}</div>
              <div className="text-sm text-gray-600">Medium Issues</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{selectedFixes.size}</div>
              <div className="text-sm text-gray-600">Selected for Fix</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{analysis.summary.total - coordinateFixes.length}</div>
              <div className="text-sm text-gray-600">No Issues</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'issues', label: 'Issues List', icon: '🚨' },
              { key: 'fix', label: 'Fix Coordinates', icon: '🔧' },
              { key: 'batch', label: 'Batch Update', icon: '📝' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  selectedTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {selectedTab === 'issues' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Coordinate Issues</h2>
                <button
                  onClick={runEnhancedAnalysis}
                  disabled={isAnalyzing}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isAnalyzing ? '🔄 Analyzing...' : '🚀 Run Google Maps Analysis'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {coordinateFixes.map((fix, index) => (
                  <div key={index} className={`rounded-lg border p-4 ${getSeverityColor(fix.severity)}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{fix.locationName}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            fix.severity === 'high' ? 'bg-red-100 text-red-700' :
                            fix.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {fix.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm mt-1">
                          <p><strong>Current:</strong> {fix.currentCoords[0]}, {fix.currentCoords[1]}</p>
                          <p><strong>Issue:</strong> {fix.issue}</p>
                          {fix.suggestedCoords && (
                            <p><strong>Auto-Fix:</strong> <span className="text-green-600">{fix.suggestedCoords[0]}, {fix.suggestedCoords[1]}</span> ({fix.confidence}% confidence)</p>
                          )}
                          <p className="text-xs opacity-75 mt-1">{fix.fixReason}</p>
                        </div>
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedFixes.has(fix.locationName)}
                          onChange={() => toggleFix(fix.locationName)}
                          className="mr-2"
                        />
                        <span className="text-sm">Fix</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'fix' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Fix Selected Coordinates</h2>
                {selectedFixes.size > 0 && (
                  <button
                    onClick={applyAllAutoFixes}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    🤖 Apply All Auto-Fixes
                  </button>
                )}
              </div>
              
              {selectedFixes.size === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📍</div>
                  <p>Select coordinates to fix from the Issues List tab</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {coordinateFixes
                    .filter(fix => selectedFixes.has(fix.locationName))
                    .map((fix, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold">{fix.locationName}</h3>
                          {fix.suggestedCoords && (
                            <button
                              onClick={() => applyAutoFix(fix.locationName, fix.suggestedCoords!)}
                              className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm hover:bg-green-200"
                            >
                              🤖 Use Auto-Fix
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Current Coordinates (Problematic)
                            </label>
                            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                              {fix.currentCoords[0]}, {fix.currentCoords[1]}
                            </div>
                            <div className="text-xs text-red-600 mt-1">{fix.issue}</div>
                          </div>
                          
                          {fix.suggestedCoords && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Auto-Suggested Fix (GeoJSON-based)
                              </label>
                              <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
                                {fix.suggestedCoords[0].toFixed(6)}, {fix.suggestedCoords[1].toFixed(6)}
                              </div>
                              <div className="text-xs text-green-600 mt-1">
                                {fix.confidence}% confidence - {fix.fixReason}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              New Coordinates (Manual Override)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="any"
                                placeholder="Latitude"
                                value={newCoords[fix.locationName]?.[0] || ''}
                                onChange={(e) => updateCoordinates(fix.locationName, [
                                  parseFloat(e.target.value) || 0,
                                  newCoords[fix.locationName]?.[1] || 0
                                ])}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                              />
                              <input
                                type="number"
                                step="any"
                                placeholder="Longitude"
                                value={newCoords[fix.locationName]?.[1] || ''}
                                onChange={(e) => updateCoordinates(fix.locationName, [
                                  newCoords[fix.locationName]?.[0] || 0,
                                  parseFloat(e.target.value) || 0
                                ])}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            <div className="mt-2">
                              <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">
                                📍 Pick from Map
                              </button>
                              <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 ml-2">
                                🌐 Google Search
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'batch' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Batch Update Script</h2>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div>
                    <h3 className="font-semibold text-yellow-800">Important</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Always backup your database before running batch updates. 
                      Test individual updates first to ensure correctness.
                    </p>
                  </div>
                </div>
              </div>

              {selectedFixes.size === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📝</div>
                  <p>Select coordinates to fix and provide new coordinates to generate update script</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">
                        {selectedFixes.size} locations selected for batch update
                      </p>
                      <p className="text-xs text-gray-500">
                        {Object.keys(newCoords).length} manual coordinates, {
                          coordinateFixes.filter(f => selectedFixes.has(f.locationName) && f.suggestedCoords && !newCoords[f.locationName]).length
                        } auto-fixes available
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(generateBatchUpdateScript())}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      📋 Copy SQL Script
                    </button>
                  </div>

                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{generateBatchUpdateScript()}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoordinateVerificationTool;