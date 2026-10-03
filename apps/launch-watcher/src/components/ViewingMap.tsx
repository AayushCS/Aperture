import { useState } from 'react'
import { MapPin, Eye, EyeOff, Navigation, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from './ui/Button'
import type { LaunchSite } from '@aperture/orbital-core'

interface ViewingMapProps {
  launchSite: LaunchSite
}

const ViewingMap = ({ launchSite }: ViewingMapProps) => {
  const [viewMode, setViewMode] = useState<'visibility' | 'trajectory'>('visibility')
  const [zoom, setZoom] = useState(1)

  // Mock visibility regions data
  const visibilityRegions = [
    { lat: 28.5729, lng: -80.6489, radius: 100, quality: 'high' }, // KSC
    { lat: 30.0, lng: -85.0, radius: 50, quality: 'medium' },
    { lat: 26.0, lng: -82.0, radius: 30, quality: 'high' },
    { lat: 32.0, lng: -78.0, radius: 40, quality: 'low' },
    { lat: 25.0, lng: -75.0, radius: 60, quality: 'medium' },
  ]

  // Mock trajectory points
  const trajectoryPoints = [
    { lat: 28.5729, lng: -80.6489 }, // Launch site
    { lat: 29.0, lng: -79.0 },
    { lat: 30.0, lng: -77.0 },
    { lat: 32.0, lng: -74.0 },
    { lat: 35.0, lng: -70.0 }, // Orbit insertion
  ]

  // Calculate map dimensions
  const mapWidth = 600 * zoom
  const mapHeight = 300 * zoom
  const centerX = mapWidth / 2
  const centerY = mapHeight / 2

  // Convert lat/lng to map coordinates (simplified)
  const latLngToMap = (lat: number, lng: number) => {
    const x = centerX + (lng - launchSite.longitude) * 20 * zoom
    const y = centerY - (lat - launchSite.latitude) * 20 * zoom
    return { x, y }
  }

  return (
    <div className="space-y-4">
      {/* Map controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'visibility' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center space-x-2"
            onClick={() => setViewMode('visibility')}
          >
            <Eye className="h-4 w-4" />
            <span>Visibility</span>
          </Button>
          <Button
            variant={viewMode === 'trajectory' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center space-x-2"
            onClick={() => setViewMode('trajectory')}
          >
            <Navigation className="h-4 w-4" />
            <span>Trajectory</span>
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-400">{(zoom * 100).toFixed(0)}%</span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setZoom(prev => Math.min(2, prev + 0.2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Map visualization */}
      <div className="relative rounded-xl overflow-hidden bg-space-dark border border-space-blue/30">
        <div 
          className="w-full h-64 relative"
          style={{ 
            background: 'linear-gradient(135deg, #0a0e17 0%, #1e3a8a 50%, #4c1d95 100%)',
            overflow: 'hidden'
          }}
        >
          {/* Simplified map representation using SVG */}
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="absolute inset-0"
          >
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(96, 165, 250, 0.1)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Coastline outline (simplified Florida/east coast) */}
            <path
              d="M 200,150 L 220,140 L 240,130 L 260,125 L 280,130 L 300,140 L 320,145 L 340,150 L 360,155 L 380,160 L 400,165"
              fill="none"
              stroke="rgba(34, 197, 94, 0.3)"
              strokeWidth="2"
            />

            {/* Visibility regions */}
            {viewMode === 'visibility' && visibilityRegions.map((region, index) => {
              const { x, y } = latLngToMap(region.lat, region.lng)
              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={y}
                    r={region.radius * 0.2 * zoom}
                    fill={region.quality === 'high' ? 'rgba(34, 197, 94, 0.1)' : 
                          region.quality === 'medium' ? 'rgba(234, 179, 8, 0.1)' : 
                          'rgba(239, 68, 68, 0.1)'}
                    stroke={region.quality === 'high' ? '#22c55e' : 
                            region.quality === 'medium' ? '#eab308' : 
                            '#ef4444'}
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={3}
                    fill={region.quality === 'high' ? '#22c55e' : 
                          region.quality === 'medium' : '#eab308' : 
                          '#ef4444'}
                  />
                </g>
              )
            })}

            {/* Trajectory path */}
            {viewMode === 'trajectory' && (
              <g>
                <path
                  d={trajectoryPoints.map((point, index) => {
                    const { x, y } = latLngToMap(point.lat, point.lng)
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                {trajectoryPoints.map((point, index) => {
                  const { x, y } = latLngToMap(point.lat, point.lng)
                  return (
                    <g key={index}>
                      <circle
                        cx={x}
                        cy={y}
                        r={index === 0 ? 6 : 4}
                        fill={index === 0 ? '#10b981' : 
                              index === trajectoryPoints.length - 1 ? '#8b5cf6' : 
                              '#60a5fa'}
                      />
                      {index === 0 && (
                        <text x={x} y={y - 10} textAnchor="middle" fill="#10b981" fontSize="12">
                          Launch
                        </text>
                      )}
                      {index === trajectoryPoints.length - 1 && (
                        <text x={x} y={y - 10} textAnchor="middle" fill="#8b5cf6" fontSize="12">
                          Orbit
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )}

            {/* Launch site marker */}
            <g>
              <circle
                cx={centerX}
                cy={centerY}
                r={8}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={12}
                fill="none"
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text x={centerX} y={centerY - 15} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                {launchSite.name}
              </text>
            </g>

            {/* Compass */}
            <g transform={`translate(${mapWidth - 60}, 40)`}>
              <circle cx="0" cy="0" r="20" fill="rgba(0, 0, 0, 0.5)" stroke="#6b7280" strokeWidth="1" />
              <text x="0" y="-8" textAnchor="middle" fill="#ffffff" fontSize="10">N</text>
              <text x="0" y="12" textAnchor="middle" fill="#ffffff" fontSize="10">S</text>
              <text x="12" y="2" textAnchor="middle" fill="#ffffff" fontSize="10">E</text>
              <text x="-12" y="2" textAnchor="middle" fill="#ffffff" fontSize="10">W</text>
              <line x1="0" y1="-15" x2="0" y2="15" stroke="#6b7280" strokeWidth="1" />
              <line x1="-15" y1="0" x2="15" y2="0" stroke="#6b7280" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-space-dark/80 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
          <h4 className="font-semibold text-sm mb-2">Legend</h4>
          <div className="space-y-2 text-xs">
            {viewMode === 'visibility' ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span>High Visibility</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <span>Medium Visibility</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <span>Low Visibility</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  <span>Launch Site</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  <span>Launch Site</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  <span>Ascent Path</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                  <span>Orbit Insertion</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats overlay */}
        <div className="absolute top-4 right-4 bg-space-dark/80 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
          <h4 className="font-semibold text-sm mb-2">Viewing Statistics</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Area:</span>
              <span>~500,000 km²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Population:</span>
              <span>~25 million</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Best Viewing:</span>
              <span className="text-green-400">Florida Coast</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Window:</span>
              <span>4-6 minutes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Region details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-space-dark/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Primary Viewing Zone</h4>
            <Eye className="h-4 w-4 text-green-400" />
          </div>
          <p className="text-xs text-gray-400">Florida peninsula and coastal regions</p>
          <div className="mt-2 flex items-center space-x-2 text-xs">
            <span className="text-gray-400">Visibility:</span>
            <span className="text-green-400 font-semibold">Excellent</span>
          </div>
        </div>

        <div className="bg-space-dark/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Secondary Zone</h4>
            <Eye className="h-4 w-4 text-yellow-400" />
          </div>
          <p className="text-xs text-gray-400">Southeast US and Bahamas</p>
          <div className="mt-2 flex items-center space-x-2 text-xs">
            <span className="text-gray-400">Visibility:</span>
            <span className="text-yellow-400 font-semibold">Good</span>
          </div>
        </div>

        <div className="bg-space-dark/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Limited Zone</h4>
            <EyeOff className="h-4 w-4 text-red-400" />
          </div>
          <p className="text-xs text-gray-400">Northern regions and inland areas</p>
          <div className="mt-2 flex items-center space-x-2 text-xs">
            <span className="text-gray-400">Visibility:</span>
            <span className="text-red-400 font-semibold">Poor</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
        <div className="flex items-start space-x-3">
          <MapPin className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Viewing Tips</h4>
            <ul className="text-xs text-gray-400 mt-2 space-y-1">
              <li>• Look east from the launch site 2-3 minutes after liftoff</li>
              <li>• Best viewing within 200km of the launch site</li>
              <li>• Clear skies provide optimal visibility conditions</li>
              <li>• Use binoculars for enhanced viewing of staging events</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewingMap