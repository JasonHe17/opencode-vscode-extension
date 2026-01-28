import * as vscode from "vscode"
import { exec } from "child_process"
import { promisify } from "util"
import * as net from "net"

declare const AbortController: typeof globalThis.AbortController
declare const clearTimeout: typeof globalThis.clearTimeout

const execAsync = promisify(exec)

export interface ServerStatus {
  running: boolean
  port: number
  url: string
  pid?: number
  autoStarted: boolean
  version?: string
}

export class ServerManager {
  private static instance: ServerManager
  private serverProcess: any = null
  private context: vscode.ExtensionContext | null = null
  private outputChannel: vscode.OutputChannel | null = null
  private port: number = 4096
  private checkingServer: boolean = false

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel("OpenCode Server")
    console.log("[ServerManager] Initialized")
  }

  static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager()
    }
    return ServerManager.instance
  }

  setContext(context: vscode.ExtensionContext): void {
    this.context = context
  }

  setPort(port: number): void {
    this.port = port
  }

  setBaseUrl(url: string): void {
    const match = url.match(/:(\d+)$/)
    if (match) {
      this.port = parseInt(match[1], 10)
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString()
    this.outputChannel?.appendLine(`[${timestamp}] ${message}`)
    console.log(`[ServerManager] ${message}`)
  }

  async checkServerStatus(attempts: number = 3): Promise<ServerStatus> {
    const url = `http://localhost:${this.port}`
    
    for (let i = 0; i < attempts; i++) {
      try {
        const controller = new AbortController()
        const abortTimeoutId = setTimeout(() => controller.abort(), 2000)
        const response = await fetch(`${url}/`, {
          method: "GET",
          signal: controller.signal
        })
        clearTimeout(abortTimeoutId)
        
        if (response.ok) {
          try {
            const data = await response.json() as any
            this.log(`Server responding (version: ${data.version || "unknown"})`)
            return {
              running: true,
              port: this.port,
              url,
              autoStarted: false,
              version: data.version
            }
          } catch {
            this.log("Server responding (could not parse version)")
            return {
              running: true,
              port: this.port,
              url,
              autoStarted: false
            }
          }
        }
      } catch {
        if (i < attempts - 1) {
          await this.delay(300)
        }
      }
    }

    this.log(`Server not responding on port ${this.port}`)
    return {
      running: false,
      port: this.port,
      url,
      autoStarted: false
    }
  }

  async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer()
      
      server.once("error", () => {
        resolve(true)
      })
      
      server.once("listening", () => {
        server.close()
        resolve(false)
      })
      
      server.listen(port, "127.0.0.1")
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async ensureServerRunning(): Promise<ServerStatus> {
    if (this.checkingServer) {
      return { running: false, port: this.port, url: `http://localhost:${this.port}`, autoStarted: false }
    }

    this.checkingServer = true
    this.log("Checking server status...")

    try {
      const status = await this.checkServerStatus()
      
      if (status.running) {
        this.log("Server is already running")
        return status
      }

      const isPortInUse = await this.isPortInUse(this.port)
      
      if (isPortInUse) {
        this.log(`Port ${this.port} is in use, server may be starting up. Waiting and retrying...`)
        
        for (let i = 0; i < 5; i++) {
          await this.delay(1000)
          const retryStatus = await this.checkServerStatus()
          
          if (retryStatus.running) {
            this.log("Server is now responding")
            return retryStatus
          }
        }
        
        this.log(`Port ${this.port} is in use by another service`)
        vscode.window.showWarningMessage(
          `Port ${this.port} is already in use by another service. ` +
          `Please change the port in settings or stop the conflicting service.`
        )
        return { running: false, port: this.port, url: `http://localhost:${this.port}`, autoStarted: false }
      }

      this.log("Server not running, attempting to start...")
      return await this.startServer()
    } finally {
      this.checkingServer = false
    }
  }

  async startServer(): Promise<ServerStatus> {
    return new Promise((resolve) => {
      this.log("Starting OpenCode server...")

      const status: ServerStatus = {
        running: false,
        port: this.port,
        url: `http://localhost:${this.port}`,
        autoStarted: true
      }

      let startTimeoutId: NodeJS.Timeout | null = null
      const checkCommand = process.platform === "win32" ? "opencode.cmd" : "opencode"
      
      execAsync(`${checkCommand} --version`)
        .then(({ stdout }) => {
          this.log(`OpenCode version: ${stdout.trim()}`)
          
          const startCommand = `${checkCommand} serve --port ${this.port}`
          
          this.outputChannel?.show(true)
          this.log(`Executing: ${startCommand}`)

          this.serverProcess = exec(startCommand, {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
            env: {
              ...process.env,
              PATH: process.env.PATH
            }
          })

          if (this.serverProcess.stdout) {
            this.serverProcess.stdout.on("data", (data: Buffer) => {
              const text = data.toString()
              this.log(text)
              
              const readyIndicators = ["ready", "listening", "started", "serving"]
              if (readyIndicators.some(indicator => text.toLowerCase().includes(indicator))) {
                this.log("Server started successfully!")
                status.running = true
                
                setTimeout(async () => {
                  const finalStatus = await this.checkServerStatus(5)
                  resolve({ ...status, ...finalStatus })
                }, 2000)
              }
            })
          }

          if (this.serverProcess.stderr) {
            this.serverProcess.stderr.on("data", (data: Buffer) => {
              this.log(`[STDERR] ${data.toString()}`)
            })
          }

          const exitTimeoutId = setTimeout(() => {
            if (!status.running) {
              this.log("Server start timed out")
              vscode.window.showWarningMessage(
                "OpenCode server took too long to start. " +
                `Check the "OpenCode Server" output channel for details.`
              )
              resolve({ ...status, running: false })
            }
          }, 15000)
          startTimeoutId = exitTimeoutId

          this.serverProcess.on("exit", (code: number) => {
            if (startTimeoutId) clearTimeout(startTimeoutId)
            if (code !== 0 && !status.running) {
              this.log(`Server process exited unexpectedly with code ${code}`)
              resolve({ ...status, running: false })
            }
          })

          this.serverProcess.on("error", (err: Error) => {
            if (startTimeoutId) clearTimeout(startTimeoutId)
            this.log(`Server error: ${err.message}`)
            
            if (err.message.includes("ENOENT") || err.message.includes("not found")) {
              vscode.window.showErrorMessage(
                "OpenCode CLI tool is not installed or not found in PATH. " +
                "Please install OpenCode first: https://opencode.ai",
                "Open Website"
              ).then(selection => {
                if (selection === "Open Website") {
                  vscode.env.openExternal(vscode.Uri.parse("https://opencode.ai"))
                }
              })
            } else {
              vscode.window.showErrorMessage(
                `Failed to start OpenCode server: ${err.message}`
              )
            }
            
            resolve({ ...status, running: false })
          })
        })
        .catch((error) => {
          this.log(`Failed to check opencode installation: ${error.message}`)
          
          vscode.window.showErrorMessage(
            "OpenCode CLI tool is not installed. " +
            "Please install OpenCode first: https://opencode.ai",
            "Open Website"
          ).then(selection => {
            if (selection === "Open Website") {
              vscode.env.openExternal(vscode.Uri.parse("https://opencode.ai"))
            }
          })
          
          resolve({ ...status, running: false })
        })
    })
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.log("Stopping server...")
      this.serverProcess.kill("SIGTERM")
      this.serverProcess = null
      this.log("Server stopped")
    }
  }

  showOutputChannel(): void {
    this.outputChannel?.show(true)
  }

  dispose(): void {
    this.stopServer()
    this.outputChannel?.dispose()
    ServerManager.instance = null as any
  }
}

export function getServerManager(): ServerManager {
  return ServerManager.getInstance()
}
