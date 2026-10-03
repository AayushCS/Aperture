import { Calendar, Cloud, Map, Target, TrendingUp, Users, Zap } from 'lucide-react'

const Sidebar = () => {
  const menuItems = [
    { icon: <Target />, label: 'Active Missions', count: 3 },
    { icon: <Calendar />, label: 'Launch Schedule', count: 12 },
    { icon: <Cloud />, label: 'Weather Status', count: null },
    { icon: <Map />, label: 'Viewing Maps', count: 8 },
    { icon: <TrendingUp />, label: 'Analytics', count: null },
    { icon: <Users />, label: 'Mission Teams', count: 5 },
    { icon: <Zap />, label: 'System Health', count: null },
  ]

  return (
    <aside className="hidden lg:block w-64 border-r border-space-blue/30 bg-space-dark/50 p-6">
      <div className="space-y-6">
        {/* Mission Stats */}
        <div className="bg-space-blue/20 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-gray-300 mb-2">Mission Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Active Windows</span>
              <span className="text-green-400 font-bold">12</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Weather Risk</span>
              <span className="text-yellow-400 font-bold">Medium</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Next Launch</span>
              <span className="text-blue-400 font-bold">T-4h 32m</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div>
          <h3 className="font-semibold text-sm text-gray-300 mb-3">Navigation</h3>
          <nav className="space-y-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-space-blue/20 transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-gray-400 group-hover:text-blue-400">
                    {item.icon}
                  </div>
                  <span className="text-sm">{item.label}</span>
                </div>
                {item.count !== null && (
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Launch Sites */}
        <div>
          <h3 className="font-semibold text-sm text-gray-300 mb-3">Launch Sites</h3>
          <div className="space-y-2">
            {[
              { name: 'Kennedy Space Center', status: 'active', count: 5 },
              { name: 'Vandenberg SFB', status: 'active', count: 3 },
              { name: 'Baikonur Cosmodrome', status: 'standby', count: 2 },
              { name: 'Guiana Space Centre', status: 'active', count: 4 },
            ].map((site, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-space-blue/10 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${site.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm">{site.name}</span>
                </div>
                <span className="text-xs text-gray-400">{site.count} missions</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-4 border-t border-space-blue/30">
          <h3 className="font-semibold text-sm text-gray-300 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs py-2 px-3 rounded-lg transition">
              New Mission
            </button>
            <button className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs py-2 px-3 rounded-lg transition">
              Run Analysis
            </button>
            <button className="bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs py-2 px-3 rounded-lg transition">
              Export Data
            </button>
            <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs py-2 px-3 rounded-lg transition">
              Emergency Stop
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar