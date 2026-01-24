/**
 * Jira REST API client for E2E tests
 * Uses endpoints compatible with both Cloud and Data Center where possible
 */
import { E2EConfig } from './e2e-config';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraVersion {
  self: string;
  id: string;
  name: string;
  archived: boolean;
  released: boolean;
  projectId: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    fixVersions?: JiraVersion[];
    status?: {
      name: string;
    };
    [key: string]: unknown;
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
}

export class JiraE2EClient {
  private baseUrl: string;
  private authHeader: string;
  private config: E2EConfig;

  constructor(config: E2EConfig) {
    this.config = config;
    this.baseUrl = config.jira.baseUrl;

    // Set up authentication based on type
    if (config.jira.auth.type === 'basic') {
      const credentials = Buffer.from(`${config.jira.auth.username}:${config.jira.auth.password}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    } else if (config.jira.auth.type === 'cloud') {
      const credentials = Buffer.from(`${config.jira.auth.email}:${config.jira.auth.apiToken}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    } else {
      throw new Error(`Unsupported auth type: ${config.jira.auth.type}`);
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira API error: ${response.status} ${response.statusText}\n${text}`);
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Check if Jira is ready by getting server info
   */
  async getServerInfo(): Promise<{ version: string; baseUrl: string }> {
    return this.request('/rest/api/2/serverInfo');
  }

  /**
   * Get current user to verify authentication
   */
  async getMyself(): Promise<{ displayName: string; emailAddress?: string }> {
    return this.request('/rest/api/2/myself');
  }

  /**
   * Get or create a project
   * Tries software project first (supports fixVersions), falls back to business
   */
  async ensureProject(key: string, name: string): Promise<JiraProject> {
    try {
      // Try to get existing project
      return await this.request<JiraProject>(`/rest/api/2/project/${key}`);
    } catch {
      // Project doesn't exist, create it
      const lead = this.config.jira.auth.username || this.config.jira.auth.email || 'admin';

      // Try software project first - it supports fixVersions on create screen
      try {
        return await this.request<JiraProject>('/rest/api/2/project', {
          method: 'POST',
          body: JSON.stringify({
            key,
            name,
            projectTypeKey: 'software',
            lead,
          }),
        });
      } catch (softwareError) {
        console.log(`  Note: Software project failed, trying business type`);
        // Fall back to business type (no fixVersions on create screen)
        return this.request<JiraProject>('/rest/api/2/project', {
          method: 'POST',
          body: JSON.stringify({
            key,
            name,
            projectTypeKey: 'business',
            lead,
          }),
        });
      }
    }
  }

  /**
   * List all versions for a project
   */
  async listProjectVersions(projectKey: string): Promise<JiraVersion[]> {
    return this.request<JiraVersion[]>(`/rest/api/2/project/${projectKey}/versions`);
  }

  /**
   * Create a version in a project
   */
  async createVersion(projectKey: string, versionName: string): Promise<JiraVersion> {
    return this.request<JiraVersion>('/rest/api/2/version', {
      method: 'POST',
      body: JSON.stringify({
        name: versionName,
        project: projectKey,
        released: false,
        archived: false,
      }),
    });
  }

  /**
   * Ensure a version exists (get or create)
   */
  async ensureVersion(projectKey: string, versionName: string): Promise<JiraVersion> {
    const versions = await this.listProjectVersions(projectKey);
    const existing = versions.find((v) => v.name === versionName);

    if (existing) {
      return existing;
    }

    return this.createVersion(projectKey, versionName);
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(jql: string, fields?: string[]): Promise<JiraSearchResult> {
    const params = new URLSearchParams({
      jql,
      fields: fields ? fields.join(',') : '*all',
    });

    return this.request<JiraSearchResult>(`/rest/api/2/search?${params}`);
  }

  /**
   * Create an issue
   * If fixVersions isn't on create screen, creates issue then updates it
   */
  async createIssue(
    projectKey: string,
    summary: string,
    issueType: string = 'Task',
    fixVersions?: string[],
  ): Promise<JiraIssue> {
    const fields: Record<string, unknown> = {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
    };

    // Try with fixVersions on create
    if (fixVersions && fixVersions.length > 0) {
      fields.fixVersions = fixVersions.map((name) => ({ name }));
      try {
        const response = await this.request<{ key: string; id: string }>('/rest/api/2/issue', {
          method: 'POST',
          body: JSON.stringify({ fields }),
        });
        return this.getIssue(response.key);
      } catch (error) {
        // If fixVersions not on create screen, create then update
        if (error instanceof Error && error.message.includes('fixVersions')) {
          delete fields.fixVersions;
          const response = await this.request<{ key: string; id: string }>('/rest/api/2/issue', {
            method: 'POST',
            body: JSON.stringify({ fields }),
          });
          // Update with fixVersions (REST API update bypasses screen restrictions)
          await this.updateIssue(response.key, {
            fixVersions: fixVersions.map((name) => ({ name })),
          });
          return this.getIssue(response.key);
        }
        throw error;
      }
    }

    const response = await this.request<{ key: string; id: string }>('/rest/api/2/issue', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });

    return this.getIssue(response.key);
  }

  /**
   * Get an issue by key
   */
  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    const params = fields ? `?fields=${fields.join(',')}` : '';
    return this.request<JiraIssue>(`/rest/api/2/issue/${issueKey}${params}`);
  }

  /**
   * Update issue fields
   */
  async updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void> {
    await this.request(`/rest/api/2/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  /**
   * Ensure an issue exists (search or create)
   */
  async ensureIssue(
    projectKey: string,
    summary: string,
    issueType: string = 'Task',
    fixVersions?: string[],
  ): Promise<JiraIssue> {
    // Search for existing issue
    const searchResult = await this.searchIssues(
      `project = ${projectKey} AND summary ~ "${summary}" ORDER BY created DESC`,
      ['summary', 'fixVersions', 'status'],
    );

    if (searchResult.issues.length > 0) {
      return searchResult.issues[0];
    }

    // Create new issue
    return this.createIssue(projectKey, summary, issueType, fixVersions);
  }
}
