# 🤖 AI Context File - Employee Monitor System

> **IMPORTANT**: This file must be updated whenever any significant changes are made to the project.  
> **Last Updated**: 2025-12-21

---

## 📋 Project Overview

**Project Name**: Employee Monitor / Screen Time Tracker  
**Purpose**: Track employee screen time and application usage across Windows and Mac computers  
**Repository**: https://github.com/Priinc3/Screentime

### Components:
1. **Dashboard** (Next.js) - Web admin panel for viewing reports
2. **Windows Agent** (.NET 8) - Background service for Windows PCs
3. **Mac Agent** (Python) - Background service for macOS

---

## 🔐 Credentials & Environment Variables

### Supabase (Database)
```
Location: dashboard/.env.local
Variables:
- NEXT_PUBLIC_SUPABASE_URL=<project_url>
- NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
- SUPABASE_SERVICE_ROLE_KEY=<service_role_key> (for API routes)
```

**Access Supabase Dashboard**: https://supabase.com/dashboard

### Vercel (Hosting)
```
Dashboard URL: https://vercel.com/priinc3s-projects
Deployment: Auto-deploys on push to main branch
Cron Job: /api/aggregate-daily runs at 18:29 UTC (11:59 PM IST)
```

### GitHub
```
Repository: https://github.com/Priinc3/Screentime
Branch: main
```

---

## 📁 Project Structure

```
Screen time v3/
├── dashboard/                    # Next.js web application
│   ├── app/
│   │   ├── page.tsx             # Redirects to /analysis
│   │   ├── analysis/page.tsx    # Main dashboard (Work Analysis)
│   │   ├── employees/[id]/page.tsx # Individual employee details
│   │   ├── activity/page.tsx    # Live activity feed
│   │   ├── settings/page.tsx    # Settings + excluded users
│   │   └── api/
│   │       ├── aggregate-daily/route.ts  # Cron job endpoint
│   │       └── seed-daily-summary/route.ts
│   ├── components/
│   ├── utils/
│   │   ├── dataFilters.ts       # 2hr cap logic, excluded users
│   │   └── supabase/client.ts   # Supabase client
│   ├── .env.local               # Environment variables (NOT in git)
│   └── vercel.json              # Cron job configuration
│
├── agent/EmployeeMonitor/        # Windows agent (C#/.NET 8)
│   ├── Program.cs               # Entry point
│   ├── Worker.cs                # Activity monitoring loop
│   ├── Installer.cs             # Install/uninstall logic
│   ├── Services/
│   │   ├── WindowHelper.cs      # Active window detection
│   │   └── SupabaseService.cs   # API calls to Supabase
│   ├── launcher_source.bat      # Builds from source (auto-installs .NET)
│   └── launcher_prebuilt.bat    # Uses pre-built exe
│
├── mac_agent/                    # Mac agent (Python 3)
│   ├── main.py                  # Entry point
│   ├── monitor.py               # Activity monitoring loop
│   ├── window_helper.py         # AppleScript window detection
│   ├── supabase_service.py      # API calls to Supabase
│   ├── installer.py             # LaunchAgent setup
│   ├── launcher.sh              # Interactive menu
│   └── requirements.txt         # Python dependencies
│
├── releases/                     # Zip files for distribution
│   ├── WindowsAgent-Source-v1.0.zip
│   ├── WindowsAgent-Prebuilt-v1.0.zip
│   └── MacAgent-v1.0.zip
│
└── docs/                         # Documentation
```

---

## 🗄️ Database Schema (Supabase)

### Tables:

#### `employees`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| full_name | TEXT | Employee name |
| email | TEXT | Email address |
| department | TEXT | Department name |
| last_heartbeat | TIMESTAMPTZ | Last seen online |
| current_window | TEXT | Current active window |
| current_app | TEXT | Current app name |

