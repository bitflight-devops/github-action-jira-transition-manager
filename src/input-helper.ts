import * as path from 'node:path';

import * as core from '@actions/core';

import type { Args, JiraAuthConfig } from './@types';
import * as fsHelper from './fs-helper';

/**
 * Retrieves and validates all required inputs for the GitHub Action.
 *
 * Collects Jira authentication configuration from environment variables or action inputs,
 * validates that required values are present, and assembles the complete arguments object
 * needed to run the action.
 *
 * @returns The validated action arguments containing Jira config, issue keys, and settings
 * @throws {Error} When JIRA_BASE_URL is not defined in environment or action inputs
 * @throws {Error} When JIRA_API_TOKEN is not defined in environment or action inputs
 * @throws {Error} When JIRA_USER_EMAIL is not defined in environment or action inputs
 * @throws {Error} When GITHUB_WORKSPACE environment variable is not defined
 */
export function getInputs(): Args {
  const result = {} as unknown as Args;
  const jiraConfig = {} as unknown as JiraAuthConfig;

  jiraConfig.baseUrl = process.env.JIRA_BASE_URL ?? core.getInput('jira_base_url') ?? null;
  if (!jiraConfig.baseUrl) {
    throw new Error('JIRA_BASE_URL env not defined, or supplied as action input jira_base_url');
  }
  jiraConfig.token = process.env.JIRA_API_TOKEN ?? core.getInput('jira_api_token') ?? null;
  if (!jiraConfig.token) {
    throw new Error('JIRA_API_TOKEN env not defined, or supplied as action input jira_api_token');
  }
  jiraConfig.email = process.env.JIRA_USER_EMAIL ?? core.getInput('jira_user_email') ?? null;
  if (!jiraConfig.email) {
    throw new Error('JIRA_USER_EMAIL env not defined, or supplied as action input jira_user_email');
  }

  result.config = jiraConfig;
  result.issues = core.getInput('issues');
  result.failOnError = core.getInput('fail_on_error') === 'true';
  core.debug(`issues = ${result.issues}`);

  // GitHub workspace
  let githubWorkspacePath = process.env.GITHUB_WORKSPACE;
  if (!githubWorkspacePath) {
    throw new Error('GITHUB_WORKSPACE not defined');
  }
  githubWorkspacePath = path.resolve(githubWorkspacePath);
  core.debug(`GITHUB_WORKSPACE = '${githubWorkspacePath}'`);
  fsHelper.directoryExistsSync(githubWorkspacePath, true);

  result.jiraTransitionsYaml = core.getInput('jira_transitions_yaml');
  core.debug(`Jira Transitions YAML input: \n${result.jiraTransitionsYaml}`);

  return result;
}
