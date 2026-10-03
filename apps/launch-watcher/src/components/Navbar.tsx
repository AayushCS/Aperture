import { Rocket, Satellite, Globe, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="border-b border-space-blue/30 bg-space-dark/90 backdrop-blur-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Aperture
              </h1>
              <p className="text-xs text-gray-400">Orbital Launch Window Planner</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2 text-gray-300 hover:text-white transition">
              <Globe className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link to="/planner" className="flex items-center space-x-2 text-gray-300 hover:text-white transition">
              <Satellite className="h-4 w-4" />
              <span>Launch Planner</span>
            </Link>
            <Link to="/visualizer" className="flex items-center space-x-2 text-gray-300 hover:text-white transition">
              <Rocket className="h-4 w-4" />
              <span>Orbit Visualizer</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm">System Online</span>
              </div>
              <Button variant="outline" size="sm" className="border-blue-500 text-blue-400 hover:bg-blue-500/10">
                Mission Control
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-space-blue/30 pt-4">
            <div className="flex flex-col space-y-4">
              <Link 
                to="/" 
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-space-blue/20"
                onClick={() => setIsMenuOpen(false)}
              >
                <Globe className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/planner" 
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-space-blue/20"
                onClick={() => setIsMenuOpen(false)}
              >
                <Satellite className="h-5 w-5" />
                <span>Launch Planner</span>
              </Link>
              <Link 
                to="/visualizer" 
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-space-blue/20"
                onClick={() => setIsMenuOpen(false)}
              >
                <Rocket className="h-5 w-5" />
                <span>Orbit Visualizer</span>
              </Link>
              
              <div className="pt-4 border-t border-space-blue/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>System Online</span>
                  </div>
                  <Button variant="outline" size="sm" className="border-blue-500 text-blue-400">
                    Mission Control
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar