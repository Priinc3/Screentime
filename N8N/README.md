# 📧 Screen Time Email Reports - n8n Workflow

This workflow sends **daily, weekly, and monthly** screen time reports via email with detailed information from Supabase.

## 📁 Files

- `screen_time_email_report.json` - Import this into n8n

---

## 🚀 Setup Instructions

### 1. Import Workflow
1. Open n8n
2. Click **"..."** → **"Import from File"**
3. Select `screen_time_email_report.json`

### 2. Configure Supabase Credentials
1. Go to **Credentials** in n8n
2. Create a **Supabase API** credential:
   - **Host**: `https://YOUR_PROJECT.supabase.co`
   - **Service Role Key**: Your `service_role_key` from Supabase

3. Update the Supabase nodes to use your credential

### 3. Configure Email (SMTP)
1. Create an **SMTP** credential:
   - For **Gmail**: Use App Password (not regular password)
   - For **SendGrid/Mailgun**: Use API credentials

2. Update the **"Send Email Report"** node:
   - `fromEmail`: Your sender email
   - `toEmail`: Recipient email(s)

### 4. Activate the Workflow
Click **"Activate"** in the top-right corner.

---

## ⏰ Schedule

| Report | Schedule | Data Range |
|--------|----------|------------|
| **Daily** | Every day at 9:00 AM | Yesterday's data |
| **Weekly** | Every Monday at 9:00 AM | Last week (Mon-Sun) |
| **Monthly** | 1st of month at 9:00 AM | Previous month |

> Adjust times in the Schedule Trigger nodes if needed.

---

## 📊 What's Included

The reports include:

### Summary Statistics
- Total employees tracked
- Total screen time
- Total activity count
- Average time per employee

### Per-Employee Details
- Full name, department, email
- Total screen time for period
- Session count & days active
- Top 5 apps with time breakdown
- Average daily usage

### Detailed Activity Logs (Daily Report Only)
- App name & window title
- Start time & duration
- Expandable activity table

---

## 🗄️ Supabase Tables Used

| Table | Purpose |
|-------|---------|
| `employees` | Employee info (name, email, dept) |
| `daily_summary` | Aggregated daily totals |
| `activity_logs` | Detailed activity records |

---

## ⚙️ Customization

### Change Report Recipients
Edit the **"Send Email Report"** node → `toEmail` field.

### Adjust Report Times
Edit the **Schedule Trigger** nodes → Modify hour/minute.

### Filter Employees
Add a WHERE clause in the Supabase query nodes:
```sql
AND e.id NOT IN ('excluded-id-1', 'excluded-id-2')
```

### Change Activity Duration Filter
The query filters activities ≤ 2 hours (7200 seconds). Modify in **Fetch Activity Logs**:
```sql
AND al.duration_seconds <= 7200
```

---

## 🧪 Testing

1. **Manual Run**: Click **"Execute Workflow"** on any trigger
2. **Test Single Branch**: Click on a specific trigger node → **"Execute Node"**
3. Check email inbox for the report

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No data in report | Check date range, verify Supabase has data |
| Email not sending | Verify SMTP credentials, check spam folder |
| Supabase error | Ensure service_role key is correct |
| Timezone issues | All queries use IST (+05:30) |

---

## 📞 Support

For issues, check:
1. n8n execution logs
2. Supabase query results
3. SMTP server status
