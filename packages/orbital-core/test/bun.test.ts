import { describe, expect, test } from 'bun:test'
import { OrbitalEngine, COMMON_LAUNCH_SITES, COMMON_VEHICLES } from '../src'
import type { CalculationInput } from '../src/types'
import { degToRad, radToDeg, normalizeAngle, calculateDistance } from '../src/math'

describe('OrbitalEngine', () => {
  const engine = new OrbitalEngine()

  test('should create engine instance', () => {
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

    test('should calculate LEO launch windows', () => {
      const windows = engine.calculateLaunchWindows(leoInput)
      expect(windows).toBeDefined()
      expect(Array.isArray(windows)).toBe(true)
    })

    test('should return windows with correct properties', () => {
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

    test('should calculate polar orbit windows', () => {
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

    test('should calculate SSO orbit windows', () => {
      const windows = engine.calculateLaunchWindows(ssoInput)
      expect(windows).toBeDefined()
    })
  })
})

describe('Math utilities', () => {
  test('should convert degrees to radians', () => {
    expect(degToRad(0)).toBe(0)
    expect(degToRad(180)).toBeCloseTo(Math.PI)
    expect(degToRad(360)).toBeCloseTo(2 * Math.PI)
  })

  test('should convert radians to degrees', () => {
    expect(radToDeg(0)).toBe(0)
    expect(radToDeg(Math.PI)).toBeCloseTo(180)
    expect(radToDeg(2 * Math.PI)).toBeCloseTo(360)
  })

  test('should normalize angles', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(720)).toBe(0)
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
  })

  test('should calculate distance between points', () => {
    // Distance between same point should be 0
    expect(calculateDistance(0, 0, 0, 0)).toBe(0)
    
    // Approximate distance between poles
    expect(calculateDistance(90, 0, -90, 0)).toBeCloseTo(20015, -2)
    
    // Approximate distance between equator points
    expect(calculateDistance(0, 0, 0, 180)).toBeCloseTo(20015, -2)
  })
})