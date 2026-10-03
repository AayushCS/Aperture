# 🍞 Bun Setup Guide for Aperture

## Why Bun?
- **10-100x faster** than Node.js for package installation
- **Built-in TypeScript support** (no tsc required)
- **Built-in test runner** (replaces Jest/Vitest)
- **Built-in bundler** (alternative to Webpack/Rollup)
- **JavaScript/TypeScript/JSX all work out of the box**

## Installation

### 1. Install Bun
```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (via WSL)
# Or use the Windows installer from bun.sh
```

### 2. Verify Installation
```bash
bun --version
# Should show bun 1.x.x
```

## Project Setup with Bun

### 3. Install Dependencies
```bash
# From project root
cd /Users/aayushgoel/Aperture

# Install root dependencies
bun install

# Install orbital-core dependencies
cd packages/orbital-core
bun install

# Install launch-watcher dependencies  
cd ../../apps/launch-watcher
bun install

# Or use the convenience script
cd /Users/aayushgoel/Aperture
bun run install:all
```

### 4. Development Commands

#### Start Development Server
```bash
# Start the React dashboard
bun run dev
# Opens http://localhost:3000

# Start orbital-core in watch mode (separate terminal)
cd packages/orbital-core
bun run dev
```

#### Build the Project
```bash
# Build everything
bun run build

# Or build individually
cd packages/orbital-core && bun run build
cd apps/launch-watcher && bun run build
```

#### Run Tests
```bash
# Run all tests
bun run test

# Run tests with watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

#### Code Quality
```bash
# Lint code
bun run lint

# Format code
bun run format

# Type checking
bun run type-check
```

## Key Differences with Bun

### 1. Package Management
- **Bun installs dependencies in ~/.bun/install/cache/** (global cache)
- Much faster than npm/pnpm/yarn
- No `node_modules` bloat

### 2. Testing
- Uses **bun:test** instead of Jest/Vitest
- Same API as Jest/Vitest
- Built-in coverage reports
- **Example test:**
```typescript
import { test, expect } from 'bun:test'

test('2 + 2', () => {
  expect(2 + 2).toBe(4)
})
```

### 3. TypeScript
- **No need to compile TypeScript!**
- Bun runs `.ts` files directly
- Still need `tsc` for type checking and declaration files

### 4. Speed Comparison
```bash
# Bun install (typical)
Time: 0.5-2 seconds

# pnpm install (typical)  
Time: 10-30 seconds

# npm install (typical)
Time: 30-90 seconds
```

## Troubleshooting

### Common Issues

#### 1. "Cannot find module"
```bash
# Clear Bun cache and reinstall
rm -rf ~/.bun/install/cache
bun install
```

#### 2. TypeScript errors
```bash
# Ensure bun-types is installed
bun add -d bun-types

# Check tsconfig includes bun types
# In tsconfig.json:
{
  "compilerOptions": {
    "types": ["bun-types"]
  }
}
```

#### 3. React/Vite issues
```bash
# Bun works perfectly with Vite
# No changes needed to Vite config
```

#### 4. Workspace issues
```bash
# Bun has excellent monorepo support
# Use bun workspaces or run commands per package
```

## Performance Benefits

### Development Speed
- **Hot reload**: 2-5x faster than Vite with Node
- **Test runs**: 3-10x faster than Jest
- **Install times**: 10-100x faster than npm/pnpm

### Memory Usage
- **Lower memory footprint** than Node.js
- **Efficient module loading**
- **Built-in optimization**

## Migration Notes

### From Node.js/npm
1. Replace `npm run` with `bun run`
2. Replace `npm install` with `bun install`
3. Replace `npx` with `bunx`

### From pnpm
1. Similar command structure
2. Much faster installs
3. Global cache reduces disk usage

### From Yarn
1. Similar workspace support
2. Faster installs and execution
3. Simpler configuration

## Production Deployment

### Building for Production
```bash
# Bun can bundle for production
bun build ./src/index.ts --outdir ./dist

# But for React apps, use Vite build
bun run build
```

### Docker with Bun
```dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --production

# Copy source
COPY . .

# Build
RUN bun run build

# Run
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## Resources
- **Official Docs**: https://bun.sh/docs
- **GitHub**: https://github.com/oven-sh/bun
- **Discord**: https://bun.sh/discord

## Why Bun is Perfect for Aperture
1. **Orbital calculations benefit from speed** - Bun's fast execution
2. **TypeScript-native** - No compilation step needed
3. **Modern toolchain** - Built-in everything
4. **Excellent React support** - Works seamlessly with Vite
5. **Future-proof** - Growing ecosystem with strong backing

---

**Ready to launch with Bun!** 🚀🍞