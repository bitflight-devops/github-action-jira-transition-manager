import * as core from '@actions/core'
import * as path from 'path'

import {Args, JiraAuthConfig} from './@types'
import * as fsHelper from './fs-helper'

export function getInputs(): Args {
  const obj = {} as unknown
  const result = obj as Args
  const jiraConfig = obj as JiraAuthConfig

  jiraConfig.baseUrl = process.env.JIRA_BASE_URL ?? core.getInput('jira_base_url') ?? null
  if (!jiraConfig.baseUrl) {
    throw new Error('JIRA_BASE_URL env not defined, or supplied as action input jira_base_url')
  }
  jiraConfig.token = process.env.JIRA_API_TOKEN ?? core.getInput('jira_api_token') ?? null
  if (!jiraConfig.token) {
    throw new Error('JIRA_API_TOKEN env not defined, or supplied as action input jira_api_token')
  }
  jiraConfig.email = process.env.JIRA_USER_EMAIL ?? core.getInput('jira_user_email') ?? null
  if (!jiraConfig.email) {
    throw new Error('JIRA_USER_EMAIL env not defined, or supplied as action input jira_user_email')
  }

  result.config = jiraConfig
  result.issues = core.getInput('issues')
  result.failOnError = core.getInput('fail-on-error') === 'true'
  core.debug(`issues = ${result.issues}`)

  // GitHub workspace
  let githubWorkspacePath = process.env.GITHUB_WORKSPACE
  if (!githubWorkspacePath) {
    throw new Error('GITHUB_WORKSPACE not defined')
  }
  githubWorkspacePath = path.resolve(githubWorkspacePath)
  core.debug(`GITHUB_WORKSPACE = '${githubWorkspacePath}'`)
  fsHelper.directoryExistsSync(githubWorkspacePath, true)

  result.jiraTransitionsYaml = core.getInput('jira_transitions_yaml')
  core.debug(`Jira Transitions YAML input: \n${result.jiraTransitionsYaml}`)

  return result
}
