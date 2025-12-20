# Supabase Setup Instructions

1.  **Create a Supabase Project**
    *   Go to [database.new](https://database.new) and create a new project.
    *   Note down the `Reference ID`, `Project URL`, and `Anon Key`.

2.  **Database Schema**
    *   Go to the **SQL Editor** in your Supabase dashboard.
    *   Copy the contents of `docs/schema.sql` and paste it into the editor.
    *   Run the script to create the tables and policies.

3.  **Authentication**
    *   Go to **Authentication > Providers**.
    *   Ensure **Email/Password** is enabled.
    *   (Optional) Disable "Confirm email" if you want faster testing.

4.  **Environment Variables**
    *   You will need these for the Next.js Dashboard and the C# Agent.
    *   `NEXT_PUBLIC_SUPABASE_URL`: Your Project URL
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Anon Key
    *   `SUPABASE_SERVICE_ROLE_KEY`: (For Admin Dashboard server-side operations) - Keep this secret!

5.  **Realtime**
    *   Go to **Database > Replication**.
    *   Enable replication for the `activity_logs` table to allow the dashboard to subscribe to changes.
