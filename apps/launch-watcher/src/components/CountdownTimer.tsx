import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  targetDate: Date
}

const CountdownTimer = ({ targetDate }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - Date.now()
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        })
      } else {
        // Launch time has passed
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  const timeUnits = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-1 text-sm text-gray-400">
        <Clock className="h-4 w-4" />
        <span>Launch window opens in:</span>
      </div>
      
      <div className="flex justify-center space-x-4">
        {timeUnits.map((unit, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className="relative">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur-lg opacity-30"></div>
              
              {/* Time unit box */}
              <div className="relative bg-space-dark border border-blue-500/30 rounded-xl w-20 h-20 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {unit.value.toString().padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400 mt-1">{unit.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="pt-4">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Window Preparation</span>
          <span>
            {timeLeft.days === 0 && timeLeft.hours < 1 ? 'CRITICAL' : 
             timeLeft.days === 0 && timeLeft.hours < 4 ? 'URGENT' : 
             timeLeft.days === 0 ? 'IMMINENT' : 'NOMINAL'}
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000"
            style={{ 
              width: `${Math.min(100, 100 - ((timeLeft.hours * 60 + timeLeft.minutes) / (24 * 60)) * 100)}%` 
            }}
          />
        </div>
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center">
          <div className={`h-2 w-2 rounded-full mx-auto mb-1 ${timeLeft.days > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <div className="text-xs text-gray-400">Vehicle</div>
        </div>
        <div className="text-center">
          <div className={`h-2 w-2 rounded-full mx-auto mb-1 ${timeLeft.hours > 2 ? 'bg-green-500' : timeLeft.hours > 1 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <div className="text-xs text-gray-400">Payload</div>
        </div>
        <div className="text-center">
          <div className={`h-2 w-2 rounded-full mx-auto mb-1 ${timeLeft.minutes > 30 ? 'bg-green-500' : timeLeft.minutes > 15 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <div className="text-xs text-gray-400">Weather</div>
        </div>
      </div>
    </div>
  )
}

export default CountdownTimer