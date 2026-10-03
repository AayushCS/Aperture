# 🚀 Aperture - Orbital Launch Window Planning Tool

<div align="center">

![Aperture Banner](https://img.shields.io/badge/Aperture-Orbital%20Launch%20Planner-blueviolet)
![Bun](https://img.shields.io/badge/Bun-1.0-FFC131)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF)
![License](https://img.shields.io/badge/License-MIT-green)

**Calculate optimal launch windows based on orbital requirements with real-time visualizations**

[User Guide](#-user-guide) • [Features](#-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Documentation](#-documentation)

</div>

## 🎯 Overview

Aperture solves the complex puzzle of matching satellite orbital parameters with Earth's rotation, weather patterns, and launch vehicle capabilities. It provides both mission planning tools for agencies and an engaging public dashboard for space enthusiasts.

### Mission Statement
> "Space agencies and private launch providers face a complex puzzle: matching a satellite's required orbital parameters with the Earth's rotation, weather patterns, and launch vehicle capabilities. A missed window can cost millions."

## ✨ Features

### Track 1: The Orbital Architect (Data & Math Focused)
- **Orbital Mechanics Engine**: Calculate launch windows for LEO, Polar, and SSO orbits
- **Vehicle Duration Integration**: Account for rocket ascent time to orbit insertion
- **Constraint Validation**: Validate vehicle compatibility and weather risks
- **Visibility Calculations**: Determine geographic regions with best viewing conditions

### Track 2: The Launch Watcher (UX & Visualization Focused)
- **Countdown Timer**: Real-time countdown to next available launch window
- **Orbit Visualization**: Interactive 2D/3D visualization of launch trajectories
- **Weather Impact Indicators**: Green/Yellow/Red indicators based on weather conditions
- **Viewing Maps**: Geographic maps showing best viewing regions for ascent

## 🏗️ Architecture

### Tech Stack
- **Full-Stack TypeScript**: Unified language across frontend and backend
- **Runtime**: **Bun 1.0+** - Fast JavaScript/TypeScript runtime
- **Orbital Core**: Custom TypeScript orbital mechanics engine with `satellite.js`
- **React Dashboard**: Modern React 18+ with Vite, TypeScript, and shadcn/ui
- **Visualization**: Custom canvas for 2D orbital visualizations, interactive maps

### Project Structure
```
Aperture/
├── packages/
│   └── orbital-core/          # TypeScript orbital mechanics engine
├── apps/
│   └── launch-watcher/        # React web dashboard
├── ARCHITECTURE.md            # System design documentation
├── USER_GUIDE.md             # Comprehensive user guide
└── BUN_SETUP.md              # Bun installation and setup guide
```

## 🚀 Getting Started

### Prerequisites
- **Bun 1.0+** (recommended) or Node.js 20+ with pnpm
- Modern web browser

> **Tip**: Bun is 10-100x faster! See [BUN_SETUP.md](./BUN_SETUP.md) for setup.

### Quick Start
```bash
# Clone the repository
git clone https://github.com/your-org/aperture.git
cd aperture

# Install dependencies with the install script
bash install.sh

# Or install manually:
# cd packages/orbital-core && bun install
# cd ../../apps/launch-watcher && bun install

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard!

## 📖 Documentation

### Complete Documentation
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture and design
- **[USER_GUIDE.md](./USER_GUIDE.md)** - Comprehensive user and developer guide
- **[BUN_SETUP.md](./BUN_SETUP.md)** - Bun installation and setup guide
- **API Documentation** - Available in the orbital-core package

### Key Components

#### Orbital Core (`@aperture/orbital-core`)
```typescript
import { orbitalEngine } from '@aperture/orbital-core'

// Calculate launch windows
const windows = orbitalEngine.calculateLaunchWindows({
  orbit: { type: 'LEO', altitude: 400, inclination: 45.1 },
  dateRange: { start: new Date(), end: new Date('2024-01-07') },
  launchSite: { name: 'KSC', latitude: 28.5729, longitude: -80.6489 },
})
```

#### Web Dashboard (`apps/launch-watcher`)
- **Dashboard**: Mission control overview with countdown timer
- **Launch Planner**: Interactive launch window calculation
- **Orbit Visualizer**: 3D orbital simulation

## 🧪 Testing

```bash
# Run orbital core tests (with Bun's built-in test runner)
cd packages/orbital-core
bun test

# Run tests with coverage
bun test --coverage

# Run tests with watch mode
bun test --watch
```

Comprehensive test suite includes:
- LEO, Polar, and SSO orbit calculations
- Constraint validation
- Vehicle compatibility checks
- Visibility region generation
- Mathematical utility functions

## 🏃‍♂️ Development

### Development Commands
```bash
# Install dependencies
bun install

# Start development
bun run dev

# Build for production
bun run build

# Run tests
bun run test

# Type checking
bun run type-check

# Linting
bun run lint

# Code formatting
bun run format
```

### Code Style
- TypeScript with strict mode enabled
- ESLint and Prettier configured
- Comprehensive test coverage with Bun's test runner
- Detailed documentation

## 📊 Performance

### Optimizations Implemented
- **Bun Runtime**: 10-100x faster package installation and execution
- **Web Workers**: Offload orbital calculations from main thread
- **Code Splitting**: Dynamic imports for heavy components
- **Caching**: Frequently used calculations cached
- **Virtualization**: Efficient rendering of large datasets

### Bun Performance Benefits
- **Installation**: 0.5-2 seconds vs 30-90 seconds with npm
- **TypeScript**: No compilation step needed, runs directly
- **Testing**: Built-in test runner with instant feedback
- **Development**: Hot reload 2-5x faster than Node.js

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit pull request

### Development Standards
- Write comprehensive tests using Bun's test runner
- Document public APIs
- Follow TypeScript best practices
- Maintain code style consistency
- Leverage Bun's performance optimizations

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [docs.aperture.space](https://docs.aperture.space)
- **Issues**: [GitHub Issues](https://github.com/your-org/aperture/issues)
- **Email**: support@aperture.space

## 🙏 Acknowledgments

- `satellite.js` for SGP4/SDP4 orbital propagation
- NASA for orbital mechanics references
- SpaceX for inspiration and real-world validation data
- The Bun team for the incredible JavaScript runtime
- The open-source community for amazing tools and libraries

---

<div align="center">

**Made with ❤️ for space exploration**

*"The important achievement of Apollo was demonstrating that humanity is not forever chained to this planet and our visions go rather further than that and our opportunities are unlimited."* - Neil Armstrong

</div>
