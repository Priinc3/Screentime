@echo off
cd dashboard
echo Starting Employee Monitor Dashboard...
:: Open browser
start "" "http://localhost:3000"
:: Start server
npm run dev
