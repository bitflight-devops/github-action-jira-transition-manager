'use strict';
/* eslint-disable @typescript-eslint/prefer-for-of */
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
exports.checkConditions = exports.objEquals = exports.isObject = void 0;
const fs = __importStar(require('node:fs'));
const core = __importStar(require('@actions/core'));
const YAML = __importStar(require('yaml'));
const fs_helper_1 = require('./fs-helper');
const isObject = (v) => {
  return v && typeof v === 'object';
};
exports.isObject = isObject;
function objEquals(v1, v2) {
  core.debug(`Comparing a:${JSON.stringify(v1)} to b:${JSON.stringify(v2)} (${v1 === v2})`);
  return v1 === v2;
}
exports.objEquals = objEquals;
function checkConditions(a, b) {
  return Object.keys(b).some((k) => {
    return (0, exports.isObject)(a[k]) && (0, exports.isObject)(b[k])
      ? checkConditions(a[k], b[k])
      : objEquals(a[k], b[k]);
  });
}
exports.checkConditions = checkConditions;
const yamlConfigPath = '.github/github_event_jira_transitions.';
class TransitionEventManager {
  context;
  projects = {};
  jira;
  failOnError = false;
  ignoredStates;
  listenForEvents = [];
  constructor(context, jira, argv) {
    this.jira = jira;
    this.context = context;
    this.failOnError = argv.failOnError;
    this.ignoredStates = new Map();
    let yml;
    if (argv.jiraTransitionsYaml) {
      yml = argv.jiraTransitionsYaml;
    } else if ((0, fs_helper_1.fileExistsSync)(`${yamlConfigPath}yml`)) {
      yml = fs.readFileSync(`${yamlConfigPath}yml`, 'utf8');
    } else if ((0, fs_helper_1.fileExistsSync)(`${yamlConfigPath}yaml`)) {
      yml = fs.readFileSync(`${yamlConfigPath}yaml`, 'utf8');
    } else {
      throw new Error(`No GitHub event configuration found as an input or as yml file in ${yamlConfigPath}`);
    }
    const yObj = YAML.parse(yml);
    if ('projects' in yObj && yObj.projects) {
      this.projects = yObj.projects;
      for (const [projectName, transitionEvent] of Object.entries(this.projects)) {
        const pName = projectName.toUpperCase();
        core.info(`Project ${pName} configuration loaded`);
        if (transitionEvent.ignored_states) {
          this.ignoredStates.set(pName, transitionEvent.ignored_states);
        }
      }
    } else {
      const estring = `The YAML config file doesn't have a 'projects' key`;
      if (this.failOnError) {
        throw new Error(estring);
      } else {
        core.warning(estring);
      }
    }
  }
  getIgnoredStates(currentProject) {
    return this.ignoredStates.get(currentProject.toUpperCase()) ?? [];
  }
  githubEventToState(currentProjectName) {
    core.debug(`starting githubEventToState(${currentProjectName})`);
    core.debug(`Github Context is \n${YAML.stringify(this.context)}`);
    if (Object.prototype.hasOwnProperty.call(this.projects, currentProjectName)) {
      core.debug(`looping through Projects to get transition conditions`);
      const transitionEvent = this.projects[currentProjectName];
      for (const stateName of Object.keys(transitionEvent.to_state)) {
        core.debug(`Checking GitHub context against conditions needed to transition to ${stateName}`);
        for (const ixConditions of Object.values(transitionEvent.to_state[stateName])) {
          core.debug(`Checking GitHub payload is compared to: \n${YAML.stringify(ixConditions)}`);
          if (checkConditions(this.context, ixConditions)) {
            core.debug(`Checking GitHub payload meets the conditions to transition to ${stateName}`);
            return stateName;
          }
        }
      }
    } else {
      core.debug(`No project found in config named ${currentProjectName}`);
    }
    return '';
  }
}
exports.default = TransitionEventManager;
