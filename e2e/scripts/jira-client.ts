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

/**
 * Represents a Jira project with its essential properties.
 */
export interface JiraProject {
  /** Unique identifier for the project */
  id: string;
  /** Short key used in issue keys (e.g., "PROJ" in "PROJ-123") */
  key: string;
  /** Display name of the project */
  name: string;
  /** Type of project (e.g., "software", "business") */
  projectTypeKey: string;
}

/**
 * Represents a Jira version (also known as a release or fix version).
 */
export interface JiraVersion {
  /** Self-referential URL to this version resource */
  self?: string;
  /** Unique identifier for the version */
  id?: string;
  /** Name of the version (e.g., "1.0.0", "Sprint 1") */
  name: string;
  /** Whether the version is archived */
  archived?: boolean;
  /** Whether the version has been released */
  released?: boolean;
  /** ID of the project this version belongs to */
  projectId?: number | string;
}

/**
 * Represents a Jira issue with its key fields.
 */
export interface JiraIssue {
  /** Unique identifier for the issue */
  id: string;
  /** Issue key (e.g., "PROJ-123") */
  key: string;
  /** Issue fields containing summary, versions, and status */
  fields: {
    /** Issue summary/title */
    summary?: string;
    /** Fix versions assigned to this issue */
    fixVersions?: JiraVersion[];
    /** Current workflow status */
    status?: {
      /** Status name (e.g., "To Do", "In Progress", "Done") */
      name?: string;
    };
  };
}

/**
 * Result of a Jira issue search operation.
 */
export interface JiraSearchResult {
  /** Array of issues matching the search criteria */
  issues: JiraIssue[];
  /** Total number of issues matching the query (may be more than returned) */
  total: number;
}

/**
 * E2E test client for interacting with Jira Cloud or Data Center instances.
 * Wraps the jira.js Version2Client with convenience methods for test setup.
 */
export class JiraE2EClient {
  private client: Version2Client;
  private baseUrl: string;
  private authHeader: string;

