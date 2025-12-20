# n8n Daily Aggregation Workflow Setup

This document explains how to set up n8n to call the `/api/aggregate-daily` endpoint at 11:59 PM IST daily.

## Workflow Overview

The workflow will:
1. Trigger at 11:59 PM IST (18:29 UTC) every day
2. Call your dashboard's API to aggregate today's activity_logs into daily_summary
3. Log the result

## Setup Steps

### 1. Create New Workflow in n8n

1. Open n8n dashboard
2. Click "Create New Workflow"
3. Name it: "Daily Summary Aggregation"

### 2. Add Schedule Trigger Node

1. Add a new node: **Schedule Trigger**
2. Configure:
   - **Trigger Mode**: Cron Expression
   - **Cron Expression**: `29 18 * * *` (18:29 UTC = 11:59 PM IST)
   
   OR use the interval mode:
   - **Trigger Mode**: Every Day
   - **Time**: 23:59 (if n8n uses your local timezone)

### 3. Add HTTP Request Node

1. Add a new node: **HTTP Request**
2. Connect it to the Schedule Trigger
3. Configure:
   - **Method**: POST
   - **URL**: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/aggregate-daily`
   - **Headers**: 
     - Content-Type: application/json
   - **Body Content Type**: JSON
   - **JSON Body**:
     ```json
     {
       "date": "{{ $now.format('yyyy-MM-dd') }}"
     }
     ```

### 4. (Optional) Add Notification Node

Add a **Slack** or **Email** node to notify you when the aggregation runs.

## Workflow JSON (Import this)

Copy this JSON and import it into n8n:

```json
{
  "name": "Daily Summary Aggregation",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "triggerAtMinute": 59,
              "triggerAtHour": 23
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://YOUR-VERCEL-DOMAIN.vercel.app/api/aggregate-daily",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "date",
              "value": "={{ $now.format('yyyy-MM-dd') }}"
            }
          ]
        },
        "options": {}
      },
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [470, 300]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Testing

1. Replace `YOUR-VERCEL-DOMAIN` with your actual domain
2. Click "Execute Workflow" to test manually
3. Check the response - it should show:
   ```json
   {
     "success": true,
     "date": "2024-12-20",
     "processed": 5,
     "results": [...]
   }
   ```

## Alternative: Using Cron Expression

If your n8n server is in UTC, use this cron expression to trigger at 11:59 PM IST:

```
29 18 * * *
```

This is because IST is UTC+5:30, so 23:59 IST = 18:29 UTC.

## Troubleshooting

- **No data processed**: Make sure employees have activity_logs for today
- **API Error**: Check that your Vercel deployment is live
- **Authentication**: If needed, add an API key to the request headers
