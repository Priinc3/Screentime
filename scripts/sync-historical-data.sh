#!/bin/bash

# Sync All Historical Data to daily_summary
# This script calls the seed-daily-summary API to backfill data for the last 30 days

echo "🔄 Starting historical data sync..."
echo "This will aggregate all activity_logs for the last 30 days into daily_summary"
echo ""

# If running on Vercel (deployed)
# Replace YOUR-VERCEL-URL with your actual deployment URL
# Example: https://screentime-dashboard.vercel.app
VERCEL_URL="YOUR-VERCEL-URL"

# Option 1: Call deployed API
if [ "$VERCEL_URL" != "YOUR-VERCEL-URL" ]; then
    echo "📡 Calling deployed API: ${VERCEL_URL}/api/seed-daily-summary"
    curl -X POST "${VERCEL_URL}/api/seed-daily-summary" \
        -H "Content-Type: application/json" \
        | jq '.'
else
    # Option 2: Call localhost (if running locally)
    echo "📡 Calling local API: http://localhost:3000/api/seed-daily-summary"
    curl -X POST "http://localhost:3000/api/seed-daily-summary" \
        -H "Content-Type: application/json" \
        | jq '.'
fi

echo ""
echo "✅ Sync complete!"
