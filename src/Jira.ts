import { Version2Client, Version2Models, Version2Parameters } from 'jira.js';

import { JiraConfig } from './@types';

export default class Jira {
  baseUrl: string;

  token: string;

  email: string;

  client: Version2Client;

  constructor(conf: JiraConfig) {
    this.baseUrl = conf.baseUrl;
    this.token = conf.token;
    this.email = conf.email;
    this.client = new Version2Client({
      host: this.baseUrl,
      authentication: {
        basic: {
          email: this.email,
          apiToken: this.token,
        },
      },
    });
  }

  async getIssue(
    issueId: string,
    query?: {
      fields?: string[];
      expand?: string;
    },
  ): Promise<Version2Models.Issue> {
    const params: Version2Parameters.GetIssue = {
      issueIdOrKey: issueId,
    };
    if (query != null) {
      params.fields = query.fields ?? [];
      params.expand = query.expand ?? undefined;
    }

    return this.client.issues.getIssue(params);
  }

  async getIssueTransitions(issueId: string): Promise<Version2Models.Transitions> {
    const params: Version2Parameters.GetTransitions = {
      issueIdOrKey: issueId,
    };
    return this.client.issues.getTransitions(params);
  }

  async transitionIssue(issueId: string, data: Version2Models.IssueTransition): Promise<object> {
    const params: Version2Parameters.DoTransition = {
      issueIdOrKey: issueId,
      transition: data,
    };
    return this.client.issues.doTransition(params);
  }
}
