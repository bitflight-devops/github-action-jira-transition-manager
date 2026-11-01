import * as cloud from 'jira.js/cloud';
import { type Client, createClient } from 'jira.js/core';
import * as server from 'jira.js/server';

import type { JiraConfig } from './@types';

export type JiraIssue = cloud.Issue | server.Issue;
export type JiraTransition = cloud.IssueTransition | server.Transition;
export type JiraTransitions = cloud.Transitions | server.TransitionsMeta;

/** Uses jira.js's supported Cloud and Data Center endpoints without changing action inputs. */
export default class Jira {
  baseUrl: string;
  token: string;
  email: string;
  client: Client;
  private deployment?: Promise<'cloud' | 'server'>;

  constructor(conf: JiraConfig) {
    this.baseUrl = conf.baseUrl;
    this.token = conf.token;
    this.email = conf.email;
    // Both existing credential pairs use HTTP Basic: email/API token on Cloud,
    // username/password on Data Center. Discovery uses the shared v2 endpoint.
    this.client = createClient({
      host: this.baseUrl,
      auth: { type: 'basic', username: this.email, password: this.token },
    });
  }

  private getDeployment(): Promise<'cloud' | 'server'> {
    // Cache the promise too: concurrently processed issues must discover only once.
    this.deployment ??= server.getServerInfo(this.client).then(({ deploymentType }) => {
      if (deploymentType === 'Cloud') return 'cloud';
      if (deploymentType === 'Server' || deploymentType === 'Data Center') return 'server';
      throw new Error(`Unsupported Jira deployment type: ${deploymentType}`);
    });
    return this.deployment;
  }

  async getIssue(issueId: string, query?: { fields?: string[]; expand?: string }): Promise<JiraIssue> {
    const params = { issueIdOrKey: issueId, ...query };
    return (await this.getDeployment()) === 'cloud'
      ? cloud.getIssue(this.client, params)
      : server.getIssue(this.client, params);
  }

  async getIssueTransitions(issueId: string): Promise<JiraTransitions> {
    const params = { issueIdOrKey: issueId };
    return (await this.getDeployment()) === 'cloud'
      ? cloud.getTransitions(this.client, params)
      : server.getTransitions(this.client, params);
  }

  async transitionIssue(issueId: string, data: JiraTransition): Promise<void> {
    if (!data.id) throw new Error(`Missing transition ID for ${issueId}`);
    // Response-only transition metadata must not be sent back in the write body.
    const params = { issueIdOrKey: issueId, transition: { id: data.id } };
    if ((await this.getDeployment()) === 'cloud') {
      await cloud.doTransition(this.client, params);
    } else {
      await server.doTransition(this.client, params);
    }
  }
}
