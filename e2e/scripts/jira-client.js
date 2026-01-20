'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.JiraE2EClient = void 0;
class JiraE2EClient {
  baseUrl;
  authHeader;
  config;
  constructor(config) {
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
  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
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
      return {};
    }
    return response.json();
  }
  /**
   * Check if Jira is ready by getting server info
   */
  async getServerInfo() {
    return this.request('/rest/api/2/serverInfo');
  }
  /**
   * Get current user to verify authentication
   */
  async getMyself() {
    return this.request('/rest/api/2/myself');
  }
  /**
   * Get or create a project
   */
  async ensureProject(key, name) {
    try {
      // Try to get existing project
      return await this.request(`/rest/api/2/project/${key}`);
    } catch {
      // Project doesn't exist, create it
      // Ensure we have a valid lead
      const lead = this.config.jira.auth.username || this.config.jira.auth.email || 'admin';
      return this.request('/rest/api/2/project', {
        method: 'POST',
        body: JSON.stringify({
          key,
          name,
          projectTypeKey: 'software',
          lead,
          // Use simplified template that's widely available
          // Note: Requires Jira Software, not available in Jira Core
          projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-basic-software-development-template',
        }),
      });
    }
  }
  /**
   * List all versions for a project
   */
  async listProjectVersions(projectKey) {
    return this.request(`/rest/api/2/project/${projectKey}/versions`);
  }
  /**
   * Create a version in a project
   */
  async createVersion(projectKey, versionName) {
    return this.request('/rest/api/2/version', {
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
  async ensureVersion(projectKey, versionName) {
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
  async searchIssues(jql, fields) {
    const params = new URLSearchParams({
      jql,
      fields: fields ? fields.join(',') : '*all',
    });
    return this.request(`/rest/api/2/search?${params}`);
  }
  /**
   * Create an issue
   */
  async createIssue(projectKey, summary, issueType = 'Task', fixVersions) {
    const fields = {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
    };
    if (fixVersions && fixVersions.length > 0) {
      fields.fixVersions = fixVersions.map((name) => ({ name }));
    }
    const response = await this.request('/rest/api/2/issue', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
    // Get the full issue details
    return this.getIssue(response.key);
  }
  /**
   * Get an issue by key
   */
  async getIssue(issueKey, fields) {
    const params = fields ? `?fields=${fields.join(',')}` : '';
    return this.request(`/rest/api/2/issue/${issueKey}${params}`);
  }
  /**
   * Update issue fields
   */
  async updateIssue(issueKey, fields) {
    await this.request(`/rest/api/2/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }
  /**
   * Ensure an issue exists (search or create)
   */
  async ensureIssue(projectKey, summary, issueType = 'Task', fixVersions) {
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
exports.JiraE2EClient = JiraE2EClient;
