/**
 * Jira E2E client using jira.js library
 * Same library as the main action for consistency
 */
import { Version2Client, type Version2Models } from 'jira.js';

import type { E2EConfig } from './e2e-config';

// Constants for formatting and logging
const MIN_ID_LENGTH_FOR_MASKING = 8;
const STACK_TRACE_LINES = 3;

/**
 * Extract detailed error information from Jira API errors
 * jira.js wraps axios errors and includes response data
 */
function extractJiraErrorDetails(error: unknown): string {
  const err = error as Error & {
    response?: { data?: { errors?: Record<string, string>; errorMessages?: string[] }; status?: number };
  };

  const parts: string[] = [err.message || String(error)];

  if (err.response?.status) {
    parts.push(`Status: ${err.response.status}`);
  }

  if (err.response?.data?.errors) {
    const errorDetails = Object.entries(err.response.data.errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ');
    if (errorDetails) {
      parts.push(`Fields: ${errorDetails}`);
    }
  }

  if (err.response?.data?.errorMessages?.length) {
    parts.push(`Messages: ${err.response.data.errorMessages.join(', ')}`);
  }

  return parts.join(' | ');
}

// Project template keys for Jira Data Center
// Reference: https://support.atlassian.com/jira/kb/creating-projects-via-rest-api-in-jira-server-and-data-center/
const PROJECT_TEMPLATES = {
  SOFTWARE_SCRUM: 'com.pyxis.greenhopper.jira:gh-scrum-template',
  SOFTWARE_KANBAN: 'com.pyxis.greenhopper.jira:gh-kanban-template',
  SOFTWARE_BASIC: 'com.pyxis.greenhopper.jira:basic-software-development-template',
  BUSINESS_CORE: 'com.atlassian.jira-core-project-templates:jira-core-project-management',
} as const;

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraVersion {
  self?: string;
  id?: string;
  name: string;
  archived?: boolean;
  released?: boolean;
  projectId?: number | string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary?: string;
    fixVersions?: JiraVersion[];
    status?: {
      name?: string;
    };
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
}

export class JiraE2EClient {
  private client: Version2Client;

  constructor(config: E2EConfig) {
    // jira.js uses email/apiToken field names for basic auth
    // For Data Center, map username->email and password->apiToken
    const email = config.jira.auth.email || config.jira.auth.username || '';
    const apiToken = config.jira.auth.apiToken || config.jira.auth.password || '';

    this.client = new Version2Client({
      host: config.jira.baseUrl,
      authentication: {
        basic: { email, apiToken },
      },
    });
  }

  /**
   * Check if Jira is ready by getting server info
   */
  async getServerInfo(): Promise<{ version: string; baseUrl: string }> {
    const info = await this.client.serverInfo.getServerInfo();
    return { version: info.version || 'unknown', baseUrl: info.baseUrl || '' };
  }

  /**
   * Get current user to verify authentication
   */
  async getMyself(): Promise<{ displayName: string; emailAddress?: string }> {
    const user = await this.client.myself.getCurrentUser();
    return { displayName: user.displayName || 'unknown', emailAddress: user.emailAddress };
  }

  /**
   * Get current user information for project lead assignment
   *
   * @returns {Promise<{accountId?: string, name?: string, isCloud: boolean}>} User info with deployment type
   *
   * @remarks
   * Jira Cloud uses accountId for project lead
   * Jira Data Center uses username (name field) for project lead
   * We detect Cloud by presence of accountId field
   */
  async getCurrentUserInfo(): Promise<{ accountId?: string; name?: string; isCloud: boolean }> {
    const user = await this.client.myself.getCurrentUser();
    // Cloud has accountId, Data Center does not
    const isCloud = !!user.accountId;
    return {
      accountId: user.accountId,
      name: user.name,
      isCloud,
    };
  }

  /**
   * Get or create a project
   */
  async ensureProject(key: string, name: string): Promise<JiraProject> {
    try {
      // Try to get existing project
      const project = await this.client.projects.getProject({ projectIdOrKey: key });
      console.log(`  Project ${key} already exists`);
      return {
        id: project.id || '',
        key: project.key || key,
        name: project.name || name,
        projectTypeKey: project.projectTypeKey || 'software',
      };
    } catch (_getError) {
      // Project doesn't exist, create it
      console.log(`  Project ${key} does not exist, creating...`);

      // Get the current user info to determine Cloud vs Data Center
      let userInfo: { accountId?: string; name?: string; isCloud: boolean };
      try {
        userInfo = await this.getCurrentUserInfo();
        const identifier = userInfo.isCloud ? userInfo.accountId : userInfo.name;

        // Validate we have the required identifier
        if (!identifier) {
          throw new Error(`Missing required user identifier: ${userInfo.isCloud ? 'accountId' : 'name'}`);
        }

        // Log only first/last 4 chars to avoid exposing full identifier
        const maskedId =
          identifier.length > MIN_ID_LENGTH_FOR_MASKING
            ? `${identifier.substring(0, 4)}...${identifier.substring(identifier.length - 4)}`
            : identifier;
        console.log(`  Detected ${userInfo.isCloud ? 'Cloud' : 'Data Center'}, using lead: ${maskedId}`);
      } catch (userError) {
        console.error(`  Failed to get current user info: ${(userError as Error).message}`);
        throw new Error(`Cannot create project: Unable to determine user info - ${(userError as Error).message}`);
      }

      // Build the project creation payload based on deployment type
      const basePayload = {
        key,
        name,
        projectTypeKey: 'software' as const,
        // Data Center requires projectTemplateKey - use Scrum template which supports fixVersions
        // Note: This assumes standard templates are available. Custom Jira instances may need different templates.
        projectTemplateKey: PROJECT_TEMPLATES.SOFTWARE_SCRUM,
      };

      // Cloud uses leadAccountId, Data Center uses lead (username)
      const projectPayload = userInfo.isCloud
        ? { ...basePayload, leadAccountId: userInfo.accountId! }
        : { ...basePayload, lead: userInfo.name! };

      // Try software project first - it supports fixVersions
      try {
        const project = await this.client.projects.createProject(projectPayload as any);
        console.log(`  Created software project ${key}`);
        return {
          id: project.id?.toString() || '',
          key: project.key || key,
          name: name,
          projectTypeKey: 'software',
        };
      } catch (softwareError) {
        const errorMsg = extractJiraErrorDetails(softwareError);
        console.log(`  Software project creation failed: ${errorMsg}`);
        console.log(`  Trying business project type...`);

        // Fall back to business type
        try {
          // Use Core business template for business projects
          const businessTemplatePayload = {
            key,
            name,
            projectTypeKey: 'business' as const,
            projectTemplateKey: PROJECT_TEMPLATES.BUSINESS_CORE,
          };

          const businessPayload = userInfo.isCloud
            ? { ...businessTemplatePayload, leadAccountId: userInfo.accountId! }
            : { ...businessTemplatePayload, lead: userInfo.name! };

          const project = await this.client.projects.createProject(businessPayload as any);
          console.log(`  Created business project ${key}`);
          return {
            id: project.id?.toString() || '',
            key: project.key || key,
            name: name,
            projectTypeKey: 'business',
          };
        } catch (businessError) {
          const businessErrorMsg = extractJiraErrorDetails(businessError);
          console.error(`  Business project creation also failed: ${businessErrorMsg}`);
          throw new Error(
            `Failed to create project ${key}: Software type failed (${errorMsg}), Business type failed (${businessErrorMsg})`,
          );
        }
      }
    }
  }

  /**
   * List all versions for a project
   */
  async listProjectVersions(projectKey: string): Promise<JiraVersion[]> {
    const versions = await this.client.projectVersions.getProjectVersions({ projectIdOrKey: projectKey });
    return versions.map((v) => ({
      self: v.self,
      id: v.id,
      name: v.name || '',
      archived: v.archived,
      released: v.released,
      projectId: v.projectId,
    }));
  }

  /**
   * Create a version in a project
   */
  async createVersion(projectKey: string, versionName: string): Promise<JiraVersion> {
    // Need to get project ID for creating version
    const project = await this.client.projects.getProject({ projectIdOrKey: projectKey });
    const version = await this.client.projectVersions.createVersion({
      name: versionName,
      projectId: Number.parseInt(project.id || '0', 10),
      released: false,
      archived: false,
    });
    return {
      self: version.self,
      id: version.id,
      name: version.name || '',
      archived: version.archived,
      released: version.released,
      projectId: version.projectId,
    };
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
    const result = await this.client.issueSearch.searchForIssuesUsingJql({
      jql,
      fields: fields || ['*all'],
    });

    return {
      issues: (result.issues || []).map((issue) => this.mapIssue(issue)),
      total: result.total || 0,
    };
  }

  /**
   * Create an issue
   */
  async createIssue(
    projectKey: string,
    summary: string,
    issueType: string = 'Task',
    fixVersions?: string[],
  ): Promise<JiraIssue> {
    // Build properly typed fields
    const baseFields = {
      summary,
      project: { key: projectKey },
      issuetype: { name: issueType },
    };

    // Try with fixVersions on create
    if (fixVersions && fixVersions.length > 0) {
      const fieldsWithVersions = {
        ...baseFields,
        fixVersions: fixVersions.map((name) => ({ name })),
      };
      try {
        const response = await this.client.issues.createIssue({ fields: fieldsWithVersions });
        return this.getIssue(response.key!);
      } catch (error) {
        // If fixVersions not on create screen, create then update
        if (error instanceof Error && error.message.includes('fixVersions')) {
          const response = await this.client.issues.createIssue({ fields: baseFields });
          // Update with fixVersions (REST API update bypasses screen restrictions)
          await this.updateIssue(response.key!, {
            fixVersions: fixVersions.map((name) => ({ name })),
          });
          return this.getIssue(response.key!);
        }
        throw error;
      }
    }

    const response = await this.client.issues.createIssue({ fields: baseFields });
    return this.getIssue(response.key!);
  }

  /**
   * Get an issue by key
   */
  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: issueKey,
      fields: fields || [],
    });
    return this.mapIssue(issue);
  }

  /**
   * Update issue fields
   */
  async updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void> {
    await this.client.issues.editIssue({
      issueIdOrKey: issueKey,
      fields,
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

  /**
   * Add fixVersions field to all screens (ensures it's available on create/edit)
   */
  async configureScreensForFixVersions(): Promise<void> {
    try {
      console.log('  Fetching screens...');
      // Get all screens
      const screensResult = await this.client.screens.getScreens({});

      // Validate the response structure
      if (!screensResult || typeof screensResult !== 'object') {
        console.log(`  Note: Unexpected screens response format: ${typeof screensResult}`);
        return;
      }

      // The API response should have a 'values' array
      const screens = Array.isArray(screensResult.values) ? screensResult.values : [];

      if (screens.length === 0) {
        console.log('  No screens found or screens.values is empty');
        return;
      }

      console.log(`  Found ${screens.length} screens, adding fixVersions field...`);

      for (const screen of screens) {
        if (!screen.id) {
          console.log(`  Skipping screen without ID: ${screen.name || 'unknown'}`);
          continue;
        }

        try {
          // Get tabs for this screen
          const tabs = await this.client.screenTabs.getAllScreenTabs({ screenId: screen.id });

          if (tabs.length === 0) {
            console.log(`  No tabs found for screen: ${screen.name}`);
            continue;
          }

          // Try to add fixVersions to the first tab
          const tabId = tabs[0].id;
          if (!tabId) {
            console.log(`  First tab has no ID for screen: ${screen.name}`);
            continue;
          }

          try {
            await this.client.screenTabFields.addScreenTabField({
              screenId: screen.id,
              tabId,
              fieldId: 'fixVersions',
            });
            console.log(`  ✓ Added fixVersions to screen: ${screen.name}`);
          } catch (addError) {
            // Field might already exist on this screen, that's fine
            const errorMsg = (addError as Error).message || String(addError);
            if (errorMsg.includes('already') || errorMsg.includes('exist')) {
              console.log(`  - fixVersions already on screen: ${screen.name}`);
            } else {
              console.log(`  Could not add fixVersions to screen ${screen.name}: ${errorMsg}`);
            }
          }
        } catch (tabError) {
          console.log(`  Could not get tabs for screen ${screen.name}: ${(tabError as Error).message}`);
        }
      }
    } catch (error) {
      const errorMsg = (error as Error).message || String(error);
      console.log(`  Note: Could not configure screens: ${errorMsg}`);
      // Log more details for debugging
      if (error instanceof Error && error.stack) {
        const stackLines = error.stack.split('\n').slice(0, STACK_TRACE_LINES);
        console.log(`  Stack trace:\n    ${stackLines.join('\n    ')}`);
      }
    }
  }

  /**
   * Map jira.js Issue to our JiraIssue interface
   */
  private mapIssue(issue: Version2Models.Issue): JiraIssue {
    const fields = issue.fields || {};
    return {
      id: issue.id || '',
      key: issue.key || '',
      fields: {
        summary: fields.summary as string | undefined,
        fixVersions: fields.fixVersions as JiraVersion[] | undefined,
        status: fields.status as { name?: string } | undefined,
      },
    };
  }
}
