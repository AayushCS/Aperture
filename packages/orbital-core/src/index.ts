/**
 * Aperture Orbital Core
 * High-performance orbital mechanics engine for launch window planning
 */

export * from './types'
export * from './calculations'
export * from './math'

// Common launch sites
export const COMMON_LAUNCH_SITES = {
  KSC: {
    name: 'Kennedy Space Center',
    latitude: 28.5729,
    longitude: -80.6489,
    altitude: 3,
  },
  VANDENBERG: {
    name: 'Vandenberg Space Force Base',
    latitude: 34.7420,
    longitude: -120.5724,
    altitude: 112,
  },
  BAIKONUR: {
    name: 'Baikonur Cosmodrome',
    latitude: 45.965,
    longitude: 63.305,
    altitude: 90,
  },
  GUIANA: {
    name: 'Guiana Space Centre',
    latitude: 5.239,
    longitude: -52.768,
    altitude: 10,
  },
} as const

// Common vehicles
export const COMMON_VEHICLES = {
  FALCON_9: {
    name: 'Falcon 9',
    ascentDuration: 540, // 9 minutes
    minInclination: 28.5,
    maxInclination: 98.0,
    launchSite: COMMON_LAUNCH_SITES.KSC,
  },
  FALCON_HEAVY: {
    name: 'Falcon Heavy',
    ascentDuration: 600, // 10 minutes
    minInclination: 28.5,
    maxInclination: 98.0,
    launchSite: COMMON_LAUNCH_SITES.KSC,
  },
  ATLAS_V: {
    name: 'Atlas V',
    ascentDuration: 660, // 11 minutes
    minInclination: 28.5,
    maxInclination: 98.0,
    launchSite: COMMON_LAUNCH_SITES.KSC,
  },
  ELECTRON: {
    name: 'Electron',
    ascentDuration: 480, // 8 minutes
    minInclination: 39.0,
    maxInclination: 98.0,
    launchSite: {
      name: 'Rocket Lab Launch Complex 1',
      latitude: -39.2627,
      longitude: 177.8647,
      altitude: 0,
    },
  },
} as const

/**
 * Example usage
 */
export async function calculateExample(): Promise<void> {
  const engine = new OrbitalEngine()
  
  const input = {
    orbit: {
      type: 'LEO' as const,
      altitude: 400,
      inclination: 45.1,
    },
    vehicle: COMMON_VEHICLES.FALCON_9,
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-07'),
    },
    launchSite: COMMON_LAUNCH_SITES.KSC,
    constraints: {
      daylightOnly: true,
      maxWeatherRisk: 'medium' as const,
    },
  }
  
  const windows = engine.calculateLaunchWindows(input)
  
  console.log(`Found ${windows.length} launch windows`)
  windows.slice(0, 3).forEach((window: any, i: number) => {
    console.log(`Window ${i + 1}:`)
    console.log(`  Start: ${window.start.toISOString()}`)
    console.log(`  Duration: ${(window.duration / 60).toFixed(1)} minutes`)
    console.log(`  Quality: ${(window.quality * 100).toFixed(1)}%`)
    console.log(`  Weather Risk: ${window.weatherRisk}`)
    console.log(`  Visibility Regions: ${window.visibilityRegions.length}`)
  })
}

// Export default engine instance
export const orbitalEngine = new OrbitalEngine()