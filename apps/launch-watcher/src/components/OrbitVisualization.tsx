import { useState, useEffect, useRef } from 'react'
import { Orbit, ZoomIn, ZoomOut, RotateCw, Globe } from 'lucide-react'
import { Button } from './ui/Button'

interface OrbitVisualizationProps {
  orbitType: 'LEO' | 'POLAR' | 'SSO'
  altitude: number // km
  inclination: number // degrees
}

const OrbitVisualization = ({ orbitType, altitude, inclination }: OrbitVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const earthRadius = Math.min(centerX, centerY) * 0.3 * zoom
    const orbitRadius = earthRadius + (altitude / 1000) * 10 // Scale for visualization

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw space background
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, canvas.width / 2)
    gradient.addColorStop(0, '#0a0e17')
    gradient.addColorStop(1, '#1e3a8a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw stars
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const size = Math.random() * 2
      const opacity = Math.random() * 0.5 + 0.5
      
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
      ctx.fill()
    }

    // Draw Earth
    const earthGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, earthRadius
    )
    earthGradient.addColorStop(0, '#1e40af')
    earthGradient.addColorStop(0.5, '#1d4ed8')
    earthGradient.addColorStop(1, '#3b82f6')
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2)
    ctx.fillStyle = earthGradient
    ctx.fill()

    // Draw orbit path
    ctx.beginPath()
    ctx.ellipse(
      centerX,
      centerY,
      orbitRadius,
      orbitRadius * Math.sin(inclination * Math.PI / 180),
      rotation * Math.PI / 180,
      0,
      Math.PI * 2
    )
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])

    // Draw satellite
    const satelliteAngle = (Date.now() / 5000) * 360 // Animated angle
    const satX = centerX + orbitRadius * Math.cos((satelliteAngle + rotation) * Math.PI / 180)
    const satY = centerY + orbitRadius * Math.sin(inclination * Math.PI / 180) * Math.sin((satelliteAngle + rotation) * Math.PI / 180)
    
    // Satellite glow
    const satGlow = ctx.createRadialGradient(satX, satY, 0, satX, satY, 20)
    satGlow.addColorStop(0, 'rgba(96, 165, 250, 0.8)')
    satGlow.addColorStop(1, 'rgba(96, 165, 250, 0)')
    
    ctx.beginPath()
    ctx.arc(satX, satY, 20, 0, Math.PI * 2)
    ctx.fillStyle = satGlow
    ctx.fill()

    // Satellite body
    ctx.beginPath()
    ctx.arc(satX, satY, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()
    
    ctx.beginPath()
    ctx.arc(satX, satY, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Draw launch site (KSC)
    const launchSiteAngle = -80.65 // KSC longitude
    const launchRadius = earthRadius + 5
    const launchX = centerX + launchRadius * Math.cos(launchSiteAngle * Math.PI / 180)
    const launchY = centerY + launchRadius * Math.sin(launchSiteAngle * Math.PI / 180)
    
    ctx.beginPath()
    ctx.arc(launchX, launchY, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#10b981'
    ctx.fill()

    // Draw launch trajectory
    ctx.beginPath()
    ctx.moveTo(launchX, launchY)
    ctx.lineTo(satX, satY)
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // Draw orbit type label
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(`${orbitType} Orbit`, centerX, 30)
    
    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(`${altitude} km • ${inclination}° inclination`, centerX, 50)

    // Draw compass
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.textAlign = 'center'
    ctx.fillText('N', centerX, centerY - earthRadius - 20)
    ctx.fillText('S', centerX, centerY + earthRadius + 30)
    ctx.fillText('E', centerX + earthRadius + 20, centerY + 5)
    ctx.fillText('W', centerX - earthRadius - 20, centerY + 5)

  }, [zoom, rotation, altitude, inclination, orbitType, isAnimating])

  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        setRotation(prev => (prev + 0.5) % 360)
      }, 50)
      return () => clearInterval(interval)
    }
  }, [isAnimating])

  const orbitInfo = {
    LEO: { color: '#60a5fa', description: 'Low Earth Orbit - Fast orbital period' },
    POLAR: { color: '#8b5cf6', description: 'Polar Orbit - Covers entire Earth surface' },
    SSO: { color: '#ec4899', description: 'Sun-Synchronous Orbit - Constant illumination' },
  }

  const info = orbitInfo[orbitType]

  return (
    <div className="space-y-4">
      {/* Visualization canvas */}
      <div className="relative rounded-xl overflow-hidden bg-space-dark border border-space-blue/30">
        <canvas
          ref={canvasRef}
          className="w-full h-64 md:h-80"
        />
        
        {/* Controls */}
        <div className="absolute bottom-4 left-4 flex space-x-2">
          <Button
            size="icon"
            variant="outline"
            className="bg-space-dark/80 border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={() => setZoom(prev => Math.min(2, prev + 0.2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="bg-space-dark/80 border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="bg-space-dark/80 border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={() => setIsAnimating(!isAnimating)}
          >
            <RotateCw className={`h-4 w-4 ${isAnimating ? 'text-blue-400' : 'text-gray-300'}`} />
          </Button>
        </div>

        {/* Orbit info */}
        <div className="absolute top-4 right-4 bg-space-dark/80 backdrop-blur-sm rounded-lg p-3 border border-gray-700 max-w-xs">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1 rounded bg-blue-500/20">
              <Orbit className="h-4 w-4 text-blue-400" />
            </div>
            <h4 className="font-semibold">Orbit Details</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Type:</span>
              <span className="font-medium">{orbitType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Altitude:</span>
              <span className="font-medium">{altitude} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Inclination:</span>
              <span className="font-medium">{inclination}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Period:</span>
              <span className="font-medium">~{Math.round(2 * Math.PI * Math.sqrt(Math.pow(6371 + altitude, 3) / 398600) / 60)} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend and info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-space-dark/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-blue-500"></div>
            <span className="text-sm font-medium">Orbit Path</span>
          </div>
          <p className="text-xs text-gray-400">The elliptical path followed by the satellite</p>
        </div>
        
        <div className="bg-space-dark/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium">Launch Site</span>
          </div>
          <p className="text-xs text-gray-400">Kennedy Space Center (28.57°N, 80.65°W)</p>
        </div>
        
        <div className="bg-space-dark/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-white"></div>
            <span className="text-sm font-medium">Satellite</span>
          </div>
          <p className="text-xs text-gray-400">Current position in orbit (animated)</p>
        </div>
      </div>

      {/* Orbit type description */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
        <div className="flex items-center space-x-3">
          <Globe className="h-5 w-5 text-blue-400" />
          <div>
            <h4 className="font-semibold">{orbitType} Characteristics</h4>
            <p className="text-sm text-gray-400 mt-1">{info.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrbitVisualization