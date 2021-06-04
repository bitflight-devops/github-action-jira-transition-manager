/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable security/detect-object-injection */
import * as core from '@actions/core'
import {Context} from '@actions/github/lib/context'
import * as fs from 'fs'
import * as YAML from 'yaml'

import {Args} from './@types'
import {fileExistsSync} from './fs-helper'
import Jira from './Jira'

export const isObject = (v: any): boolean => {
  return v && typeof v === 'object'
}

export function objEquals(v1: any, v2: any): boolean {
  core.debug(`Comparing a:${JSON.stringify(v1)} to b:${JSON.stringify(v2)} (${v1 === v2})`)
  return v1 === v2
}

export function checkConditions(a: any, b: any): boolean {
  for (const k of Object.keys(b)) {
    if (isObject(a[k]) && isObject(b[k]) ? checkConditions(a[k], b[k]) : objEquals(a[k], b[k])) {
      return true
    } else {
      return false
    }
  }
  return false
}

export type GitHubEventConditions = {
  // Key is the GitHub event
  [key: string]: string
}
export type GitHubEvents = {
  // Key is the GitHub event
  [key: string]: GitHubEventConditions | undefined
}

export type StatusEvents = {
  // Key is the job state name
  [key: string]: GitHubEvents
}

export interface JiraProjectTransitionEvents {
  ignored_states?: string[]
  to_state: StatusEvents
}
export type JiraProjects = {
  [key: string]: JiraProjectTransitionEvents
}

export interface GitHubEventJiraTransitions {
  projects: Map<string, JiraProjectTransitionEvents>
}

const yamlConfigPath = '.github/github_event_jira_transitions.'
export default class TransitionEventManager {
  context: Context
  projects: JiraProjects = {}
  jira: Jira
  failOnError = false
  ignoredStates: Map<string, string[]>
  listenForEvents: string[] = []

  constructor(context: Context, jira: Jira, argv: Args) {
    this.jira = jira
    this.context = context
    this.failOnError = argv.failOnError
    this.ignoredStates = new Map<string, string[]>()

    let yml: string
    if (argv.jiraTransitionsYaml) {
      yml = argv.jiraTransitionsYaml
    } else if (fileExistsSync(yamlConfigPath + 'yml')) {
      yml = fs.readFileSync(yamlConfigPath + 'yml', 'utf8')
    } else if (fileExistsSync(yamlConfigPath + 'yaml')) {
      yml = fs.readFileSync(yamlConfigPath + 'yaml', 'utf8')
    } else {
      throw new Error(`No GitHub event configuration found as an input or as yml file in ${yamlConfigPath}`)
    }

    const yObj = YAML.parse(yml)

    if (!Object.prototype.hasOwnProperty.call(yObj, 'projects')) {
      const estring = `The YAML config file doesn't have a 'projects' key`
      if (this.failOnError) {
        throw new Error(estring)
      } else {
        core.warning(estring)
        return this
      }
    }

    this.projects = yObj.projects as JiraProjects

    Object.entries(this.projects).forEach(([projectName, transitionEvent]) => {
      const pName = projectName.toUpperCase()
      core.info(`Project ${pName} configuration loaded`)

      if (transitionEvent.ignored_states) {
        this.ignoredStates.set(pName, transitionEvent.ignored_states)
      }
    })
  }

  getIgnoredStates(currentProject: string): string[] {
    return this.ignoredStates.get(currentProject.toUpperCase()) ?? []
  }

  githubEventToState(currentProjectName: string): string {
    core.debug(`starting githubEventToState(${currentProjectName})`)
    core.debug(`Github Context is \n${YAML.stringify(this.context)}`)

    if (Object.prototype.hasOwnProperty.call(this.projects, currentProjectName)) {
      core.debug(`looping through Projects to get transition conditions`)

      const transitionEvent = this.projects[currentProjectName]
      for (const stateName of Object.keys(transitionEvent.to_state)) {
        core.debug(`Checking GitHub context against conditions needed to transition to ${stateName}`)

        for (const ixConditions of Object.values(transitionEvent.to_state[stateName])) {
          core.debug(`Checking GitHub payload is compared to: \n${YAML.stringify(ixConditions)}`)
          if (checkConditions(this.context, ixConditions)) {
            core.debug(`Checking GitHub payload meets the conditions to transition to ${stateName}`)
            return stateName
          }
        }
      }
    } else {
      core.debug(`No project found in config named ${currentProjectName}`)
    }

    return ''
  }
}
