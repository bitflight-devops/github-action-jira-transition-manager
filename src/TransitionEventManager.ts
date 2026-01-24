import * as fs from 'node:fs';

import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context';
import * as YAML from 'yaml';

import type { Args } from './@types';
import { fileExistsSync } from './fs-helper';
import type Jira from './Jira';

/**
 * Checks if a value is a non-null object.
 * @param v - The value to check
 * @returns True if the value is a non-null object, false otherwise
 */
export const isObject = (v: any): boolean => {
  return v && typeof v === 'object';
};

/**
 * Compares two values for strict equality and logs the comparison.
 * @param v1 - The first value to compare
 * @param v2 - The second value to compare
 * @returns True if the values are strictly equal, false otherwise
 */
export function objEquals(v1: any, v2: any): boolean {
  core.debug(`Comparing a:${JSON.stringify(v1)} to b:${JSON.stringify(v2)} (${v1 === v2})`);
  return v1 === v2;
}

/**
 * Recursively checks if object `a` satisfies the conditions defined in object `b`.
 * For nested objects, performs deep comparison. For primitive values, uses strict equality.
 * @param a - The object to check (typically GitHub context payload)
 * @param b - The conditions object to match against
 * @returns True if any key in `b` matches the corresponding value in `a`
 */
export function checkConditions(a: any, b: any): boolean {
  return Object.keys(b).some((k) => {
    return isObject(a[k]) && isObject(b[k]) ? checkConditions(a[k], b[k]) : objEquals(a[k], b[k]);
  });
}

export type GitHubEventConditions = {
  // Key is the GitHub event
  [key: string]: string;
};
export type GitHubEvents = {
  // Key is the GitHub event
  [key: string]: GitHubEventConditions | undefined;
};

export type StatusEvents = {
  // Key is the job state name
  [key: string]: GitHubEvents;
};

export interface JiraProjectTransitionEvents {
  ignored_states?: string[];
  to_state: StatusEvents;
}
export type JiraProjects = {
  [key: string]: JiraProjectTransitionEvents;
};

export interface GitHubEventJiraTransitions {
  projects: Map<string, JiraProjectTransitionEvents>;
}

interface JiraProjectTransitionEventsConfig {
  projects?: JiraProjects;
}
const yamlConfigPath = '.github/github_event_jira_transitions.';

/**
 * Manages the mapping between GitHub events and Jira issue state transitions.
 * Loads configuration from YAML that defines which GitHub events trigger which Jira transitions.
 */
export default class TransitionEventManager {
  /** The GitHub Actions context containing event payload and metadata */
  context: Context;

  /** Map of project keys to their transition event configurations */
  projects: JiraProjects = {};

  /** Jira client instance for API operations */
  jira: Jira;

  /** Whether to throw errors or log warnings when configuration issues occur */
  failOnError = false;

  /** Map of project keys (uppercase) to arrays of state names that should be ignored during transitions */
  ignoredStates: Map<string, string[]>;

  /** List of GitHub event types this manager listens for */
  listenForEvents: string[] = [];

  /**
   * Creates a new TransitionEventManager instance.
   * @param context - The GitHub Actions context containing event information
   * @param jira - The Jira client instance
   * @param argv - Command-line arguments including configuration options
   * @throws Error if no YAML configuration is found (either as input or file) and failOnError is true
   * @throws Error if the YAML configuration lacks a 'projects' key and failOnError is true
   */
  constructor(context: Context, jira: Jira, argv: Args) {
    this.jira = jira;
    this.context = context;
    this.failOnError = argv.failOnError;
    this.ignoredStates = new Map<string, string[]>();

    let yml: string;
    if (argv.jiraTransitionsYaml) {
      yml = argv.jiraTransitionsYaml;
    } else if (fileExistsSync(`${yamlConfigPath}yml`)) {
      yml = fs.readFileSync(`${yamlConfigPath}yml`, 'utf8');
    } else if (fileExistsSync(`${yamlConfigPath}yaml`)) {
      yml = fs.readFileSync(`${yamlConfigPath}yaml`, 'utf8');
    } else {
      throw new Error(`No GitHub event configuration found as an input or as yml file in ${yamlConfigPath}`);
    }

    const yObj: JiraProjectTransitionEventsConfig = YAML.parse(yml);

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

  /**
   * Retrieves the list of Jira states that should be ignored for a given project.
   * @param currentProject - The Jira project key (case-insensitive)
   * @returns Array of state names to ignore, or empty array if none configured
   */
  getIgnoredStates(currentProject: string): string[] {
    return this.ignoredStates.get(currentProject.toUpperCase()) ?? [];
  }

  /**
   * Determines the target Jira state based on the current GitHub event context.
   * Matches the GitHub context payload against the configured transition conditions
   * for the specified project.
   * @param currentProjectName - The Jira project key to look up transitions for
   * @returns The target state name if a matching condition is found, or empty string if no match
   */
  githubEventToState(currentProjectName: string): string {
    core.debug(`starting githubEventToState(${currentProjectName})`);
    core.debug(`Github Context is \n${YAML.stringify(this.context)}`);

    if (Object.hasOwn(this.projects, currentProjectName)) {
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
