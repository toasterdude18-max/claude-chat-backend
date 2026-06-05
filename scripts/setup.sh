#!/bin/bash

set -e

echo "🚀 Claude Chat Backend Setup"
echo "================================"
echo ""

# Check Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found: $(node -v))"
  exit 1
fi

echo "✓ Node.js $(node -v)"
echo ""

# Check npm
echo "📦 Checking npm..."
if ! command -v npm &> /dev/null; then
  echo "❌ npm not found"
  exit 1
fi

echo "✓ npm $(npm -v)"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  No .env.local found"
  echo "📋 Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "✓ .env.local created (please update with your credentials)"
  echo ""
  echo "Required credentials:"
  echo "  - FIREBASE_PROJECT_ID"
  echo "  - FIREBASE_PRIVATE_KEY"
  echo "  - FIREBASE_CLIENT_EMAIL"
  echo "  - CLAUDE_API_KEY"
else
  echo "✓ .env.local exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with your credentials"
echo "  2. Run: npm run dev"
echo ""
