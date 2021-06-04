import * as core from '@actions/core'
import {Context} from '@actions/github/lib/context'

import {Args, JiraConfig} from './@types/'
import Issue, {IssueOutput, Issues} from './Issue'
import Jira from './Jira'

const issuesList: Issues = []
export class Action {
  jira: Jira
  config: JiraConfig
  argv: Args
  githubEvent: Context
  constructor(githubEvent: Context, argv: Args) {
    this.jira = new Jira({
      baseUrl: argv.config.baseUrl,
      token: argv.config.token,
      email: argv.config.email
    })

    this.config = argv.config
    this.argv = argv
    this.githubEvent = githubEvent
  }

  async execute(): Promise<boolean> {
    const {argv} = this
    const issueList = argv.issues.split(',')
    let successes = 0
    let failures = 0

    for (const issueId of issueList) {
      const issue = await new Issue(issueId.trim(), this.jira, this.argv, this.githubEvent).build()
      issuesList.push(issue)
      try {
        await issue.transition()
        successes += 1
      } catch (error) {
        failures += 1
        if (argv.failOnError) {
          core.setFailed(error)
        } else {
          core.error(error)
        }
      }
    }

    async function getOutputs(): Promise<IssueOutput[]> {
      return Promise.all(issuesList.map(async i => i.getOutputs()))
    }
    core.setOutput('issueOutputs', JSON.stringify(await getOutputs()))

    return failures === 0 && issueList.length === successes
  }
}
