import * as core from '@actions/core';
import type { context } from '@actions/github';

type Context = typeof context;

import type { Version2Models } from 'jira.js';
import _ from 'lodash';

import type { Args } from './@types';
import type Jira from './Jira';
import TransitionEventManager from './TransitionEventManager';

/**
 * Output structure representing the result of an issue transition operation.
 */
export interface IssueOutput {
  /** The Jira issue key (e.g., "PROJ-123") */
  issue: string;
  /** Names of available transitions for the issue */
  names: string[];
  /** IDs of available transitions for the issue */
  ids: string[];
  /** Current status of the issue after any transition */
  status: string;
  /** Status of the issue before any transition was applied */
  beforestatus: string;
}

/**
 * Represents a Jira issue and handles its workflow transitions.
 *
 * This class encapsulates all operations related to a single Jira issue,
 * including fetching issue data, determining available transitions,
 * and applying state changes based on GitHub event mappings.
 */
export default class Issue {
  /** The Jira issue key (e.g., "PROJ-123") */
  issue: string;

  projectName: string;

  transitionNames: string[] = [];

  transitionIds: string[] = [];

  beforeStatus: string | null = null;

  toStatus: string | null = null;

  status: null | string = null;

  jira: Jira;

  issueObject: Version2Models.Issue | null = null;

  issueTransitions: Version2Models.IssueTransition[] | undefined = undefined;

  transitionsLogString: string[] = [];

  argv: Args;

  transitionEventManager: TransitionEventManager;

  /**
   * Creates a new Issue instance.
   *
   * @param issue - The Jira issue key (e.g., "PROJ-123")
   * @param jira - The Jira client instance for API interactions
   * @param argv - Command-line arguments and configuration options
   * @param context - The GitHub Actions context containing event information
   */
  constructor(issue: string, jira: Jira, argv: Args, context: Context) {
    this.issue = issue;
    const issuePattern = /^(?<projectName>[A-Z][A-Z0-9_]*)-\d+$/i;
    const pmatch = issuePattern.exec(issue);
    this.projectName = pmatch?.groups?.projectName.toUpperCase() ?? '';
    this.jira = jira;
    this.argv = argv;
    this.transitionEventManager = new TransitionEventManager(context, jira, argv);
  }

  /**
   * Initializes the issue by fetching data from Jira and preparing transition information.
   *
   * This method must be called after construction to populate the issue's state,
   * available transitions, and determine the target status based on GitHub events.
   *
   * @returns The fully initialized Issue instance
   */
  async build(): Promise<Issue> {
    await this.getJiraIssueObject();
    this.beforeStatus = await this.getStatus();
    this.toStatus = this.transitionEventManager.githubEventToState(this.projectName);

    this.issueTransitions = await this.getTransitions();
    if (this.issueTransitions) {
      for (const transition of this.issueTransitions) {
        if (transition.id) {
          this.transitionIds.push(transition.id);
        }
        if (transition.name) {
          this.transitionNames.push(transition.name);
        }
        let stateName = 'unknown';
        if (transition.to !== undefined) {
          stateName = transition.to.name ?? 'unknown';
        }

        this.transitionsLogString.push(
          `{ id: ${transition.id}, name: ${transition.name} } transitions issue to '${stateName}' status.`,
        );
      }
    }
    return this;
  }

  /**
   * Determines whether the issue requires a transition based on its current status.
   *
   * Skips unmatched events, already-target issues, and the project's ignored
   * states. Jira status names are compared without regard to case.
   *
   * @returns True if the issue should be transitioned, false if it should be skipped
   */
  requiresTransition(): boolean {
    if (!(this.beforeStatus && this.toStatus)) return false;
    const currentStatus = this.beforeStatus.toLowerCase();
    if (currentStatus === this.toStatus.toLowerCase()) return false;
    return !this.transitionEventManager
      .getIgnoredStates(this.projectName)
      .some((ignoredStatus) => ignoredStatus.toLowerCase() === currentStatus);
  }

  /**
   * Finds the appropriate transition to apply based on the target status.
   *
   * Matches the destination status rather than the transition's display name.
   *
   * @returns The matching transition object, or undefined if no match is found
   */
  transitionToApply(): Version2Models.IssueTransition | undefined {
    if (!this.toStatus) return undefined;
    return this.issueTransitions?.find(
      (transition) => transition.to?.name?.toLowerCase() === this.toStatus?.toLowerCase(),
    );
  }

  /**
   * Executes the transition on the Jira issue.
   *
   * Applies a matching transition and reads back the resulting status. With no
   * matching event, lists available transitions. Ignored and already-target
   * issues remain unchanged.
   *
   * @throws Error if the configured target is unavailable or Jira rejects the transition
   */
  async transition(): Promise<void> {
    if (!this.toStatus) {
      core.info('Possible transitions:');
      core.info(this.transitionsLogString.join('\n'));
      return;
    }

    if (!this.requiresTransition()) {
      core.info(`Skipping ${this.issue}: status ${this.beforeStatus} is ignored or already matches ${this.toStatus}.`);
      return;
    }

    const transitionToApply = this.transitionToApply();
    if (!transitionToApply?.id) {
      throw new Error(`No available transition for ${this.issue} from ${this.beforeStatus} to ${this.toStatus}`);
    }

    core.info(`Applying transition for ${this.issue} to ${this.toStatus}`);
    await this.jira.transitionIssue(this.issue, transitionToApply);
    this.status = await this.getStatus(true);
    core.info(`Changed ${this.issue} status from ${this.beforeStatus} to ${this.status}.`);
  }

  /**
   * Generates the output data for this issue's transition operation.
   *
   * @returns An object containing the issue key, available transitions, and status information
   */
  async getOutputs(): Promise<IssueOutput> {
    return {
      issue: this.issue,
      names: this.transitionNames,
      ids: this.transitionIds,
      status: this.status || (await this.getStatus(true)),
      beforestatus: this.beforeStatus as string,
    };
  }

  /**
   * Retrieves the current status of the issue.
   *
   * @param fresh - If true, fetches the latest issue data from Jira before returning status
   * @returns The current status name of the issue
   */
  async getStatus(fresh = false): Promise<string> {
    if (fresh) {
      await this.getJiraIssueObject();
    }
    return _.get(this.issueObject, 'fields.status.name') as string;
  }

  /**
   * Updates the issue key for this instance.
   *
   * @param issue - The new Jira issue key to set
   */
  setIssue(issue: string): void {
    this.issue = issue;
  }

  /**
   * Fetches the available transitions for this issue from Jira.
   *
   * @returns Array of available transitions, or undefined if none exist
   * @throws Error if no transitions are available and failOnError is enabled
   */
  async getTransitions(): Promise<Version2Models.IssueTransition[] | undefined> {
    const { transitions } = await this.jira.getIssueTransitions(this.issue);

    if (transitions == null) {
      core.warning('No transitions found for issue');
      if (this.argv.failOnError) throw new Error(`Issue ${this.issue} has no available transitions`);
    }
    return transitions;
  }

  /**
   * Fetches the full issue object from Jira and caches it locally.
   *
   * @returns The Jira issue object with all fields
   */
  async getJiraIssueObject(): Promise<Version2Models.Issue> {
    this.issueObject = await this.jira.getIssue(this.issue);
    return this.issueObject;
  }
}

/** Array type alias for multiple Issue instances */
export type Issues = Issue[];
