import { Cloud, CloudRain, Sun, Wind, Zap } from 'lucide-react'

interface WeatherIndicatorProps {
  riskLevel: 'low' | 'medium' | 'high'
}

const WeatherIndicator = ({ riskLevel }: WeatherIndicatorProps) => {
  const riskConfig = {
    low: {
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      label: 'Go for Launch',
      icon: <Sun className="h-8 w-8" />,
    },
    medium: {
      color: 'from-yellow-500 to-amber-500',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
      label: 'Marginal Conditions',
      icon: <Cloud className="h-8 w-8" />,
    },
    high: {
      color: 'from-red-500 to-pink-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
      label: 'Launch Hold',
      icon: <CloudRain className="h-8 w-8" />,
    },
  }

  const config = riskConfig[riskLevel]

  const weatherMetrics = [
    { label: 'Wind Speed', value: '12 knots', icon: <Wind className="h-4 w-4" />, status: 'nominal' },
    { label: 'Cloud Cover', value: '40%', icon: <Cloud className="h-4 w-4" />, status: 'nominal' },
    { label: 'Visibility', value: '10 miles', icon: <Sun className="h-4 w-4" />, status: 'nominal' },
    { label: 'Lightning', value: '5%', icon: <Zap className="h-4 w-4" />, status: 'low' },
  ]

  return (
    <div className="space-y-6">
      {/* Main weather indicator */}
      <div className={`rounded-2xl p-6 ${config.bgColor} border ${config.textColor.replace('text-', 'border-')}/30`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className={`p-3 rounded-xl ${config.bgColor}`}>
                <div className={config.textColor}>
                  {config.icon}
                </div>
              </div>
              <div>
                <h3 className={`text-2xl font-bold ${config.textColor}`}>{config.label}</h3>
                <p className="text-gray-400">Current launch conditions</p>
              </div>
            </div>
          </div>
          
          {/* Risk level indicator */}
          <div className="text-center">
            <div className={`text-4xl font-bold bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
              {riskLevel.toUpperCase()}
            </div>
            <div className="text-sm text-gray-400">Risk Level</div>
          </div>
        </div>

        {/* Risk meter */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Low Risk</span>
            <span>High Risk</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${config.color} rounded-full transition-all duration-500`}
              style={{ 
                width: riskLevel === 'low' ? '25%' : riskLevel === 'medium' ? '60%' : '90%' 
              }}
            />
            <div className="flex justify-between mt-1">
              {['LOW', 'MEDIUM', 'HIGH'].map((level, index) => (
                <div 
                  key={index}
                  className={`text-xs ${riskLevel.toLowerCase() === level.toLowerCase() ? config.textColor : 'text-gray-500'}`}
                >
                  {level}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weather metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {weatherMetrics.map((metric, index) => (
          <div key={index} className="bg-space-dark/50 rounded-xl p-4 border border-space-blue/30">
            <div className="flex items-center space-x-2 mb-2">
              <div className={`p-2 rounded-lg ${
                metric.status === 'nominal' ? 'bg-green-500/20 text-green-400' :
                metric.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {metric.icon}
              </div>
              <span className="text-sm text-gray-400">{metric.label}</span>
            </div>
            <div className="text-xl font-bold">{metric.value}</div>
            <div className={`text-xs mt-1 ${
              metric.status === 'nominal' ? 'text-green-400' :
              metric.status === 'warning' ? 'text-yellow-400' :
              'text-blue-400'
            }`}>
              {metric.status === 'nominal' ? 'Within limits' :
               metric.status === 'warning' ? 'Approaching limits' :
               'Below threshold'}
            </div>
          </div>
        ))}
      </div>

      {/* Forecast timeline */}
      <div className="bg-space-dark/30 rounded-xl p-4">
        <h4 className="font-semibold mb-3 text-gray-300">Next 6 Hours Forecast</h4>
        <div className="flex space-x-4 overflow-x-auto pb-2">
          {[0, 1, 2, 3, 4, 5, 6].map((hour) => (
            <div key={hour} className="flex flex-col items-center min-w-[80px]">
              <div className="text-sm text-gray-400">
                {hour === 0 ? 'Now' : `+${hour}h`}
              </div>
              <div className={`p-2 rounded-lg my-2 ${
                hour === 0 ? 'bg-yellow-500/20' :
                hour <= 2 ? 'bg-green-500/20' :
                hour <= 4 ? 'bg-yellow-500/20' :
                'bg-red-500/20'
              }`}>
                {hour <= 2 ? <Sun className="h-6 w-6 text-yellow-400" /> :
                 hour <= 4 ? <Cloud className="h-6 w-6 text-yellow-400" /> :
                 <CloudRain className="h-6 w-6 text-red-400" />}
              </div>
              <div className={`text-xs font-semibold ${
                hour === 0 ? 'text-yellow-400' :
                hour <= 2 ? 'text-green-400' :
                hour <= 4 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {hour <= 2 ? 'Low' : hour <= 4 ? 'Medium' : 'High'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WeatherIndicator