  /**
   * Creates a new JiraE2EClient instance.
   * @param config - E2E configuration containing Jira connection details
   * @throws Error if authentication fails during subsequent API calls
   */
  constructor(config: E2EConfig) {
    // jira.js uses email/apiToken field names for basic auth
    // For Data Center, map username->email and password->apiToken
    const email = config.jira.auth.email || config.jira.auth.username || '';
    const apiToken = config.jira.auth.apiToken || config.jira.auth.password || '';

    this.baseUrl = config.jira.baseUrl;
    this.client = new Version2Client({
      host: config.jira.baseUrl,
      authentication: {
        basic: { email, apiToken },
      },
    });

    // Store auth header for raw API calls (needed for Data Center project creation)
    // jira.js doesn't support the 'lead' field required by Data Center
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  /**
   * Create a project with the appropriate lead field for Cloud vs Data Center
   *
   * jira.js library only supports 'leadAccountId' (Cloud) and filters out 'lead' (Data Center).
   * This method uses native fetch for Data Center to send the 'lead' field directly.
   */
  private async createProjectWithLead(
    basePayload: { key: string; name: string; projectTypeKey: string; projectTemplateKey: string },
    isCloud: boolean,
    leadIdentifier: string,
  ): Promise<{ id?: number; key?: string }> {
    if (isCloud) {
      // Cloud: use jira.js which supports leadAccountId
      return this.client.projects.createProject({
        ...basePayload,
        leadAccountId: leadIdentifier,
      } as any);
    }

    // Data Center: use native fetch because jira.js filters out the 'lead' field
    // The 'lead' field expects a username string (e.g., 'admin'), not a user key (e.g., 'JIRAUSER10000')
    const response = await fetch(`${this.baseUrl}/rest/api/2/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ ...basePayload, lead: leadIdentifier }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      const errorMsg = errorData.errorMessages?.join(', ') || response.statusText;
      const fieldErrors = errorData.errors
        ? Object.entries(errorData.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : '';
      throw new Error(
        `Request failed with status code ${response.status}${fieldErrors ? ` | Fields: ${fieldErrors}` : ''}${errorMsg ? ` | ${errorMsg}` : ''}`,
      );
    }

    return (await response.json()) as { id?: number; key?: string };
  }

  /**
   * Retrieves Jira server information to verify connectivity.
   * @returns Server version and base URL
   * @throws Error if the server is unreachable or authentication fails
   */
  async getServerInfo(): Promise<{ version: string; baseUrl: string }> {
    const info = await this.client.serverInfo.getServerInfo();
    return { version: info.version || 'unknown', baseUrl: info.baseUrl || '' };
  }

  /**
   * Retrieves the current authenticated user's information.
   * @returns User's display name and optional email address
   * @throws Error if authentication fails
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
  async getCurrentUserInfo(): Promise<{ accountId?: string; name?: string; key?: string; isCloud: boolean }> {
    const user = await this.client.myself.getCurrentUser();
    // Cloud has accountId, Data Center does not
    const isCloud = !!user.accountId;
    // Log user details for debugging project lead issues
    console.log(`  User details: name=${user.name}, key=${user.key}, accountId=${user.accountId}`);
    return {
      accountId: user.accountId,
      name: user.name,
      key: user.key,
      isCloud,
    };
  }

  /**
   * Ensures a project exists, creating it if necessary.
   * Attempts software project type first, falls back to business type.
   * @param key - Project key (e.g., "PROJ")
   * @param name - Display name for the project
   * @returns The existing or newly created project
   * @throws Error if project creation fails for both software and business types
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
    } catch {
      // Project doesn't exist, create it
      console.log(`  Project ${key} does not exist, creating...`);

      // Get the current user info to determine Cloud vs Data Center
      let userInfo: { accountId?: string; name?: string; key?: string; isCloud: boolean };
      let leadIdentifier: string;
      try {
        userInfo = await this.getCurrentUserInfo();
        // For Data Center, use 'name' (username) - Jira REST API expects username, not internal key
        const identifier = userInfo.isCloud ? userInfo.accountId : userInfo.name;

        // Validate we have the required identifier
        if (!identifier) {
          throw new Error(`Missing required user identifier: ${userInfo.isCloud ? 'accountId' : 'name/key'}`);
        }

        // Store validated identifier for use in project creation
        leadIdentifier = identifier;

        // Log only first/last 4 chars to avoid exposing full identifier
        const maskedId =
          identifier.length > MIN_ID_LENGTH_FOR_MASKING
            ? `${identifier.slice(0, 4)}...${identifier.slice(-4)}`
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

      // Try software project first - it supports fixVersions
      try {
        const project = await this.createProjectWithLead({ ...basePayload }, userInfo.isCloud, leadIdentifier);
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
          const businessPayload = {
            key,
            name,
            projectTypeKey: 'business' as const,
            projectTemplateKey: PROJECT_TEMPLATES.BUSINESS_CORE,
          };

          const project = await this.createProjectWithLead(businessPayload, userInfo.isCloud, leadIdentifier);
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
   * Lists all versions (releases) for a project.
   * @param projectKey - Project key to list versions for
   * @returns Array of versions in the project
   * @throws Error if the project doesn't exist or access is denied
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
   * Creates a new version in a project.
   * @param projectKey - Project key to create the version in
   * @param versionName - Name for the new version
   * @returns The newly created version
   * @throws Error if the project doesn't exist or version creation fails
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
   * Ensures a version exists in a project, creating it if necessary.
   * @param projectKey - Project key to check/create the version in
   * @param versionName - Name of the version to ensure exists
   * @returns The existing or newly created version
   * @throws Error if the project doesn't exist or version creation fails
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
   * Searches for issues using JQL (Jira Query Language).
   * @param jql - JQL query string (e.g., "project = PROJ AND status = 'In Progress'")
   * @param fields - Optional array of field names to return (defaults to all fields)
   * @returns Search result containing matching issues and total count
   * @throws Error if the JQL is invalid or access is denied
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
   * Creates a new issue in a project.
   * If fixVersions cannot be set during creation (screen restriction), it updates the issue after creation.
   * @param projectKey - Project key to create the issue in
   * @param summary - Issue summary/title
   * @param issueType - Issue type name (defaults to "Task")
   * @param fixVersions - Optional array of fix version names to assign
   * @returns The newly created issue
   * @throws Error if issue creation fails
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
   * Retrieves an issue by its key.
   * @param issueKey - Issue key (e.g., "PROJ-123")
   * @param fields - Optional array of field names to return (defaults to all fields)
   * @returns The requested issue
   * @throws Error if the issue doesn't exist or access is denied
   */
  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: issueKey,
      fields: fields || [],
    });
    return this.mapIssue(issue);
  }

  /**
   * Updates fields on an existing issue.
   * @param issueKey - Issue key (e.g., "PROJ-123")
   * @param fields - Object containing field names and their new values
   * @throws Error if the issue doesn't exist or update fails
   */
  async updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void> {
    await this.client.issues.editIssue({
      issueIdOrKey: issueKey,
      fields,
    });
  }

  /**
   * Ensures an issue exists with the given summary, creating it if necessary.
   * Searches by summary text match; returns the first match if found.
   * @param projectKey - Project key to search/create the issue in
   * @param summary - Issue summary to search for or create
   * @param issueType - Issue type name (defaults to "Task")
   * @param fixVersions - Optional array of fix version names (only used when creating)
   * @returns The existing or newly created issue
   * @throws Error if search or creation fails
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
   * Configures Jira screens to include the fixVersions field.
   * Iterates through all screens and adds fixVersions to the first tab if not present.
   * Logs progress and handles errors gracefully without throwing.
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
   * Maps a jira.js Issue object to the simplified JiraIssue interface.
   * @param issue - Raw issue from jira.js API
   * @returns Simplified issue object with key fields extracted
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
