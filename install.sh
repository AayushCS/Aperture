#!/bin/bash

echo "🚀 Installing Aperture dependencies..."

echo "📦 Installing orbital-core dependencies..."
cd packages/orbital-core
bun install
cd ../..

echo "🌐 Installing launch-watcher dependencies..."
cd apps/launch-watcher
bun install
cd ../..

echo "✅ Installation complete!"
echo ""
echo "To start development:"
echo "  bun run dev"
echo ""
echo "To run tests:"
echo "  bun run test"
echo ""
echo "To build for production:"
echo "  bun run build"