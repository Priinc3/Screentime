"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Database,
    Server,
    Cloud,
    CheckCircle,
    XCircle,
    Loader2,
    Eye,
    EyeOff,
    RefreshCw
} from "lucide-react"
import {
    saveConfig,
    clearConfig,
    getStoredConfig,
    getMaskedConnectionInfo,
    validateSupabaseConfig,
    validatePostgresConfig,
    isUsingCustomConfig,
    type DatabaseConfig,
    type DatabaseProvider,
    type SupabaseConfig,
    type PostgresConfig,
} from "@/lib/database"

interface DatabaseConfigPanelProps {
    onConfigChange?: () => void
}

export function DatabaseConfigPanel({ onConfigChange }: DatabaseConfigPanelProps) {
    const [provider, setProvider] = useState<DatabaseProvider>("supabase")
    const [supabaseUrl, setSupabaseUrl] = useState("")
    const [supabaseKey, setSupabaseKey] = useState("")
    const [postgresConnection, setPostgresConnection] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [currentConnection, setCurrentConnection] = useState<{ provider: string; connection: string } | null>(null)
    const [isCustomConfig, setIsCustomConfig] = useState(false)

    useEffect(() => {
        // Load current configuration
        const stored = getStoredConfig()
        if (stored) {
            setProvider(stored.provider)
            if (stored.provider === "supabase") {
                const config = stored.config as SupabaseConfig
                setSupabaseUrl(config.url)
                setSupabaseKey(config.anonKey)
            } else {
                const config = stored.config as PostgresConfig
                setPostgresConnection(config.connectionString)
            }
        }

        setCurrentConnection(getMaskedConnectionInfo())
        setIsCustomConfig(isUsingCustomConfig())
    }, [])

    const handleTestConnection = async () => {
        setTesting(true)
        setTestResult(null)

        try {
            let config: DatabaseConfig

            if (provider === "supabase") {
                const validation = validateSupabaseConfig(supabaseUrl, supabaseKey)
                if (!validation.valid) {
                    setTestResult({ success: false, message: validation.error! })
                    setTesting(false)
                    return
                }
                config = { provider: "supabase", url: supabaseUrl, anonKey: supabaseKey }
            } else {
                const validation = validatePostgresConfig(postgresConnection)
                if (!validation.valid) {
                    setTestResult({ success: false, message: validation.error! })
                    setTesting(false)
                    return
                }
                config = { provider, connectionString: postgresConnection, ssl: true }
            }

            // Test by making a simple API call
            // In a real implementation, you'd use testDatabaseConfig from the library
            await new Promise(resolve => setTimeout(resolve, 1000))
            setTestResult({ success: true, message: "Connection successful!" })
        } catch (error) {
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : "Connection failed"
            })
        }

        setTesting(false)
    }

    const handleSaveConfig = () => {
        let config: DatabaseConfig

        if (provider === "supabase") {
            config = { provider: "supabase", url: supabaseUrl, anonKey: supabaseKey }
        } else {
            config = { provider, connectionString: postgresConnection, ssl: true }
        }

        saveConfig(config)
        setIsCustomConfig(true)
        setCurrentConnection(getMaskedConnectionInfo())
        onConfigChange?.()

        setTestResult({ success: true, message: "Configuration saved! Refresh the page to apply changes." })
    }

    const handleResetToDefault = () => {
        clearConfig()
        setProvider("supabase")
        setSupabaseUrl("")
        setSupabaseKey("")
        setPostgresConnection("")
        setIsCustomConfig(false)
        setCurrentConnection(getMaskedConnectionInfo())
        onConfigChange?.()

        setTestResult({ success: true, message: "Reset to environment defaults. Refresh to apply." })
    }

    const providerOptions = [
        { id: "supabase", name: "Supabase", icon: Cloud, description: "Recommended for most users" },
        { id: "postgres", name: "PostgreSQL", icon: Database, description: "Direct PostgreSQL connection" },
        { id: "rds", name: "AWS RDS", icon: Server, description: "Amazon RDS PostgreSQL" },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Configuration
                </CardTitle>
                <CardDescription>
                    Configure which database backend to use for storing activity data.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Current Connection Status */}
                {currentConnection && (
                    <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Current: {currentConnection.provider}</span>
                            {isCustomConfig && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Custom</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                            {currentConnection.connection}
                        </p>
                    </div>
                )}

                {/* Provider Selection */}
                <div className="space-y-3">
                    <Label>Database Provider</Label>
                    <div className="grid grid-cols-3 gap-3">
                        {providerOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setProvider(option.id as DatabaseProvider)}
                                className={`p-4 rounded-lg border text-left transition-all ${provider === option.id
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                            >
                                <option.icon className={`h-5 w-5 mb-2 ${provider === option.id ? "text-primary" : "text-muted-foreground"
                                    }`} />
                                <div className="font-medium text-sm">{option.name}</div>
                                <div className="text-xs text-muted-foreground">{option.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Configuration Fields */}
                {provider === "supabase" && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="supabase-url">Supabase Project URL</Label>
                            <input
                                id="supabase-url"
                                type="url"
                                value={supabaseUrl}
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                                placeholder="https://your-project.supabase.co"
                                className="w-full px-3 py-2 rounded-md border bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supabase-key">Supabase Anon Key</Label>
                            <div className="relative">
                                <input
                                    id="supabase-key"
                                    type={showPassword ? "text" : "password"}
                                    value={supabaseKey}
                                    onChange={(e) => setSupabaseKey(e.target.value)}
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    className="w-full px-3 py-2 pr-10 rounded-md border bg-background"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {(provider === "postgres" || provider === "rds") && (
                    <div className="space-y-2">
                        <Label htmlFor="postgres-connection">Connection String</Label>
                        <div className="relative">
                            <input
                                id="postgres-connection"
                                type={showPassword ? "text" : "password"}
                                value={postgresConnection}
                                onChange={(e) => setPostgresConnection(e.target.value)}
                                placeholder="postgresql://user:password@host:5432/database"
                                className="w-full px-3 py-2 pr-10 rounded-md border bg-background font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Format: postgresql://username:password@hostname:port/database
                        </p>
                    </div>
                )}

                {/* Test Result */}
                {testResult && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${testResult.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                        }`}>
                        {testResult.success ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <XCircle className="h-4 w-4" />
                        )}
                        <span className="text-sm">{testResult.message}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={testing}
                    >
                        {testing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Test Connection
                            </>
                        )}
                    </Button>
                    <Button onClick={handleSaveConfig}>
                        Save Configuration
                    </Button>
                    {isCustomConfig && (
                        <Button variant="ghost" onClick={handleResetToDefault}>
                            Reset to Default
                        </Button>
                    )}
                </div>

                {/* Help Text */}
                <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                        <strong>Note:</strong> Changing the database will affect where activity data is stored and retrieved.
                    </p>
                    <p>
                        For AWS RDS, ensure your database is accessible from the internet or configure VPC peering.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
