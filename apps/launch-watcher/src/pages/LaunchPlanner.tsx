import { useState } from 'react'
import { Calendar, Calculator, Target, Rocket, MapPin, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { orbitalEngine, COMMON_LAUNCH_SITES, COMMON_VEHICLES } from '@aperture/orbital-core'
import type { CalculationInput, LaunchWindow } from '@aperture/orbital-core'

const LaunchPlanner = () => {
  const [orbitType, setOrbitType] = useState<'LEO' | 'POLAR' | 'SSO'>('LEO')
  const [altitude, setAltitude] = useState(400)
  const [inclination, setInclination] = useState(45.1)
  const [launchSite, setLaunchSite] = useState(COMMON_LAUNCH_SITES.KSC)
  const [vehicle, setVehicle] = useState(COMMON_VEHICLES.FALCON_9)
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  })
  const [launchWindows, setLaunchWindows] = useState<LaunchWindow[]>([])
  const [isCalculating, setIsCalculating] = useState(false)

  const handleCalculate = () => {
    setIsCalculating(true)
    
    // Simulate calculation with mock data
    setTimeout(() => {
      const mockWindows: LaunchWindow[] = []
      const baseDate = new Date(dateRange.start)
      
      for (let i = 0; i < 5; i++) {
        const start = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000) // 8 AM each day
        mockWindows.push({
          start,
          end: new Date(start.getTime() + 30 * 60 * 1000),
          duration: 30 * 60,
          quality: 0.6 + Math.random() * 0.3,
          weatherRisk: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
          visibilityRegions: [],
        })
      }
      
      setLaunchWindows(mockWindows)
      setIsCalculating(false)
    }, 1500)
  }

  const orbitTypes = [
    { value: 'LEO', label: 'Low Earth Orbit', desc: '~45.1° inclination, 160-2000 km' },
    { value: 'POLAR', label: 'Polar Orbit', desc: '87.9°-90° inclination, global coverage' },
    { value: 'SSO', label: 'Sun-Synchronous Orbit', desc: '~98.1° inclination, constant illumination' },
  ]

  const launchSites = Object.values(COMMON_LAUNCH_SITES)
  const vehicles = Object.values(COMMON_VEHICLES)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Launch Window Planner</h1>
          <p className="text-gray-400">Calculate optimal launch times based on orbital requirements</p>
        </div>
        <Button variant="space" className="flex items-center space-x-2">
          <Calculator className="h-4 w-4" />
          <span>Calculate Windows</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Orbit Configuration */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <div className="flex items-center space-x-2 mb-6">
              <Target className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-semibold">Orbit Configuration</h2>
            </div>

            {/* Orbit Type Selection */}
            <div className="mb-6">
              <h3 className="font-medium mb-3">Orbit Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {orbitTypes.map((type) => (
                  <button
                    key={type.value}
                    className={`p-4 rounded-xl border text-left transition ${
                      orbitType === type.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => {
                      setOrbitType(type.value as 'LEO' | 'POLAR' | 'SSO')
                      // Set default inclination for orbit type
                      if (type.value === 'LEO') setInclination(45.1)
                      if (type.value === 'POLAR') setInclination(90.0)
                      if (type.value === 'SSO') setInclination(98.1)
                    }}
                  >
                    <div className="font-medium">{type.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Altitude and Inclination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Altitude (km)
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min="160"
                    max="2000"
                    step="10"
                    value={altitude}
                    onChange={(e) => setAltitude(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>160</span>
                    <span>2000</span>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-2xl font-bold">{altitude}</span>
                    <span className="text-gray-400 ml-1">km</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Inclination (°)
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="0.1"
                    value={inclination}
                    onChange={(e) => setInclination(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0°</span>
                    <span>180°</span>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-2xl font-bold">{inclination.toFixed(1)}</span>
                    <span className="text-gray-400 ml-1">°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Configuration */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <div className="flex items-center space-x-2 mb-6">
              <Rocket className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-semibold">Launch Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Launch Site Selection */}
              <div>
                <h3 className="font-medium mb-3 flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>Launch Site</span>
                </h3>
                <div className="space-y-2">
                  {launchSites.map((site) => (
                    <button
                      key={site.name}
                      className={`w-full p-3 rounded-lg border text-left ${
                        launchSite.name === site.name
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => setLaunchSite(site)}
                    >
                      <div className="font-medium">{site.name}</div>
                      <div className="text-sm text-gray-400">
                        {site.latitude.toFixed(2)}°N, {site.longitude.toFixed(2)}°E
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Selection */}
              <div>
                <h3 className="font-medium mb-3 flex items-center space-x-2">
                  <Rocket className="h-4 w-4" />
                  <span>Launch Vehicle</span>
                </h3>
                <div className="space-y-2">
                  {vehicles.map((vehicleItem) => (
                    <button
                      key={vehicleItem.name}
                      className={`w-full p-3 rounded-lg border text-left ${
                        vehicle.name === vehicleItem.name
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => setVehicle(vehicleItem)}
                    >
                      <div className="font-medium">{vehicleItem.name}</div>
                      <div className="text-sm text-gray-400">
                        Inclination: {vehicleItem.minInclination}°-{vehicleItem.maxInclination}°
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="mt-6">
              <h3 className="font-medium mb-3 flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Date Range</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                    value={dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                    value={dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <div className="flex justify-center">
            <Button
              variant="space"
              size="lg"
              className="px-8 py-6 text-lg"
              onClick={handleCalculate}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Calculating Windows...
                </>
              ) : (
                <>
                  <Calculator className="h-5 w-5 mr-2" />
                  Calculate Launch Windows
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <h3 className="font-semibold mb-4">Mission Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Orbit Type:</span>
                <span className="font-medium">{orbitType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Altitude:</span>
                <span className="font-medium">{altitude} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Inclination:</span>
                <span className="font-medium">{inclination.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Launch Site:</span>
                <span className="font-medium">{launchSite.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vehicle:</span>
                <span className="font-medium">{vehicle.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Range:</span>
                <span className="font-medium">
                  {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Compatibility Check */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h4 className="font-medium mb-3">Compatibility Check</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Inclination Range:</span>
                  <span className={`text-sm ${inclination >= vehicle.minInclination && inclination <= vehicle.maxInclination ? 'text-green-400' : 'text-red-400'}`}>
                    {inclination >= vehicle.minInclination && inclination <= vehicle.maxInclination ? '✓ Compatible' : '✗ Out of Range'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Launch Site Latitude:</span>
                  <span className="text-sm text-green-400">✓ Valid</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Orbit Type Match:</span>
                  <span className="text-sm text-green-400">✓ Supported</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Advanced Settings
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Save Mission Profile
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Target className="h-4 w-4 mr-2" />
                Compare Scenarios
              </Button>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
            <h4 className="font-semibold text-sm mb-2">Planning Tips</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• LEO: Optimal for ISS resupply and Earth observation</li>
              <li>• Polar: Best for global coverage and reconnaissance</li>
              <li>• SSO: Ideal for consistent lighting conditions</li>
              <li>• Consider weather patterns for launch site selection</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {launchWindows.length > 0 && (
        <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Calculated Launch Windows</h2>
            <div className="text-sm text-gray-400">
              Found {launchWindows.length} windows
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-space-blue/30">
                  <th className="pb-3">Date & Time</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Weather Risk</th>
                  <th className="pb-3">Quality</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {launchWindows.map((window, index) => (
                  <tr key={index} className="border-b border-space-blue/10 hover:bg-space-blue/5">
                    <td className="py-4">
                      <div className="font-medium">{window.start.toLocaleDateString()}</div>
                      <div className="text-sm text-gray-400">
                        {window.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                      </div>
                    </td>
                    <td className="py-4">
                      {(window.duration / 60).toFixed(0)} minutes
                    </td>
                    <td className="py-4">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        window.weatherRisk === 'low' ? 'bg-green-500/20 text-green-400' :
                        window.weatherRisk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {window.weatherRisk.charAt(0).toUpperCase() + window.weatherRisk.slice(1)}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{ width: `${window.quality * 100}%` }}
                          />
                        </div>
                        <span className="text-sm">{(window.quality * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" className="text-blue-400">
                          Select
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-400">
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Best Window Recommendation */}
          {launchWindows.length > 0 && (
            <div className="mt-6 pt-6 border-t border-space-blue/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Recommended Window</h4>
                  <p className="text-sm text-gray-400">
                    {launchWindows[0].start.toLocaleDateString()} at{' '}
                    {launchWindows[0].start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Button variant="space">
                  Plan This Mission
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LaunchPlanner