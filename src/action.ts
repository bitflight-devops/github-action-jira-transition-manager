import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context';

import type { Args, JiraConfig } from './@types';
import Issue, { type IssueOutput } from './Issue';
import Jira from './Jira';

export class Action {
  jira: Jira;

  config: JiraConfig;

  argv: Args;

  githubEvent: Context;

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
