'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.loadFileSync = exports.fileExistsSync = exports.existsSync = exports.directoryExistsSync = void 0;
const fs = __importStar(require('node:fs'));
const node_fs_1 = require('node:fs');
function directoryExistsSync(path, required) {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }
  if (existsSync(path)) {
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      return true;
    }
  }
  if (!required) {
    return false;
  }
  throw new Error(`Directory '${path}' does not exist`);
}
exports.directoryExistsSync = directoryExistsSync;
function existsSync(path) {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }
  return fs.existsSync(path);
}
exports.existsSync = existsSync;
function fileExistsSync(path) {
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
exports.fileExistsSync = fileExistsSync;
function loadFileSync(path) {
  if (!path) {
    throw new Error("Arg 'path' must not be empty");
  }
  try {
    if (fileExistsSync(path)) {
      return (0, node_fs_1.readFileSync)(path, 'utf8');
    }
  } catch (error) {
    throw new Error(`Encountered an error when reading file '${path}': ${error.message}`);
  }
  throw new Error(`Encountered an error when reading file '${path}': file not there`);
}
exports.loadFileSync = loadFileSync;
