import { OrbitType, CalculationInput, LaunchWindow, GeoRegion } from './types'
import { degToRad, radToDeg, normalizeAngle } from './math'

/**
 * Main orbital mechanics engine
 */
export class OrbitalEngine {
  /**
   * Calculate launch windows for given parameters
   */
  calculateLaunchWindows(input: CalculationInput): LaunchWindow[] {
    const windows: LaunchWindow[] = []
    const { orbit, dateRange, launchSite, vehicle, constraints } = input
    
    // Get base inclination for orbit type
    const targetInclination = this.getTargetInclination(orbit.type)
    
    // Calculate windows for each day in range
    const currentDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    
    while (currentDate <= endDate) {
      const dayWindows = this.calculateDailyWindows(
        currentDate,
        targetInclination,
        launchSite,
        vehicle,
        constraints
      )
      
      windows.push(...dayWindows)
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Sort by start time and quality
    return windows.sort((a, b) => {
      if (a.start.getTime() === b.start.getTime()) {
        return b.quality - a.quality
      }
      return a.start.getTime() - b.start.getTime()
    })
  }
  
  /**
   * Calculate windows for a specific day
   */
  private calculateDailyWindows(
    date: Date,
    targetInclination: number,
    launchSite: LaunchSite,
    vehicle?: VehicleParams,
    constraints?: CalculationInput['constraints']
  ): LaunchWindow[] {
    const windows: LaunchWindow[] = []
    
    // Calculate sunrise and sunset for launch site
    const { sunrise, sunset } = this.calculateSunriseSunset(date, launchSite)
    
    // Generate potential launch times (every 5 minutes for calculation)
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    // For each potential launch time, check if it's valid
    for (let time = startOfDay.getTime(); time <= endOfDay.getTime(); time += 5 * 60 * 1000) {
      const launchTime = new Date(time)
      
      // Check daylight constraint if required
      if (constraints?.daylightOnly) {
        if (launchTime < sunrise || launchTime > sunset) {
          continue
        }
      }
      
      // Check if Earth's rotation aligns with target inclination
      const isValid = this.isValidLaunchTime(
        launchTime,
        targetInclination,
        launchSite,
        vehicle
      )
      
      if (isValid) {
        // Calculate window duration (typically 5-30 minutes)
        const windowDuration = this.calculateWindowDuration(targetInclination, vehicle)
        const windowEnd = new Date(launchTime.getTime() + windowDuration * 1000)
        
        // Calculate visibility regions
        const visibilityRegions = this.calculateVisibilityRegions(
          launchTime,
          windowEnd,
          launchSite
        )
        
        // Determine weather risk (mock for now)
        const weatherRisk = this.estimateWeatherRisk(launchTime, launchSite)
        
        // Skip if weather risk exceeds constraint
        if (constraints?.maxWeatherRisk) {
          const riskLevels = { low: 0, medium: 1, high: 2 }
          if (riskLevels[weatherRisk] > riskLevels[constraints.maxWeatherRisk]) {
            continue
          }
        }
        
        windows.push({
          start: launchTime,
          end: windowEnd,
          duration: windowDuration,
          quality: this.calculateWindowQuality(launchTime, targetInclination, weatherRisk),
          weatherRisk,
          visibilityRegions,
        })
      }
    }
    
    return windows
  }
  
  /**
   * Get target inclination for orbit type
   */
  private getTargetInclination(orbitType: OrbitType): number {
    switch (orbitType) {
      case 'LEO':
        return 45.1 // Typical ISS inclination
      case 'POLAR':
        return 90.0 // True polar
      case 'SSO':
        return 98.1 // Sun-synchronous
      default:
        throw new Error(`Unknown orbit type: ${orbitType}`)
    }
  }
  
  /**
   * Check if launch time is valid for target inclination
   */
  private isValidLaunchTime(
    launchTime: Date,
    targetInclination: number,
    launchSite: LaunchSite,
    vehicle?: VehicleParams
  ): boolean {
    // Calculate launch azimuth needed for target inclination
    const requiredAzimuth = this.calculateLaunchAzimuth(
      launchSite.latitude,
      targetInclination
    )
    
    // Check if launch site can achieve this azimuth
    if (!this.isAzimuthAchievable(requiredAzimuth, launchSite.latitude)) {
      return false
    }
    
    // Check vehicle inclination limits if provided
    if (vehicle) {
      if (
        targetInclination < vehicle.minInclination ||
        targetInclination > vehicle.maxInclination
      ) {
        return false
      }
    }
    
    // Additional checks for specific orbit types
    switch (targetInclination) {
      case 98.1: // SSO
        return this.isSunSynchronousTimeValid(launchTime, launchSite)
      case 90.0: // Polar
        return this.isPolarLaunchTimeValid(launchTime, launchSite)
      default:
        return true
    }
  }
  
  /**
   * Calculate launch azimuth for given latitude and inclination
   */
  private calculateLaunchAzimuth(latitude: number, inclination: number): number {
    const latRad = degToRad(latitude)
    const incRad = degToRad(inclination)
    
    // Formula: cos(azimuth) = cos(inclination) / cos(latitude)
    const cosAz = Math.cos(incRad) / Math.cos(latRad)
    
    // Clamp to valid range
    if (Math.abs(cosAz) > 1) {
      return NaN // Impossible combination
    }
    
    const azimuthRad = Math.acos(cosAz)
    return radToDeg(azimuthRad)
  }
  
  /**
   * Check if azimuth is achievable from launch site
   */
  private isAzimuthAchievable(azimuth: number, latitude: number): boolean {
    if (isNaN(azimuth)) {
      return false
    }
    
    // For safety, launches typically avoid flying over populated areas
    // This is a simplified check
    const minAzimuth = 90 // East
    const maxAzimuth = 180 // South
    
    return azimuth >= minAzimuth && azimuth <= maxAzimuth
  }
  
  /**
   * Calculate sunrise and sunset for launch site
   */
  private calculateSunriseSunset(date: Date, launchSite: LaunchSite): {
    sunrise: Date
    sunset: Date
  } {
    // Simplified calculation - in production would use astronomy-engine
    const dayOfYear = this.getDayOfYear(date)
    const lat = launchSite.latitude
    
    // Approximate calculation
    const declination = 23.45 * Math.sin(degToRad((360 / 365) * (dayOfYear - 81)))
    const hourAngle = Math.acos(
      -Math.tan(degToRad(lat)) * Math.tan(degToRad(declination))
    )
    
    const sunriseHour = 12 - radToDeg(hourAngle) / 15
    const sunsetHour = 12 + radToDeg(hourAngle) / 15
    
    const sunrise = new Date(date)
    sunrise.setHours(Math.floor(sunriseHour), (sunriseHour % 1) * 60, 0, 0)
    
    const sunset = new Date(date)
    sunset.setHours(Math.floor(sunsetHour), (sunsetHour % 1) * 60, 0, 0)
    
    return { sunrise, sunset }
  }
  
  /**
   * Get day of year (1-365)
   */
  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date.getTime() - start.getTime()
    const oneDay = 1000 * 60 * 60 * 24
    return Math.floor(diff / oneDay)
  }
  
