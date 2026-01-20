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
exports.Action = void 0;
const core = __importStar(require('@actions/core'));
const Issue_1 = __importDefault(require('./Issue'));
const Jira_1 = __importDefault(require('./Jira'));
class Action {
  jira;
  config;
  argv;
  githubEvent;
  constructor(githubEvent, argv) {
    this.jira = new Jira_1.default({
      baseUrl: argv.config.baseUrl,
      token: argv.config.token,
      email: argv.config.email,
    });
    this.config = argv.config;
    this.argv = argv;
    this.githubEvent = githubEvent;
  }
  async transitionIssue(issueObj) {
    return issueObj
      .transition()
      .then(async () => {
        return issueObj.getOutputs();
      })
      .catch((error) => {
        if (error instanceof Error) {
          if (this.argv.failOnError) {
            core.setFailed(error);
          } else {
            core.error(error);
          }
        }
      });
  }
  async execute() {
    const { argv, jira, githubEvent } = this;
    const issueList = argv.issues.split(',');
    let successes = 0;
    let failures = 0;
    const applyIssueList = [];
    for (const issueKey of issueList) {
      applyIssueList.push(
        new Issue_1.default(issueKey.trim(), jira, argv, githubEvent)
          .build()
          .then(async (issueObj) => this.transitionIssue(issueObj)),
      );
    }
    const issueOutputs = await Promise.all(applyIssueList).then((iList) => iList.filter(Boolean));
    failures = issueList.length - issueOutputs.length;
    successes = issueOutputs.length;
    core.info(`Successes: ${successes} Failures: ${failures}`);
    core.setOutput('issueOutputs', JSON.stringify(issueOutputs));
    return successes > 0;
  }
}
exports.Action = Action;
