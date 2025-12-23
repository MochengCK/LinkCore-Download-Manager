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
      basePath = resolve(process.cwd(), 'Python')
    } else {
      basePath = resolve(process.resourcesPath, 'Python')
    }

    if (!existsSync(basePath)) {
      basePath = resolve(app.getAppPath(), '..', 'Python')
    }

    const binName = process.platform === 'win32' ? 'bin/python.exe' : 'bin/python3'
    return join(basePath, binName)
  }

  getScriptPath () {
    let basePath
    if (is.dev()) {
      basePath = resolve(process.cwd(), 'Python')
    } else {
      basePath = resolve(process.resourcesPath, 'Python')
    }
    if (!existsSync(basePath)) {
      basePath = resolve(app.getAppPath(), '..', 'Python')
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
