import * as fs from 'fs'
import { readFileSync } from 'fs'

export function directoryExistsSync(path: string, required?: boolean): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty")
  }
  if (existsSync(path)) {
    const stats: fs.Stats = fs.statSync(path)
    if (stats.isDirectory()) {
      return true
    }
  }
  if (!required) {
    return false
  }
  throw new Error(`Directory '${path}' does not exist`)
}

export function existsSync(path: string): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty")
  }

  return fs.existsSync(path)
}

export function fileExistsSync(path: string): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty")
  }
  if (existsSync(path)) {
    const stats = fs.statSync(path)
    if (!stats.isDirectory()) {
      return true
    }
  }

  return false
}

export function loadFileSync(path: string): string {
  if (!path) {
    throw new Error("Arg 'path' must not be empty")
  }
  try {
    if (fileExistsSync(path)) {
      return readFileSync(path, 'utf8')
    }
  } catch (error) {
    throw new Error(`Encountered an error when reading file '${path}': ${(error as Error).message}`)
  }
  throw new Error(`Encountered an error when reading file '${path}': file not there`)
}
