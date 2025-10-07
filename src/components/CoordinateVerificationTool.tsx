'use client'

import React, { useState, useMemo } from 'react';
import { 
  analyzeAllCoordinates, 
  findDuplicateCoordinates, 
  generateBatchVerificationScript,
  suggestCorrections,
  type Location,
  type CoordinateAnalysis
} from '../utils/coordinateVerification';

// Import the barangay data from your component
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
  { name: 'Baybay (Poblacion)', coords: [11.28167, 125.06833], type: 'urban' },
  { name: 'Buscada (Poblacion)', coords: [11.2814091, 125.0667279], type: 'urban' },
  { name: 'Lawa-an (Poblacion)', coords: [11.2817, 125.0683], type: 'urban' },
  { name: 'Loyo (Poblacion)', coords: [11.280393, 125.067366], type: 'urban' },
  { name: 'Mercado (Poblacion)', coords: [11.2802359, 125.0701055], type: 'urban' },
  { name: 'Palaypay (Poblacion)', coords: [11.2845559, 125.0687231], type: 'urban' },
  { name: 'Sulod (Poblacion)', coords: [11.2818956, 125.0688281], type: 'urban' },
  
  // Remaining Barangays
  { name: 'Roxas', coords: [11.3067742, 125.0511018], type: 'rural' },
  { name: 'Salvacion', coords: [11.2671612, 125.0751775], type: 'rural' },
  { name: 'San Antonio', coords: [11.2768363, 125.0114879], type: 'rural' },
  { name: 'San Fernando', coords: [11.2788975, 125.1467683], type: 'rural' },
  { name: 'Sawa', coords: [11.305259, 125.0801691], type: 'rural' },
  { name: 'Serum', coords: [11.297623, 125.1297929], type: 'rural' },
  { name: 'Sugca', coords: [11.2919124, 125.1038343], type: 'rural' },
  { name: 'Sugponon', coords: [11.2881403, 125.1053266], type: 'rural' },
  { name: 'Tinaogan', coords: [11.2893217, 124.9771129], type: 'rural' },
  { name: 'Tingib', coords: [11.2785632, 125.032787], type: 'rural' },
  { name: 'Villa Aurora', coords: [11.3389437, 125.0646847], type: 'rural' },
  { name: 'Binongtu-an', coords: [11.2909236, 125.1192263], type: 'rural' },
  { name: 'Bulao', coords: [11.3381704, 125.1021105], type: 'rural' },
  
  // Key Landmarks and Places of Interest in Basey Municipality
  { name: 'José Rizal Monument (Basey Center - KM 0)', coords: [11.280182, 125.06918], type: 'landmark' },
  { name: 'Sohoton Natural Bridge National Park', coords: [11.3329711, 125.1442518], type: 'landmark' },
  { name: 'Sohoton Caves', coords: [11.3588068, 125.1586589], type: 'landmark' },
  { name: 'Panhulugan Cliff', coords: [11.3556, 125.0234], type: 'landmark' },
  { name: 'Basey Church (St. Michael the Archangel)', coords: [11.2809812, 125.0699803], type: 'landmark' },
  { name: 'Basey Municipal Hall', coords: [11.2801061, 125.0691729], type: 'landmark' },
  { name: 'Basey Public Market', coords: [11.2846003, 125.070559], type: 'landmark' },
  { name: 'Basey Central School', coords: [11.2817, 125.0683], type: 'landmark' },
  { name: 'Basey National High School', coords: [11.2847487, 125.0668604], type: 'landmark' },
  { name: 'Basey Port/Wharf', coords: [11.282514, 125.07155], type: 'landmark' },
  { name: 'Rural Health Unit Basey', coords: [11.2817, 125.0683], type: 'landmark' }
];

