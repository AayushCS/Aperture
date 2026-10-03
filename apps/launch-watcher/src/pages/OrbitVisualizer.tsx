import { useState } from 'react'
import { Globe, Orbit, Satellite, Target, Zap, RefreshCw, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import OrbitVisualization from '@/components/OrbitVisualization'

const OrbitVisualizer = () => {
  const [selectedOrbit, setSelectedOrbit] = useState<'LEO' | 'POLAR' | 'SSO'>('LEO')
  const [altitude, setAltitude] = useState(400)
  const [inclination, setInclination] = useState(45.1)
  const [isAnimating, setIsAnimating] = useState(true)
  const [timeSpeed, setTimeSpeed] = useState(1)

  const orbits = [
    { type: 'LEO', altitude: 400, inclination: 45.1, color: 'blue', description: 'Low Earth Orbit - ISS, Starlink, Earth observation' },
    { type: 'POLAR', altitude: 700, inclination: 90, color: 'purple', description: 'Polar Orbit - Weather, reconnaissance, global mapping' },
    { type: 'SSO', altitude: 600, inclination: 98.1, color: 'pink', description: 'Sun-Synchronous Orbit - Constant lighting conditions' },
  ]

  const orbitalStats = [
    { label: 'Orbital Period', value: '~90 minutes', icon: <RefreshCw className="h-4 w-4" /> },
    { label: 'Velocity', value: '7.8 km/s', icon: <Zap className="h-4 w-4" /> },
    { label: 'Revolutions/Day', value: '~16', icon: <Orbit className="h-4 w-4" /> },
    { label: 'Ground Track', value: 'Shifts westward', icon: <Globe className="h-4 w-4" /> },
  ]

  const handleSelectOrbit = (orbit: typeof orbits[0]) => {
    setSelectedOrbit(orbit.type as 'LEO' | 'POLAR' | 'SSO')
    setAltitude(orbit.altitude)
    setInclination(orbit.inclination)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orbit Visualizer</h1>
          <p className="text-gray-400">Interactive 3D visualization of orbital mechanics</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            className="flex items-center space-x-2"
            onClick={() => setIsAnimating(!isAnimating)}
          >
            {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isAnimating ? 'Pause' : 'Play'}</span>
          </Button>
          <Button variant="space" className="flex items-center space-x-2">
            <Satellite className="h-4 w-4" />
            <span>New Simulation</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Visualization */}
        <div className="lg:col-span-2">
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  <span>Orbit Visualization</span>
                </h2>
                <p className="text-gray-400">Real-time simulation of selected orbit</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-400">Time Speed:</div>
                <div className="flex space-x-1">
                  {[0.25, 0.5, 1, 2, 4].map((speed) => (
                    <Button
                      key={speed}
                      variant={timeSpeed === speed ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimeSpeed(speed)}
                      className="h-8 w-8"
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <OrbitVisualization 
              orbitType={selectedOrbit}
              altitude={altitude}
              inclination={inclination}
            />

            {/* Controls */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-space-dark/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">Altitude</span>
                </div>
                <div className="text-2xl font-bold">{altitude} km</div>
                <input
                  type="range"
                  min="160"
                  max="2000"
                  value={altitude}
                  onChange={(e) => setAltitude(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              <div className="bg-space-dark/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Orbit className="h-4 w-4 text-purple-400" />
                  <span className="font-medium">Inclination</span>
                </div>
                <div className="text-2xl font-bold">{inclination.toFixed(1)}°</div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="0.1"
                  value={inclination}
                  onChange={(e) => setInclination(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              <div className="bg-space-dark/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <RefreshCw className="h-4 w-4 text-green-400" />
                  <span className="font-medium">Period</span>
                </div>
                <div className="text-2xl font-bold">
                  {Math.round(2 * Math.PI * Math.sqrt(Math.pow(6371 + altitude, 3) / 398600) / 60)} min
                </div>
                <div className="text-sm text-gray-400 mt-2">Orbital period</div>
              </div>

              <div className="bg-space-dark/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="font-medium">Velocity</span>
                </div>
                <div className="text-2xl font-bold">
                  {Math.sqrt(398600 / (6371 + altitude)).toFixed(1)} km/s
                </div>
                <div className="text-sm text-gray-400 mt-2">Orbital velocity</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Orbit Selection */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <h3 className="font-semibold mb-4">Orbit Types</h3>
            <div className="space-y-3">
              {orbits.map((orbit) => (
                <button
                  key={orbit.type}
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    selectedOrbit === orbit.type
                      ? `border-${orbit.color}-500 bg-${orbit.color}-500/10`
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => handleSelectOrbit(orbit)}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{orbit.type}</div>
                    <div className={`h-3 w-3 rounded-full bg-${orbit.color}-500`}></div>
                  </div>
                  <div className="text-sm text-gray-400 mt-2">{orbit.description}</div>
                  <div className="flex justify-between mt-3 text-sm">
                    <span>{orbit.altitude} km</span>
                    <span>{orbit.inclination}°</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Orbital Statistics */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <h3 className="font-semibold mb-4">Orbital Statistics</h3>
            <div className="space-y-4">
              {orbitalStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-space-dark/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <div className="text-blue-400">{stat.icon}</div>
                    </div>
                    <div>
                      <div className="font-medium">{stat.label}</div>
                    </div>
                  </div>
                  <div className="font-bold">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Data */}
          <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
            <h3 className="font-semibold mb-4">Live Data Feed</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Satellite Count:</span>
                <span className="font-medium">2,857</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Active Missions:</span>
                <span className="font-medium text-green-400">142</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Orbital Debris:</span>
                <span className="font-medium text-yellow-400">~23,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Next Pass:</span>
                <span className="font-medium">T+12m 34s</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <h4 className="font-medium mb-3">Ground Stations</h4>
              <div className="space-y-2">
                {[
                  { name: 'Kourou, French Guiana', status: 'active' },
                  { name: 'Goldstone, USA', status: 'active' },
                  { name: 'Canberra, Australia', status: 'standby' },
                  { name: 'Svalbard, Norway', status: 'active' },
                ].map((station, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${station.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="text-sm">{station.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{station.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orbit Characteristics */}
        <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <h3 className="font-semibold mb-4">Orbit Characteristics</h3>
          <div className="space-y-4">
            {selectedOrbit === 'LEO' && (
              <>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <h4 className="font-medium text-blue-400 mb-1">Typical Uses</h4>
                  <p className="text-sm text-gray-400">Earth observation, telecommunications, ISS resupply, technology demonstration</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <h4 className="font-medium text-blue-400 mb-1">Advantages</h4>
                  <p className="text-sm text-gray-400">Low latency communications, frequent revisit times, lower launch costs</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <h4 className="font-medium text-blue-400 mb-1">Challenges</h4>
                  <p className="text-sm text-gray-400">Atmospheric drag, limited coverage area, orbital decay</p>
                </div>
              </>
            )}
            {selectedOrbit === 'POLAR' && (
              <>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <h4 className="font-medium text-purple-400 mb-1">Typical Uses</h4>
                  <p className="text-sm text-gray-400">Weather monitoring, Earth mapping, reconnaissance, climate research</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <h4 className="font-medium text-purple-400 mb-1">Advantages</h4>
                  <p className="text-sm text-gray-400">Global coverage, sun-synchronous options, stable lighting conditions</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <h4 className="font-medium text-purple-400 mb-1">Challenges</h4>
                  <p className="text-sm text-gray-400">Higher launch energy required, limited launch sites, radiation exposure</p>
                </div>
              </>
            )}
            {selectedOrbit === 'SSO' && (
              <>
                <div className="p-3 bg-pink-500/10 rounded-lg">
                  <h4 className="font-medium text-pink-400 mb-1">Typical Uses</h4>
                  <p className="text-sm text-gray-400">Remote sensing, environmental monitoring, agricultural assessment</p>
                </div>
                <div className="p-3 bg-pink-500/10 rounded-lg">
                  <h4 className="font-medium text-pink-400 mb-1">Advantages</h4>
                  <p className="text-sm text-gray-400">Constant sunlight for solar power, consistent imaging conditions</p>
                </div>
                <div className="p-3 bg-pink-500/10 rounded-lg">
                  <h4 className="font-medium text-pink-400 mb-1">Challenges</h4>
                  <p className="text-sm text-gray-400">Specific inclination requirements, limited ground track coverage</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <h3 className="font-semibold mb-4">Simulation Controls</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Time Acceleration</label>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTimeSpeed(Math.max(0.25, timeSpeed / 2))}
                >
                  Slower
                </Button>
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold">{timeSpeed}x</div>
                  <div className="text-xs text-gray-400">Speed</div>
                </div>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTimeSpeed(Math.min(8, timeSpeed * 2))}
                >
                  Faster
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">View Options</label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="justify-center">
                  Top View
                </Button>
                <Button variant="outline" className="justify-center">
                  Side View
                </Button>
                <Button variant="outline" className="justify-center">
                  Follow Satellite
                </Button>
                <Button variant="outline" className="justify-center">
                  Earth Fixed
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Display Elements</label>
              <div className="space-y-2">
                {[
                  { label: 'Orbit Path', checked: true },
                  { label: 'Ground Track', checked: true },
                  { label: 'Satellite Model', checked: true },
                  { label: 'Atmosphere', checked: false },
                  { label: 'Orbital Plane', checked: false },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => {}}
                        className="sr-only"
                      />
                      <div className={`h-6 w-11 rounded-full transition ${item.checked ? 'bg-blue-500' : 'bg-gray-700'}`}>
                        <div className={`h-5 w-5 rounded-full bg-white transform transition ${item.checked ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <Button variant="space" className="w-full">
                Export Simulation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrbitVisualizer