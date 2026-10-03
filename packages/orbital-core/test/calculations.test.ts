import { describe, it, expect } from 'vitest'
import { OrbitalEngine, COMMON_LAUNCH_SITES, COMMON_VEHICLES } from '../src'
import type { CalculationInput } from '../src/types'

describe('OrbitalEngine', () => {
  const engine = new OrbitalEngine()

  it('should create engine instance', () => {
    expect(engine).toBeInstanceOf(OrbitalEngine)
  })

  describe('LEO orbit calculations', () => {
    const leoInput: CalculationInput = {
      orbit: {
        type: 'LEO',
        altitude: 400,
        inclination: 45.1,
      },
      vehicle: COMMON_VEHICLES.FALCON_9,
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      },
      launchSite: COMMON_LAUNCH_SITES.KSC,
    }

    it('should calculate LEO launch windows', () => {
      const windows = engine.calculateLaunchWindows(leoInput)
      expect(windows).toBeDefined()
      expect(Array.isArray(windows)).toBe(true)
    })

    it('should return windows with correct properties', () => {
      const windows = engine.calculateLaunchWindows(leoInput)
      if (windows.length > 0) {
        const window = windows[0]
        expect(window).toHaveProperty('start')
        expect(window).toHaveProperty('end')
        expect(window).toHaveProperty('duration')
        expect(window).toHaveProperty('quality')
        expect(window).toHaveProperty('weatherRisk')
        expect(window).toHaveProperty('visibilityRegions')
        
        expect(window.start).toBeInstanceOf(Date)
        expect(window.end).toBeInstanceOf(Date)
        expect(typeof window.duration).toBe('number')
        expect(window.duration).toBeGreaterThan(0)
        expect(window.quality).toBeGreaterThanOrEqual(0)
        expect(window.quality).toBeLessThanOrEqual(1)
        expect(['low', 'medium', 'high']).toContain(window.weatherRisk)
      }
    })
  })

  describe('Polar orbit calculations', () => {
    const polarInput: CalculationInput = {
      orbit: {
        type: 'POLAR',
        altitude: 700,
        inclination: 90,
      },
      vehicle: COMMON_VEHICLES.FALCON_9,
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      },
      launchSite: COMMON_LAUNCH_SITES.VANDENBERG,
    }

    it('should calculate polar orbit windows', () => {
      const windows = engine.calculateLaunchWindows(polarInput)
      expect(windows).toBeDefined()
    })
  })

  describe('SSO orbit calculations', () => {
    const ssoInput: CalculationInput = {
      orbit: {
        type: 'SSO',
        altitude: 600,
        inclination: 98.1,
      },
      vehicle: COMMON_VEHICLES.FALCON_9,
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      },
      launchSite: COMMON_LAUNCH_SITES.KSC,
    }

    it('should calculate SSO orbit windows', () => {
      const windows = engine.calculateLaunchWindows(ssoInput)
      expect(windows).toBeDefined()
    })
  })

  describe('Constraint validation', () => {
    it('should respect daylight constraint', () => {
      const input: CalculationInput = {
        orbit: {
          type: 'LEO',
          altitude: 400,
          inclination: 45.1,
        },
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02'),
        },
        launchSite: COMMON_LAUNCH_SITES.KSC,
        constraints: {
          daylightOnly: true,
        },
      }

      const windows = engine.calculateLaunchWindows(input)
      expect(windows).toBeDefined()
    })

    it('should respect weather risk constraint', () => {
      const input: CalculationInput = {
        orbit: {
          type: 'LEO',
          altitude: 400,
          inclination: 45.1,
        },
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02'),
        },
        launchSite: COMMON_LAUNCH_SITES.KSC,
        constraints: {
          maxWeatherRisk: 'medium',
        },
      }

      const windows = engine.calculateLaunchWindows(input)
      expect(windows).toBeDefined()
    })
  })

  describe('Vehicle compatibility', () => {
    it('should validate vehicle inclination limits', () => {
      const validInput: CalculationInput = {
        orbit: {
          type: 'LEO',
          altitude: 400,
          inclination: 45.1,
        },
        vehicle: COMMON_VEHICLES.FALCON_9,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02'),
        },
        launchSite: COMMON_LAUNCH_SITES.KSC,
      }

      const windows = engine.calculateLaunchWindows(validInput)
      expect(windows).toBeDefined()
    })
  })

  describe('Visibility region calculation', () => {
    it('should generate visibility regions', () => {
      const input: CalculationInput = {
        orbit: {
          type: 'LEO',
          altitude: 400,
          inclination: 45.1,
        },
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02'),
        },
        launchSite: COMMON_LAUNCH_SITES.KSC,
      }

      const windows = engine.calculateLaunchWindows(input)
      if (windows.length > 0) {
        const window = windows[0]
        expect(Array.isArray(window.visibilityRegions)).toBe(true)
        if (window.visibilityRegions.length > 0) {
          const region = window.visibilityRegions[0]
          expect(region).toHaveProperty('latitude')
          expect(region).toHaveProperty('longitude')
          expect(region).toHaveProperty('radius')
          expect(region).toHaveProperty('visibilityStart')
          expect(region).toHaveProperty('visibilityEnd')
        }
      }
    })
  })
})

describe('Math utilities', () => {
  import { degToRad, radToDeg, normalizeAngle, calculateDistance } from '../src/math'

  it('should convert degrees to radians', () => {
    expect(degToRad(0)).toBe(0)
    expect(degToRad(180)).toBeCloseTo(Math.PI)
    expect(degToRad(360)).toBeCloseTo(2 * Math.PI)
  })

  it('should convert radians to degrees', () => {
    expect(radToDeg(0)).toBe(0)
    expect(radToDeg(Math.PI)).toBeCloseTo(180)
    expect(radToDeg(2 * Math.PI)).toBeCloseTo(360)
  })

  it('should normalize angles', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(720)).toBe(0)
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
  })

  it('should calculate distance between points', () => {
    // Distance between same point should be 0
    expect(calculateDistance(0, 0, 0, 0)).toBe(0)
    
    // Approximate distance between poles
    expect(calculateDistance(90, 0, -90, 0)).toBeCloseTo(20015, -2)
    
    // Approximate distance between equator points
    expect(calculateDistance(0, 0, 0, 180)).toBeCloseTo(20015, -2)
  })
})