const CoordinateVerificationTool: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'summary' | 'detailed' | 'duplicates' | 'script'>('summary');
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  // Analyze coordinates
  const analysis = useMemo(() => analyzeAllCoordinates(barangayData), []);
  const duplicates = useMemo(() => findDuplicateCoordinates(barangayData), []);
  const verificationScript = useMemo(() => generateBatchVerificationScript(barangayData), []);

  const filteredAnalyses = showOnlyIssues 
    ? analysis.analyses.filter(a => a.issues.length > 0)
    : analysis.analyses;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
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
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
              <span className="text-2xl">🔍</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Coordinate Verification Tool</h1>
              <p className="text-blue-100">Analyze and validate Basey Municipality coordinates</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'summary', label: 'Summary', icon: '📊' },
              { key: 'detailed', label: 'Detailed Analysis', icon: '🔎' },
              { key: 'duplicates', label: 'Duplicates', icon: '👥' },
              { key: 'script', label: 'Verification Script', icon: '⚙️' }
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
          {selectedTab === 'summary' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Verification Summary</h2>
              
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">{analysis.summary.total}</div>
                  <div className="text-sm text-gray-600">Total Locations</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{analysis.summary.highIssues}</div>
                  <div className="text-sm text-red-700">High Priority Issues</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{analysis.summary.mediumIssues}</div>
                  <div className="text-sm text-yellow-700">Medium Priority Issues</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{analysis.summary.clean}</div>
                  <div className="text-sm text-green-700">No Issues Found</div>
                </div>
              </div>

              {/* Top Issues */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800 mb-3">🚨 High Priority Issues</h3>
                <div className="space-y-2">
                  {analysis.flaggedLocations
                    .filter(a => a.severity === 'high')
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index} className="bg-white rounded p-3 border border-red-200">
                        <div className="font-medium text-red-700">{item.name}</div>
                        <div className="text-sm text-red-600">
                          Coordinates: {item.coords[0]}, {item.coords[1]}
                        </div>
                        <div className="text-xs text-red-500 mt-1">
                          {item.issues.slice(0, 2).join('; ')}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Duplicate Coordinates */}
              {duplicates.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Duplicate Coordinates</h3>
                  <div className="space-y-2">
                    {duplicates.map((dup, index) => (
                      <div key={index} className="bg-white rounded p-3 border border-yellow-200">
                        <div className="font-medium text-yellow-700">
                          {dup.coords[0]}, {dup.coords[1]}
                        </div>
                        <div className="text-sm text-yellow-600">
                          Used by: {dup.locations.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedTab === 'detailed' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Detailed Analysis</h2>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showOnlyIssues}
                    onChange={(e) => setShowOnlyIssues(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Show only locations with issues</span>
                </label>
              </div>

              <div className="space-y-3">
                {filteredAnalyses.map((item, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${
                    item.issues.length === 0 ? 'border-green-200 bg-green-50' : 
                    getSeverityColor(item.severity).split(' ').slice(1).join(' ')
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">
                          {item.coords[0]}, {item.coords[1]} • {item.type} • 
                          {item.distanceFromCenter.toFixed(2)}km from center
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <a
                          href={item.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          📍 View on Maps
                        </a>
                        <button
                          onClick={() => copyToClipboard(`${item.coords[0]},${item.coords[1]}`)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>

                    {item.issues.length > 0 ? (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          {item.issues.map((issue, issueIndex) => (
                            <div key={issueIndex} className="text-sm text-red-700 bg-red-100 rounded px-2 py-1">
                              • {issue}
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Suggested Actions:</h4>
                          <div className="space-y-1">
                            {suggestCorrections({ name: item.name, coords: item.coords, type: item.type as any }).map((suggestion, suggestionIndex) => (
                              <div key={suggestionIndex} className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                                • {suggestion}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-green-700">✅ No issues found</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'duplicates' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Duplicate Coordinates</h2>
              
              {duplicates.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">✅</div>
                  <div className="text-lg font-medium text-gray-700">No Duplicate Coordinates Found</div>
                  <div className="text-gray-600">All locations have unique coordinate pairs.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {duplicates.map((dup, index) => (
                    <div key={index} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                      <div className="font-semibold text-yellow-800">
                        Coordinates: {dup.coords[0]}, {dup.coords[1]}
                      </div>
                      <div className="text-yellow-700 mt-2">
                        <span className="font-medium">Shared by:</span>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          {dup.locations.map((location, locIndex) => (
                            <li key={locIndex} className="text-sm">{location}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 flex space-x-2">
                        <a
                          href={`https://www.google.com/maps/search/@${dup.coords[0]},${dup.coords[1]},15z`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          📍 View on Maps
                        </a>
                        <button
                          onClick={() => copyToClipboard(`${dup.coords[0]},${dup.coords[1]}`)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          📋 Copy Coordinates
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'script' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Batch Verification Script</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">📋 How to Use This Script</h3>
                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                  <li>Copy the script below</li>
                  <li>Open your browser console (F12 → Console tab)</li>
                  <li>Paste and run the script</li>
                  <li>It will list all flagged coordinates with direct Google Maps links</li>
                  <li>Optionally, uncomment the last line to auto-open all URLs</li>
                </ol>
              </div>

              <div className="relative">
                <button
                  onClick={() => copyToClipboard(verificationScript)}
                  className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  📋 Copy Script
                </button>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{verificationScript}</code>
                </pre>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Manual Verification Checklist</h3>
                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                  <li>Open each flagged coordinate in Google Maps</li>
                  <li>Check if the pin location matches the barangay/landmark name</li>
                  <li>Look for nearby roads, landmarks, or geographical features</li>
                  <li>Cross-reference with local knowledge or official maps</li>
                  <li>Record corrections needed and update coordinates accordingly</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoordinateVerificationTool;