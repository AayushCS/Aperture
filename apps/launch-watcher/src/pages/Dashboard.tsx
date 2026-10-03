import { useState, useEffect } from 'react'
import { Clock, Cloud, Globe, Map, Satellite, Target, TrendingUp, Users } from 'lucide-react'
import CountdownTimer from '@/components/CountdownTimer'
import WeatherIndicator from '@/components/WeatherIndicator'
import OrbitVisualization from '@/components/OrbitVisualization'
import ViewingMap from '@/components/ViewingMap'
import { Button } from '@/components/ui/Button'
import { orbitalEngine, COMMON_LAUNCH_SITES, COMMON_VEHICLES } from '@aperture/orbital-core'
import type { LaunchWindow } from '@aperture/orbital-core'

const Dashboard = () => {
  const [nextLaunch, setNextLaunch] = useState<LaunchWindow | null>(null)
  const [launchWindows, setLaunchWindows] = useState<LaunchWindow[]>([])

  useEffect(() => {
    // Mock data for dashboard - in real app this would come from API
    const mockNextLaunch: LaunchWindow = {
      start: new Date(Date.now() + 4 * 60 * 60 * 1000 + 32 * 60 * 1000), // 4h 32m from now
      end: new Date(Date.now() + 5 * 60 * 60 * 1000),
      duration: 30 * 60, // 30 minutes
      quality: 0.85,
      weatherRisk: 'medium',
      visibilityRegions: [
        {
          latitude: 28.5729,
          longitude: -80.6489,
          radius: 100,
          visibilityStart: new Date(Date.now() + 4 * 60 * 60 * 1000 + 32 * 60 * 1000),
          visibilityEnd: new Date(Date.now() + 5 * 60 * 60 * 1000),
        },
      ],
    }

    setNextLaunch(mockNextLaunch)

    // Generate mock launch windows for the next 7 days
    const mockWindows: LaunchWindow[] = []
    for (let i = 0; i < 7; i++) {
      const start = new Date(Date.now() + i * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000) // 8 AM each day
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
  }, [])

  const stats = [
    { label: 'Active Missions', value: '3', icon: <Satellite />, change: '+1' },
    { label: 'Launch Windows', value: '12', icon: <Target />, change: '+3' },
    { label: 'Weather Risk', value: 'Medium', icon: <Cloud />, change: 'Stable' },
    { label: 'Ground Stations', value: '8', icon: <Globe />, change: 'All Online' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mission Control Dashboard</h1>
          <p className="text-gray-400">Real-time orbital launch window monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="space" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>New Mission Plan</span>
          </Button>
          <Button variant="outline" className="border-blue-500 text-blue-400">
            Export Report
          </Button>
        </div>
      </div>

      {/* Countdown Timer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-400" />
                <span>Next Launch Window</span>
              </h2>
              <p className="text-gray-400 text-sm">Starlink 6-45 • Falcon 9 • Kennedy Space Center</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm">Vehicle Ready</span>
            </div>
          </div>

          {nextLaunch && <CountdownTimer targetDate={nextLaunch.start} />}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-space-blue/20 p-4 rounded-xl">
              <p className="text-sm text-gray-400">Window Duration</p>
              <p className="text-xl font-bold">30 min</p>
            </div>
            <div className="bg-space-blue/20 p-4 rounded-xl">
              <p className="text-sm text-gray-400">Orbit Type</p>
              <p className="text-xl font-bold">LEO</p>
            </div>
            <div className="bg-space-blue/20 p-4 rounded-xl">
              <p className="text-sm text-gray-400">Inclination</p>
              <p className="text-xl font-bold">45.1°</p>
            </div>
            <div className="bg-space-blue/20 p-4 rounded-xl">
              <p className="text-sm text-gray-400">Altitude</p>
              <p className="text-xl font-bold">550 km</p>
            </div>
          </div>
        </div>

        {/* Weather Indicator */}
        <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
            <Cloud className="h-5 w-5 text-blue-400" />
            <span>Weather Impact</span>
          </h2>
          <WeatherIndicator riskLevel="medium" />
          
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Wind Speed</span>
              <span className="font-semibold">12 knots</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cloud Cover</span>
              <span className="font-semibold">40%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Visibility</span>
              <span className="font-semibold">10 miles</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Lightning Risk</span>
              <span className="font-semibold text-yellow-400">Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-space-dark/50 rounded-xl p-4 border border-space-blue/30">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-space-blue/20 rounded-lg">
                <div className="text-blue-400">{stat.icon}</div>
              </div>
              <span className={`text-sm ${stat.change.startsWith('+') ? 'text-green-400' : 'text-blue-400'}`}>
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold mt-2">{stat.value}</p>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Visualization and Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-400" />
            <span>Orbit Visualization</span>
          </h2>
          <OrbitVisualization orbitType="LEO" altitude={550} inclination={45.1} />
        </div>

        <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
          <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
            <Map className="h-5 w-5 text-blue-400" />
            <span>Viewing Map</span>
          </h2>
          <ViewingMap launchSite={COMMON_LAUNCH_SITES.KSC} />
          <div className="mt-4 text-sm text-gray-400">
            <p>Best viewing regions highlighted in green. Red areas indicate no visibility.</p>
          </div>
        </div>
      </div>

      {/* Upcoming Launch Windows */}
      <div className="bg-space-dark/50 rounded-2xl p-6 border border-space-blue/30">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <span>Upcoming Launch Windows</span>
          </h2>
          <Button variant="ghost" className="text-blue-400">
            View All
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-space-blue/30">
                <th className="pb-3">Date & Time</th>
                <th className="pb-3">Vehicle</th>
                <th className="pb-3">Orbit</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3">Weather</th>
                <th className="pb-3">Quality</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {launchWindows.slice(0, 5).map((window, index) => (
                <tr key={index} className="border-b border-space-blue/10 hover:bg-space-blue/5">
                  <td className="py-4">
                    <div className="font-medium">{window.start.toLocaleDateString()}</div>
                    <div className="text-sm text-gray-400">{window.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-4">Falcon 9</td>
                  <td className="py-4">LEO</td>
                  <td className="py-4">30 min</td>
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
                    <Button variant="ghost" size="sm" className="text-blue-400">
                      Plan Mission
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard