
export interface ClientConfig {
  host: string
  port: string
  remark: string
  autoStart: string
  reconnectInterval: number
  hideConsole: boolean
  appUrl: string
  encryptionKey: string
  singleInstance: boolean
  installAsService: boolean
  protocol: "ws" | "wss"
  modules: {
    screen: boolean
    terminal: boolean
    files: boolean
    windows: boolean
    monitor: boolean
    audio: boolean
  }
  platform: "pc" | "mobile"
}

export function generatePythonScript(config: ClientConfig) {
  const modulesList = []
  if (config.modules.screen) modulesList.push("'screen'")
  if (config.modules.terminal) modulesList.push("'terminal'")
  if (config.modules.files) modulesList.push("'files'")
  if (config.modules.windows) modulesList.push("'windows'")
  if (config.modules.monitor) modulesList.push("'monitor'")
  if (config.modules.audio) modulesList.push("'audio'")

  return ``
}
