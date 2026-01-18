"""
Setup Server - Web-Based Setup Wizard
Serves a local HTML form for employee registration
No tkinter dependency - works on all platforms
"""

import http.server
import socketserver
import webbrowser
import threading
import json
import os
import time
import urllib.parse
from pathlib import Path


# HTML Template for Setup Form
SETUP_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screen Time Agent - Setup</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            width: 100%;
            max-width: 420px;
        }
        
        .logo {
            text-align: center;
            margin-bottom: 24px;
        }
        
        .logo h1 {
            font-size: 24px;
            color: #1a1a2e;
            margin-bottom: 8px;
        }
        
        .logo p {
            color: #666;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
            font-size: 14px;
        }
        
        label .required {
            color: #e53935;
        }
        
        input, select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        
        input.error {
            border-color: #e53935;
        }
        
        .error-message {
            color: #e53935;
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }
        
        .error-message.show {
            display: block;
        }
        
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .status {
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            border-radius: 8px;
            display: none;
        }
        
        .status.success {
            display: block;
            background: #e8f5e9;
            color: #2e7d32;
        }
        
        .status.error {
            display: block;
            background: #ffebee;
            color: #c62828;
        }
        
        .status.loading {
            display: block;
            background: #e3f2fd;
            color: #1565c0;
        }
        
        .footer {
            text-align: center;
            margin-top: 24px;
            color: #999;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>🖥️ Screen Time Agent</h1>
            <p>Enter your details to start tracking</p>
        </div>
        
        <form id="setupForm">
            <div class="form-group">
                <label for="name">Full Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" placeholder="John Doe" required>
                <div class="error-message" id="nameError">Please enter your full name</div>
            </div>
            
            <div class="form-group">
                <label for="email">Email Address <span class="required">*</span></label>
                <input type="email" id="email" name="email" placeholder="john@company.com" required>
                <div class="error-message" id="emailError">Please enter a valid email address</div>
            </div>
            
            <div class="form-group">
                <label for="department">Department</label>
                <select id="department" name="department">
                    <option value="">Select Department</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="HR">Human Resources</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            
            <button type="submit" id="submitBtn">Start Monitoring</button>
            
            <div class="status" id="status"></div>
        </form>
        
        <div class="footer">
            Screen Time Agent v1.0 • Activity Tracker
        </div>
    </div>
    
    <script>
        const form = document.getElementById('setupForm');
        const status = document.getElementById('status');
        const submitBtn = document.getElementById('submitBtn');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
            
            // Validate
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const department = document.getElementById('department').value;
            
            let hasErrors = false;
            
            if (!name) {
                document.getElementById('name').classList.add('error');
                document.getElementById('nameError').classList.add('show');
                hasErrors = true;
            }
            
            if (!email || !email.includes('@')) {
                document.getElementById('email').classList.add('error');
                document.getElementById('emailError').classList.add('show');
                hasErrors = true;
            }
            
            if (hasErrors) return;
            
            // Show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Setting up...';
            status.className = 'status loading';
            status.textContent = 'Connecting to server...';
            
            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, department })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    status.className = 'status success';
                    status.innerHTML = `
                        ✓ Registration complete!<br>
                        <small>Employee ID: ${result.employee_id}</small><br>
                        <small>This window will close automatically...</small>
                    `;
                    
                    // Close window after delay
                    setTimeout(() => {
                        window.close();
                        // If window.close() doesn't work (common in browsers)
                        document.body.innerHTML = '<div style="text-align:center;padding:50px;font-family:sans-serif;"><h2>✓ Setup Complete!</h2><p>You can close this window.</p><p>The agent is now running in the background.</p></div>';
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Registration failed');
                }
            } catch (error) {
                status.className = 'status error';
                status.textContent = '✗ ' + error.message;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Try Again';
            }
        });
    </script>
