import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Dashboard from './pages/Dashboard'
import LaunchPlanner from './pages/LaunchPlanner'
import OrbitVisualizer from './pages/OrbitVisualizer'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'

function App() {
  return (
    <div className="min-h-screen space-bg text-white">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/planner" element={<LaunchPlanner />} />
            <Route path="/visualizer" element={<OrbitVisualizer />} />
          </Routes>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}

export default App