#!/bin/bash
cd "$(dirname "$0")/dashboard"
echo "Starting Employee Monitor Dashboard..."

# Open browser after 3 seconds in background
(sleep 3 && open "http://localhost:3000") &

# Start server
npm run dev

# Keep window open if it crashes
echo "Server stopped. Press any key to exit..."
read -n 1