</body>
</html>
'''


class SetupHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for setup wizard"""
    
    # Callback function set by the launcher
    on_register = None
    
    def log_message(self, format, *args):
        """Suppress HTTP logs"""
        pass
    
    def do_GET(self):
        """Serve the setup form"""
        if self.path == '/' or self.path == '/setup':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(SETUP_HTML.encode())
        else:
            self.send_error(404)
    
    def do_POST(self):
        """Handle form submission"""
        if self.path == '/register':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode())
                
                name = data.get('name', '').strip()
                email = data.get('email', '').strip()
                department = data.get('department', '').strip() or 'General'
                
                if not name or not email:
                    raise ValueError("Name and email are required")
                
                # Call the registration callback
                if SetupHandler.on_register:
                    result = SetupHandler.on_register(name, email, department)
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(result).encode())
                else:
                    raise ValueError("Registration handler not set")
                    
            except Exception as e:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode())
        else:
            self.send_error(404)


class SetupServer:
    """Local HTTP server for setup wizard"""
    
    def __init__(self, port=5555):
        self.port = port
        self.server = None
        self.thread = None
        self.setup_complete = threading.Event()
        self.result = None
    
    def register_employee(self, name: str, email: str, department: str) -> dict:
        """Register employee with database - called by form submission"""
        try:
            from config import load_config, save_config, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY
            from database import get_database
            
            # Connect to database
            db = get_database(
                "supabase",
                url=DEFAULT_SUPABASE_URL,
                key=DEFAULT_SUPABASE_KEY
            )
            
            if not db.connect():
                return {
                    'success': False,
                    'error': 'Failed to connect to database. Check your internet connection.'
                }
            
            # Create employee
            employee = db.create_employee_full(name, email, department)
            
            # Save config
            config = load_config()
            config.employee_id = employee.id
            config.employee_name = employee.full_name
            config.supabase_url = DEFAULT_SUPABASE_URL
            config.supabase_key = DEFAULT_SUPABASE_KEY
            save_config(config)
            
            self.result = {
                'success': True,
                'employee_id': employee.id[:8] + '...',
                'name': employee.full_name
            }
            
            # Signal completion
            self.setup_complete.set()
            
            return self.result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def start(self, timeout: int = 300):
        """Start the setup server and open browser"""
        # Set the callback
        SetupHandler.on_register = self.register_employee
        
        # Create server with allow_reuse_address
        socketserver.TCPServer.allow_reuse_address = True
        
        try:
            self.server = socketserver.TCPServer(("127.0.0.1", self.port), SetupHandler)
            self.server.timeout = 1.0  # Allow checking for shutdown
        except OSError as e:
            print(f"Could not start server on port {self.port}: {e}")
            # Try another port
            self.port = 5556
            try:
                self.server = socketserver.TCPServer(("127.0.0.1", self.port), SetupHandler)
                self.server.timeout = 1.0
            except:
                raise RuntimeError("Could not start setup server")
        
        # Flag to stop server
        self._stop_server = False
        
        # Start server in background thread
        def serve():
            while not self._stop_server and not self.setup_complete.is_set():
                try:
                    self.server.handle_request()
                except:
                    pass
            # Server loop ended
        
        self.thread = threading.Thread(target=serve, daemon=True)
        self.thread.start()
        
        # Open browser to setup page
        url = f"http://127.0.0.1:{self.port}/"
        print(f"Opening setup wizard at {url}")
        webbrowser.open(url)
        
        # Wait for setup to complete
        completed = self.setup_complete.wait(timeout=timeout)
        
        # Signal server to stop
        self._stop_server = True
        
        # Give server thread a moment to stop
        time.sleep(0.5)
        
        # Close server socket
        try:
            if self.server:
                self.server.server_close()
        except:
            pass
        
        return completed, self.result
    
    def stop(self):
        """Stop the server"""
        self._stop_server = True
        if self.server:
            try:
                self.server.server_close()
            except:
                pass
            self.server = None


def run_setup_wizard() -> tuple:
    """Run the setup wizard and return (success, result)"""
    server = SetupServer()
    return server.start()



if __name__ == "__main__":
    # Test the setup wizard
    success, result = run_setup_wizard()
    print(f"Setup complete: {success}")
    print(f"Result: {result}")
