# Employee Monitoring System

A comprehensive system to monitor employee active window usage, featuring a Windows Agent and a Web Admin Dashboard.

## Project Structure

*   **`/agent`**: C# .NET 8 Worker Service for Windows. Monitors active windows and uploads data.
*   **`/dashboard`**: Next.js Admin Dashboard. Visualizes employee activity.
*   **`/docs`**: Documentation and database scripts.

## Getting Started

### 1. Backend Setup
Follow the instructions in [docs/supabase_setup.md](docs/supabase_setup.md) to set up your Supabase database.

### 2. Admin Dashboard
```bash
cd dashboard
npm install
# Copy .env.example to .env.local and fill in credentials
npm run dev
```

### 3. Windows Agent
See [agent/README.md](agent/README.md) for instructions on compiling and running the agent on a Windows machine.
