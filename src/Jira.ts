import { Version2Client, type Version2Models, type Version2Parameters } from 'jira.js';

import type { JiraConfig } from './@types';

/**
 * Wrapper around the jira.js Version2Client for Jira API interactions.
 * Provides methods for fetching issues, retrieving transitions, and transitioning issues.
 */
export default class Jira {
  /** The base URL of the Jira instance (e.g., https://company.atlassian.net) */
  baseUrl: string;

  /** The API token used for authentication */
  token: string;

  /** The email address associated with the Jira account */
  email: string;

  /** The jira.js Version2Client instance for making API calls */
  client: Version2Client;

  /**
   * Creates a new Jira client instance.
   * @param conf - Configuration object containing Jira connection details
   */
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

  /**
   * Fetches a Jira issue by its ID or key.
   * @param issueId - The issue ID or key (e.g., "PROJ-123")
   * @param query - Optional query parameters to customize the response
   * @param query.fields - Array of field names to include in the response
   * @param query.expand - Comma-separated list of entities to expand
   * @returns The requested Jira issue
   * @throws Error if the issue does not exist or the request fails
   */
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

  /**
   * Retrieves available workflow transitions for a Jira issue.
   * @param issueId - The issue ID or key (e.g., "PROJ-123")
   * @returns The available transitions for the issue
   * @throws Error if the issue does not exist or the request fails
   */
  async getIssueTransitions(issueId: string): Promise<Version2Models.Transitions> {
    const params: Version2Parameters.GetTransitions = {
      issueIdOrKey: issueId,
    };
    return this.client.issues.getTransitions(params);
  }

  /**
   * Transitions a Jira issue to a new workflow state.
   * @param issueId - The issue ID or key (e.g., "PROJ-123")
   * @param data - The transition data including the target transition ID
   * @returns An empty object on success
   * @throws Error if the transition is invalid or the request fails
   */
  async transitionIssue(issueId: string, data: Version2Models.IssueTransition): Promise<object> {
    const params: Version2Parameters.DoTransition = {
      issueIdOrKey: issueId,
      transition: data,
    };
    return this.client.issues.doTransition(params);
  }
}
