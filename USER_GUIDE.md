# Aperture - Orbital Launch Window Planning Tool

## Overview
Aperture is a modern web-based tool for calculating optimal launch windows based on orbital requirements. It combines sophisticated orbital mechanics calculations with an intuitive public-facing dashboard.

## Features

### Track 1: The Orbital Architect (Data & Math Focused)
- **Orbital Mechanics Engine**: Calculates launch windows for LEO, Polar, and SSO orbits
- **Vehicle Duration Integration**: Accounts for rocket ascent time to orbit insertion point
- **Constraint Validation**: Validates vehicle compatibility, weather risks, and daylight requirements
- **Visibility Calculations**: Determines geographic regions with best viewing conditions

### Track 2: The Launch Watcher (UX & Visualization Focused)
- **Countdown Timer**: Real-time countdown to next available launch window
- **Orbit Visualization**: Interactive 2D/3D visualization of launch trajectories
- **Weather Impact Indicators**: Green/Yellow/Red indicators based on weather conditions
- **Viewing Maps**: Geographic maps showing best viewing regions for ascent

## Quick Start Guide

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/aperture.git
cd aperture

# Install dependencies (using pnpm)
pnpm install

# Start development servers
pnpm dev
```

### 2. Using the Dashboard

#### Access the Application
- Open your browser and navigate to `http://localhost:3000`
- You'll see the Mission Control Dashboard with:
  - Countdown timer for next launch window
  - Weather impact indicators
  - Orbit visualization
  - Viewing map

#### Plan a Launch
1. Navigate to **Launch Planner** from the sidebar
2. Select orbit type (LEO, Polar, or SSO)
3. Configure altitude and inclination
4. Choose launch site and vehicle
5. Set date range
6. Click **Calculate Launch Windows**

#### Visualize Orbits
1. Navigate to **Orbit Visualizer**
2. Select orbit type from presets
3. Adjust altitude and inclination sliders
4. Use time controls to speed up/slow down simulation
5. Toggle display elements (orbit path, ground track, etc.)

## Technical Documentation

### Architecture

```
Aperture/
├── packages/
│   ├── orbital-core/          # TypeScript orbital mechanics engine
│   │   ├── src/
│   │   │   ├── types.ts       # Type definitions and Zod schemas
│   │   │   ├── calculations.ts # Core orbital calculations
│   │   │   ├── math.ts        # Mathematical utilities
│   │   │   └── index.ts       # Public API
│   │   └── test/              # Comprehensive test suite
│   └── (future API packages)
├── apps/
│   └── launch-watcher/        # React web dashboard
│       ├── src/
│       │   ├── components/    # Reusable UI components
│       │   ├── pages/         # Application pages
│       │   ├── utils/         # Utility functions
│       │   └── App.tsx        # Main application
│       └── public/            # Static assets
└── shared/                    # Shared utilities (future)
```

### Core Technologies

#### Backend (Orbital Core)
- **Language**: TypeScript
- **Runtime**: Node.js 20+
- **Key Libraries**:
  - `satellite.js`: SGP4/SDP4 orbital propagation
  - Custom astronomy calculations: Sunrise/sunset, orbital mechanics
  - `zod`: Runtime validation
  - `date-fns`: Date manipulation

#### Frontend (Launch Watcher)
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui with Tailwind CSS
- **Visualization**:
  - `three.js` + `react-three-fiber`: 3D visualization
  - Custom canvas-based 2D visualizations
  - Interactive maps with SVG

### Orbital Calculations

#### Launch Window Algorithm
1. **Input Processing**: Validate orbital parameters and constraints
2. **Daily Analysis**: For each day in date range:
   - Calculate Earth's position and rotation
   - Determine orbit plane orientation
   - Compute launch site visibility windows
3. **Window Generation**: Create launch windows based on:
   - Earth rotation alignment
   - Vehicle ascent duration
   - Weather constraints
   - Daylight requirements
4. **Quality Scoring**: Rank windows by:
   - Orbital alignment quality (0-1)
   - Weather risk assessment
   - Visibility region coverage

#### Supported Orbit Types
- **LEO (Low Earth Orbit)**: 45.1° inclination, 160-2000 km altitude
- **Polar Orbit**: 87.9°-90° inclination, global coverage
- **SSO (Sun-Synchronous Orbit)**: 98.1° inclination, constant illumination

### API Reference

#### Orbital Core Package

```typescript
import { orbitalEngine, COMMON_LAUNCH_SITES, COMMON_VEHICLES } from '@aperture/orbital-core'

// Calculate launch windows
const windows = orbitalEngine.calculateLaunchWindows({
  orbit: {
    type: 'LEO',
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
    maxWeatherRisk: 'medium',
  },
})

// Access common configurations
const launchSites = COMMON_LAUNCH_SITES // KSC, Vandenberg, Baikonur, Guiana
const vehicles = COMMON_VEHICLES // Falcon 9, Falcon Heavy, Atlas V, Electron
```

