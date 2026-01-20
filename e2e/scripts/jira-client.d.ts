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
export declare class JiraE2EClient {
  private baseUrl;
  private authHeader;
  private config;
  constructor(config: E2EConfig);
  private request;
  /**
   * Check if Jira is ready by getting server info
   */
  getServerInfo(): Promise<{
    version: string;
    baseUrl: string;
  }>;
  /**
   * Get current user to verify authentication
   */
  getMyself(): Promise<{
    displayName: string;
    emailAddress?: string;
  }>;
  /**
   * Get or create a project
   */
  ensureProject(key: string, name: string): Promise<JiraProject>;
  /**
   * List all versions for a project
   */
  listProjectVersions(projectKey: string): Promise<JiraVersion[]>;
  /**
   * Create a version in a project
   */
  createVersion(projectKey: string, versionName: string): Promise<JiraVersion>;
  /**
   * Ensure a version exists (get or create)
   */
  ensureVersion(projectKey: string, versionName: string): Promise<JiraVersion>;
  /**
   * Search for issues using JQL
   */
  searchIssues(jql: string, fields?: string[]): Promise<JiraSearchResult>;
  /**
   * Create an issue
   */
  createIssue(projectKey: string, summary: string, issueType?: string, fixVersions?: string[]): Promise<JiraIssue>;
  /**
   * Get an issue by key
   */
  getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue>;
  /**
   * Update issue fields
   */
  updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void>;
  /**
   * Ensure an issue exists (search or create)
   */
  ensureIssue(projectKey: string, summary: string, issueType?: string, fixVersions?: string[]): Promise<JiraIssue>;
}
