import * as fs from 'node:fs';
import { readFileSync } from 'node:fs';

/**
 * Checks if a directory exists at the specified path.
 * @param path - The filesystem path to check for a directory.
 * @param required - If true, throws an error when the directory does not exist.
 * @returns True if the directory exists, false otherwise (when not required).
 * @throws Error if path is empty or if required is true and directory does not exist.
 */
export function directoryExistsSync(path: string, required?: boolean): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }
  if (existsSync(path)) {
    const stats: fs.Stats = fs.statSync(path);
    if (stats.isDirectory()) {
      return true;
    }
  }
  if (!required) {
    return false;
  }
  throw new Error(`Directory '${path}' does not exist`);
}

/**
 * Checks if a file or directory exists at the specified path.
 * @param path - The filesystem path to check.
 * @returns True if the path exists, false otherwise.
 * @throws Error if path is empty.
 */
export function existsSync(path: string): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }

  return fs.existsSync(path);
}

/**
 * Checks if a file (not a directory) exists at the specified path.
 * @param path - The filesystem path to check for a file.
 * @returns True if a file exists at the path, false if path does not exist or is a directory.
 * @throws Error if path is empty.
 */
export function fileExistsSync(path: string): boolean {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }
  if (existsSync(path)) {
    const stats = fs.statSync(path);
    if (!stats.isDirectory()) {
      return true;
    }
  }

  return false;
}

/**
 * Reads and returns the contents of a file as a UTF-8 string.
 * @param path - The filesystem path to the file to read.
 * @returns The contents of the file as a string.
 * @throws Error if path is empty, file does not exist, or an error occurs during reading.
 */
export function loadFileSync(path: string): string {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }
  try {
    if (fileExistsSync(path)) {
      return readFileSync(path, 'utf8');
    }
  } catch (error) {
    throw new Error(`Encountered an error when reading file '${path}': ${(error as Error).message}`);
  }
  throw new Error(`Encountered an error when reading file '${path}': file not there`);
}
