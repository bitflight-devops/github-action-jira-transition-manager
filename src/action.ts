import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context';

import type { Args, JiraConfig } from './@types';
import Issue, { type IssueOutput } from './Issue';
import Jira from './Jira';

/**
 * Main action class that orchestrates Jira issue transitions based on GitHub events.
 *
 * This class manages the workflow of transitioning multiple Jira issues in parallel,
 * using configuration from the action inputs and the GitHub event context to determine
 * target states.
 */
export class Action {
  /** Jira API client instance for making API calls */
  jira: Jira;

  /** Configuration for connecting to Jira (baseUrl, token, email) */
  config: JiraConfig;

  /** Parsed action arguments including issues list and transition configuration */
  argv: Args;

  /** GitHub event context providing information about the triggering event */
  githubEvent: Context;

  /**
   * Creates a new Action instance.
   *
   * @param githubEvent - The GitHub Actions context containing event information
   * @param argv - Parsed action arguments including Jira configuration and issue list
   */
  constructor(githubEvent: Context, argv: Args) {
    this.jira = new Jira({
      baseUrl: argv.config.baseUrl,
      token: argv.config.token,
      email: argv.config.email,
    });

    this.config = argv.config;
    this.argv = argv;
    this.githubEvent = githubEvent;
  }

  /**
   * Transitions a single Jira issue to its target state.
   *
   * Attempts to transition the issue and returns the output data on success.
   * On failure, logs the error (or fails the action if failOnError is enabled)
   * and returns undefined.
   *
   * @param issueObj - The Issue instance to transition
   * @returns The issue output data if successful, undefined if the transition failed
   */
  async transitionIssue(issueObj: Issue): Promise<IssueOutput | undefined> {
    return issueObj
      .transition()
      .then(async () => {
        return issueObj.getOutputs();
      })
      .catch((error) => {
        if (error instanceof Error) {
          if (this.argv.failOnError) {
            core.setFailed(error);
          } else {
            core.error(error);
          }
        }
        return undefined;
      });
  }

  /**
   * Executes the action by processing all specified Jira issues.
   *
   * Parses the comma-separated issue list, builds Issue objects for each,
   * and transitions them in parallel. Reports success/failure counts and
   * sets the action output with the results.
   *
   * @returns True if at least one issue was successfully transitioned, false otherwise
   */
  async execute(): Promise<boolean> {
    const { argv, jira, githubEvent } = this;
    const issueList = argv.issues.split(',');
    let successes = 0;
    let failures = 0;
    const applyIssueList: Promise<IssueOutput | undefined>[] = [];
    for (const issueKey of issueList) {
      applyIssueList.push(
        new Issue(issueKey.trim(), jira, argv, githubEvent)
          .build()
          .then(async (issueObj) => this.transitionIssue(issueObj))
          .catch((error) => {
            // Handle errors from build() (e.g., issue not found)
            if (error instanceof Error) {
              if (argv.failOnError) {
                core.setFailed(error);
              } else {
                core.error(`Failed to process issue ${issueKey}: ${error.message}`);
              }
            }
            return undefined;
          }),
      );
    }
    const issueOutputs: IssueOutput[] = await Promise.all(applyIssueList).then(
      (iList) => iList.filter(Boolean) as IssueOutput[],
    );
    failures = issueList.length - issueOutputs.length;
    successes = issueOutputs.length;
    core.info(`Successes: ${successes} Failures: ${failures}`);
    core.setOutput('issueOutputs', JSON.stringify(issueOutputs));

    return successes > 0;
  }
}