#### Types
```typescript
interface LaunchWindow {
  start: Date
  end: Date
  duration: number // seconds
  quality: number // 0-1
  weatherRisk: 'low' | 'medium' | 'high'
  visibilityRegions: GeoRegion[]
}

interface CalculationInput {
  orbit: OrbitalParams
  vehicle?: VehicleParams
  dateRange: { start: Date; end: Date }
  launchSite: LaunchSite
  constraints?: {
    minSunElevation?: number
    maxWeatherRisk?: 'low' | 'medium' | 'high'
    daylightOnly?: boolean
  }
}
```

### Development Guide

#### Setting Up Development Environment

```bash
# Install Node.js 20+ and pnpm
brew install node pnpm  # macOS
# or use nvm for Node version management

# Clone and setup
git clone <repository>
cd aperture
pnpm install

# Start development
pnpm dev  # Starts both orbital-core and launch-watcher
```

#### Running Tests

```bash
# Run orbital core tests
cd packages/orbital-core
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch
```

#### Building for Production

```bash
# Build all packages
pnpm build

# Build individual packages
cd packages/orbital-core && pnpm build
cd apps/launch-watcher && pnpm build
```

### Deployment

#### Production Build
```bash
# Build the application
pnpm build

# The built application will be in:
# - packages/orbital-core/dist/ (TypeScript library)
# - apps/launch-watcher/dist/ (React application)
```

#### Docker Deployment
```dockerfile
# Example Dockerfile for launch-watcher
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/apps/launch-watcher/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Configuration

#### Environment Variables
```bash
# .env.example
VITE_API_URL=http://localhost:3001
VITE_WEATHER_API_KEY=your_key_here
VITE_MAPBOX_TOKEN=your_token_here
```

#### Tailwind Configuration
Customize in `apps/launch-watcher/tailwind.config.js`:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        space: {
          dark: '#0a0e17',
          blue: '#1e3a8a',
          purple: '#4c1d95',
        },
      },
    },
  },
}
```

### Troubleshooting

#### Common Issues

1. **Build Failures**
   - Ensure Node.js version 20+
   - Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`

2. **TypeScript Errors**
   - Run type checking: `pnpm type-check`
   - Ensure all dependencies are installed

3. **Visualization Issues**
   - Check browser console for WebGL errors
   - Ensure three.js is properly imported

4. **Calculation Errors**
   - Validate input parameters
   - Check date ranges are valid
   - Ensure vehicle compatibility with orbit type

#### Performance Tips

1. **Orbital Calculations**
   - Use Web Workers for heavy calculations
   - Cache frequently used results
   - Implement pagination for large date ranges

2. **Frontend Optimization**
   - Implement virtual scrolling for long lists
   - Use React.memo for expensive components
   - Lazy load visualization components

3. **Build Optimization**
   - Use code splitting
   - Optimize images and assets
   - Enable gzip compression

### Contributing

#### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run test suite
5. Submit pull request

#### Code Style
- Use TypeScript with strict mode
- Follow ESLint and Prettier configurations
- Write comprehensive tests
- Document public APIs

#### Testing Requirements
- Unit tests for all core calculations
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Maintain >80% test coverage

### License
MIT License - see LICENSE file for details

### Support
- Documentation: [docs.aperture.space](https://docs.aperture.space)
- Issues: [GitHub Issues](https://github.com/your-org/aperture/issues)
- Email: support@aperture.space

---

## Advanced Topics

### Custom Orbital Calculations
Extend the orbital engine by implementing custom calculation modules:

```typescript
import { OrbitalEngine } from '@aperture/orbital-core'

class CustomOrbitalEngine extends OrbitalEngine {
  // Override methods for custom calculations
  calculateLaunchWindows(input: CalculationInput): LaunchWindow[] {
    // Custom implementation
  }
}
```

### Integration with External APIs
Connect to real weather data, satellite tracking, or mission control systems:

```typescript
// Example: Integration with weather API
async function getRealWeatherData(latitude: number, longitude: number) {
  const response = await fetch(
    `https://api.weather.com/v3/conditions?lat=${latitude}&lon=${longitude}`
  )
  return response.json()
}
```

### Scaling for Production
- Implement Redis caching for calculated windows
- Use CDN for static assets
- Set up monitoring with OpenTelemetry
- Implement rate limiting for API endpoints

### Security Considerations
- Validate all user inputs
- Implement CORS policies
- Use HTTPS in production
- Regular dependency updates
- Security headers configuration