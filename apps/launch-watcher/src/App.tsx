import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LaunchPlanner from './pages/LaunchPlanner'
import OrbitVisualizer from './pages/OrbitVisualizer'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="planner" element={<LaunchPlanner />} />
          <Route path="orbit" element={<OrbitVisualizer />} />
          <Route path="visualizer" element={<Navigate to="/orbit" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster theme="dark" position="bottom-right" />
    </>
  )
}
