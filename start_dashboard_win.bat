@echo off
cd /d "%~dp0"
echo Starting Employee Monitor Dashboard...
:: Open browser
start "" "http://localhost:3000"
:: Start server
npm run dev