  /**
   * Calculate window duration
   */
  private calculateWindowDuration(inclination: number, vehicle?: VehicleParams): number {
    let baseDuration = 15 * 60 // 15 minutes default
    
    // Adjust based on inclination
    if (inclination > 80) {
      baseDuration = 5 * 60 // Shorter windows for polar orbits
    }
    
    // Adjust for vehicle ascent time
    if (vehicle) {
      baseDuration = Math.max(baseDuration, vehicle.ascentDuration)
    }
    
    return baseDuration
  }
  
  /**
   * Calculate visibility regions
   */
  private calculateVisibilityRegions(
    start: Date,
    end: Date,
    launchSite: LaunchSite
  ): GeoRegion[] {
    // Simplified calculation - would use actual trajectory in production
    const regions: GeoRegion[] = []
    
    // Launch site region
    regions.push({
      latitude: launchSite.latitude,
      longitude: launchSite.longitude,
      radius: 100, // km
      visibilityStart: start,
      visibilityEnd: new Date(start.getTime() + 30 * 60 * 1000), // 30 minutes
    })
    
    // Downrange regions (simplified)
    const downrangeLats = [launchSite.latitude + 5, launchSite.latitude + 10]
    const downrangeLons = [launchSite.longitude + 10, launchSite.longitude + 20]
    
    downrangeLats.forEach((lat, i) => {
      regions.push({
        latitude: lat,
        longitude: downrangeLons[i],
        radius: 50,
        visibilityStart: new Date(start.getTime() + (i + 1) * 5 * 60 * 1000),
        visibilityEnd: new Date(start.getTime() + (i + 2) * 5 * 60 * 1000),
      })
    })
    
    return regions
  }
  
  /**
   * Estimate weather risk (mock implementation)
   */
  private estimateWeatherRisk(time: Date, launchSite: LaunchSite): 'low' | 'medium' | 'high' {
    // Simplified - would use weather API in production
    const hour = time.getHours()
    const month = time.getMonth()
    
    // Mock logic based on time of day and season
    if (hour >= 6 && hour <= 18) {
      // Daytime
      if (month >= 4 && month <= 9) {
        // Summer months
        return Math.random() > 0.7 ? 'medium' : 'low'
      } else {
        // Winter months
        return 'low'
      }
    } else {
      // Nighttime
      return Math.random() > 0.9 ? 'high' : 'medium'
    }
  }
  
  /**
   * Calculate window quality score (0-1)
   */
  private calculateWindowQuality(
    time: Date,
    inclination: number,
    weatherRisk: 'low' | 'medium' | 'high'
  ): number {
    let score = 0.5 // Base score
    
    // Time of day preference (prefer daylight)
    const hour = time.getHours()
    if (hour >= 8 && hour <= 16) {
      score += 0.2
    }
    
    // Weather risk adjustment
    const riskAdjustments = { low: 0.3, medium: 0.1, high: -0.2 }
    score += riskAdjustments[weatherRisk]
    
    // Orbital type preference
    if (inclination === 45.1) {
      score += 0.1 // LEO is common
    } else if (inclination === 98.1) {
      score += 0.15 // SSO is valuable
    }
    
    return Math.max(0, Math.min(1, score))
  }
  
  /**
   * Check if time is valid for sun-synchronous orbit
   */
  private isSunSynchronousTimeValid(time: Date, launchSite: LaunchSite): boolean {
    // SSO requires specific local time of ascending node
    // Simplified check - prefer morning launches
    const hour = time.getHours()
    return hour >= 6 && hour <= 12
  }
  
  /**
   * Check if time is valid for polar orbit
   */
  private isPolarLaunchTimeValid(time: Date, launchSite: LaunchSite): boolean {
    // Polar orbits can launch anytime, but prefer specific azimuths
    // Simplified - always valid
    return true
  }
}