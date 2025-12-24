import { spawn } from 'node:child_process'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import is from 'electron-is'
import logger from './Logger'

export default class PythonManager {
  constructor () {
    this.process = null
  }

  getPythonPath () {
    let basePath
    if (is.dev()) {
      basePath = resolve(process.cwd(), 'MediaParser')
    } else {
      basePath = resolve(process.resourcesPath, 'MediaParser')
    }

    if (!existsSync(basePath)) {
      basePath = resolve(app.getAppPath(), '..', 'MediaParser')
    }

    const candidates = []
    if (process.platform === 'win32') {
      candidates.push(
        join(basePath, 'python.exe'),
        join(basePath, 'python3.exe'),
        join(basePath, 'bin', 'python.exe')
      )
    } else {
      candidates.push(
        join(basePath, 'bin', 'python3'),
        join(basePath, 'bin', 'python')
      )
    }

    const found = candidates.find(p => existsSync(p))
    return found || candidates[0]
  }

  getScriptPath () {
    let basePath
    if (is.dev()) {
      basePath = resolve(process.cwd(), 'MediaParser')
    } else {
      basePath = resolve(process.resourcesPath, 'MediaParser')
    }
    if (!existsSync(basePath)) {
      basePath = resolve(app.getAppPath(), '..', 'MediaParser')
    }
    return join(basePath, 'main.py')
  }

  start () {
    if (this.process) {
      return
    }

    const pythonPath = this.getPythonPath()
    if (!existsSync(pythonPath)) {
      logger.warn('[LinkCore] Python executable not found at:', pythonPath)
      return
    }

    const scriptPath = this.getScriptPath()
    if (!existsSync(scriptPath)) {
      logger.warn('[LinkCore] Python script not found at:', scriptPath)
      return
    }

    const args = [scriptPath]

    logger.info('[LinkCore] Starting Python:', pythonPath, args)
    this.process = spawn(pythonPath, args, {
      stdio: 'ignore',
      windowsHide: true
    })

    this.process.on('error', (err) => {
      logger.error('[LinkCore] Python process error:', err)
    })

    this.process.on('close', (code) => {
      logger.info('[LinkCore] Python process exited with code:', code)
      this.process = null
    })
  }

  stop () {
    if (this.process) {
      logger.info('[LinkCore] Stopping Python process')
      this.process.kill()
      this.process = null
    }
  }
}
