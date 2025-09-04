@echo off
echo ============================================
echo   Fixing Basey Fare Guide Dependencies
echo ============================================
echo.
echo This script will fix the dependency issues causing the Turbopack error.
echo.

REM Navigate to the frontend directory
cd /d "C:\Users\OCENA\OneDrive\Documents\Python Projects late 2024\Basey Fare Guide\frontend"

echo [1/4] Cleaning previous builds and cache...
if exist ".next" rmdir /s /q ".next"
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

echo [2/4] Installing missing dependencies...
npm install autoprefixer@^10.4.16 postcss@^8.4.32

echo [3/4] Reinstalling Tailwind CSS (stable version)...
npm uninstall tailwindcss @tailwindcss/postcss
npm install tailwindcss@^3.4.1

echo [4/4] Starting development server...
echo.
echo ============================================
echo   Dependencies Fixed - Starting Server
echo ============================================
echo.
echo The server should start without Turbopack errors now.
echo If you see any issues, press Ctrl+C and run: npm run dev
echo.

npm run dev

pause
