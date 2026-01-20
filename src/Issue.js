'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const core = __importStar(require('@actions/core'));
const lodash_1 = __importDefault(require('lodash'));
const TransitionEventManager_1 = __importDefault(require('./TransitionEventManager'));
class Issue {
  issue;
  projectName;
  transitionNames = [];
  transitionIds = [];
  beforeStatus = null;
  toStatus = null;
  status = null;
  jira;
  issueObject = null;
  issueTransitions = undefined;
  transitionsLogString = [];
  argv;
  transitionEventManager;
  constructor(issue, jira, argv, context) {
    this.issue = issue;
    const pmatch = issue.match(/(?<projectName>[A-Za-z]{2,})-\d{2,}/);
    this.projectName = pmatch?.groups?.projectName.toUpperCase() ?? '';
    this.jira = jira;
    this.argv = argv;
    this.transitionEventManager = new TransitionEventManager_1.default(context, jira, argv);
  }
  async build() {
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
  requiresTransition() {
    if (this.status === null) return false;
    // check for current status vs ignored status
    return !this.transitionEventManager.getIgnoredStates(this.projectName).includes(this.status);
  }
  transitionToApply() {
    if (this.toStatus) {
      const iT = lodash_1.default.find(this.issueTransitions, (t) => {
        if (t.to && t.to.name?.toLowerCase() === this.toStatus?.toLowerCase()) {
          return true;
        }
      });
      return {
        ...iT,
        isGlobal: true,
      };
    }
    if (this.status) {
      return lodash_1.default.find(this.issueTransitions, (t) => {
        if (t.name?.toLowerCase?.() === this.status?.toLowerCase()) {
          return true;
        }
      });
    }
    return undefined;
  }
  async transition() {
    const transitionToApply = this.transitionToApply();
    if (transitionToApply?.name) {
      core.info(`${this.issue} will attempt to transition to: ${JSON.stringify(transitionToApply)}`);
      try {
        core.info(`Applying transition for ${this.issue}`);
        await this.jira.transitionIssue(this.issue, transitionToApply);
        this.status = await this.getStatus(true);
        core.info(`Changed ${this.issue} status from ${this.beforeStatus} to ${this.status}.`);
      } catch (error) {
        core.error(`Transition failed for ${this.issue}`);
        if (this.argv.failOnError) {
          throw error;
        } else if (error instanceof Error) {
          core.error(error);
        }
      }
    } else {
      core.info('Possible transitions:');
      core.info(this.transitionsLogString.join('\n'));
    }
  }
  async getOutputs() {
    return {
      issue: this.issue,
      names: this.transitionNames,
      ids: this.transitionIds,
      status: this.status || (await this.getStatus(true)),
      beforestatus: this.beforeStatus,
    };
  }
  async getStatus(fresh = false) {
    if (fresh) {
      await this.getJiraIssueObject();
    }
    return lodash_1.default.get(this.issueObject, 'fields.status.name');
  }
  setIssue(issue) {
    this.issue = issue;
  }
  async getTransitions() {
    const { transitions } = await this.jira.getIssueTransitions(this.issue);
    if (transitions == null) {
      core.warning('No transitions found for issue');
      if (this.argv.failOnError) throw new Error(`Issue ${this.issue} has no available transitions`);
    }
    return transitions;
  }
  async getJiraIssueObject() {
    this.issueObject = await this.jira.getIssue(this.issue);
    return this.issueObject;
  }
}
exports.default = Issue;
