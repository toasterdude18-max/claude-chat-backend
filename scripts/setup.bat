@echo off
setlocal enabledelayedexpansion

echo.
echo 🚀 Claude Chat Backend Setup
echo ================================
echo.

REM Check Node.js
echo 📦 Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ Node.js not found. Please install Node.js 18+
  exit /b 1
)

for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✓ Node %NODE_VERSION%
echo.

REM Check npm
echo 📦 Checking npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ npm not found
  exit /b 1
)

for /f "tokens=1" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✓ npm !NPM_VERSION!
echo.

REM Install dependencies
echo 📥 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo ❌ Failed to install dependencies
  exit /b 1
)
echo ✓ Dependencies installed
echo.

REM Check for .env.local
if not exist .env.local (
  echo ⚠️  No .env.local found
  echo 📋 Creating .env.local from .env.example...
  copy .env.example .env.local
  echo ✓ .env.local created (please update with your credentials)
  echo.
  echo Required credentials:
  echo   - FIREBASE_PROJECT_ID
  echo   - FIREBASE_PRIVATE_KEY
  echo   - FIREBASE_CLIENT_EMAIL
  echo   - CLAUDE_API_KEY
) else (
  echo ✓ .env.local exists
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo   1. Update .env.local with your credentials
echo   2. Run: npm run dev
echo.

endlocal