#### `activity_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_id | UUID | FK to employees |
| app_name | TEXT | Application name |
| window_title | TEXT | Window title |
| start_time | TIMESTAMPTZ | Activity start |
| end_time | TIMESTAMPTZ | Activity end |
| duration_seconds | INTEGER | Duration in seconds |

#### `daily_summary` (Aggregated)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_id | UUID | FK to employees |
| date | DATE | The date |
| total_seconds | INTEGER | Total work time |
| session_count | INTEGER | Number of sessions |
| top_app | TEXT | Most used app |
| first_activity | TIMESTAMPTZ | First activity |
| last_activity | TIMESTAMPTZ | Last activity |

---

## ⚙️ Key Business Rules

### 1. Activity Duration Filter
- **Activities > 2 hours are COMPLETELY IGNORED** (not capped, but skipped)
- Implemented in: `utils/dataFilters.ts` → `capDuration()`
- Also in: API routes (`aggregate-daily`, `seed-daily-summary`)

```typescript
// If duration > 7200 seconds (2hr), return 0 (ignore)
if (seconds > MAX_ACTIVITY_DURATION_SECONDS) return 0
```

### 2. Timezone Handling
- **All date queries use IST (+05:30)**
- Format: `YYYY-MM-DDT00:00:00+05:30`
- DO NOT use `.toISOString()` (that's UTC)
- Use local date: `getFullYear()`, `getMonth()`, `getDate()`

### 3. Excluded Users
- Stored in localStorage key: `excluded_user_ids`
- Managed in Settings page
- Filter applied in all data queries

### 4. Data Sources
| View | Data Source |
|------|-------------|
| Today (Daily view) | LIVE from `activity_logs` |
| Historical dates | `daily_summary` table |
| Weekly/Monthly | Sum of `daily_summary` records |

### 5. Daily Aggregation
- Runs at **11:59 PM IST** (18:29 UTC)
- Endpoint: `/api/aggregate-daily`
- Configured in: `vercel.json` (Vercel Cron) or n8n

---

## 🔄 Common Tasks

### Add a New Employee Field
1. Update Supabase table
2. Update TypeScript interfaces
3. Update relevant pages

### Change Activity Duration Limit
1. Edit `utils/dataFilters.ts` → `MAX_ACTIVITY_DURATION_SECONDS`
2. Edit `api/aggregate-daily/route.ts` → `MAX_DURATION_SECONDS`
3. Edit `api/seed-daily-summary/route.ts` → `MAX_DURATION`

### Reseed Historical Data
```
GET/POST https://YOUR-DOMAIN.vercel.app/api/seed-daily-summary
```

### Sync Today's Data Manually
```
POST https://YOUR-DOMAIN.vercel.app/api/aggregate-daily
Body: { "date": "2024-12-21" }
```

---

## 🐛 Known Issues & Solutions

### Issue: Different hours shown on different pages
**Cause**: Timezone mismatch (UTC vs IST)
**Fix**: All queries now use `+05:30` timezone offset

### Issue: Hours too high
**Cause**: Activities > 2hr being counted
**Fix**: Now completely IGNORED (return 0)

### Issue: Windows agent needs admin
**Fix**: `launcher_source.bat` and `launcher_prebuilt.bat` auto-elevate

---

## 📝 Update Checklist

When making changes, update this file if:
- [ ] Database schema changes
- [ ] New environment variables added
- [ ] Business rules change (e.g., 2hr limit)
- [ ] New API endpoints added
- [ ] Timezone handling modified
- [ ] New components/pages added

---

## 🚀 Deployment Commands

### Dashboard
```bash
cd dashboard
npm run build  # Verify build
git add -A && git commit -m "message" && git push  # Deploy
```

### Manual Cron Trigger
```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/aggregate-daily \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-12-21"}'
```

---

## 📞 Contact / Owner

**Owner**: Prince Gondaliya  
**GitHub**: @Priinc3

---

> ⚠️ **SECURITY NOTE**: Never commit actual API keys or passwords to this file.  
> Reference environment variable locations instead.
