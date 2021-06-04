/* eslint-disable security/detect-unsafe-regex */
import * as core from '@actions/core'
import {Context} from '@actions/github/lib/context'
import {IssueBean, IssueTransition} from 'jira.js/out/version3/models'
import _ from 'lodash'

import {Args} from './@types'
import Jira from './Jira'
import TransitionEventManager from './TransitionEventManager'

export interface IssueOutput {
  issue: string
  names: string[]
  ids: string[]
  status: string
  beforestatus: string
}
export default class Issue {
  issue: string
  projectName: string
  transitionNames: string[] = []
  transitionIds: string[] = []
  beforeStatus: string | null = null
  toStatus: string | null = null
  status: null | string = null
  jira: Jira
  issueObject: IssueBean | null = null
  issueTransitions: IssueTransition[] | undefined = undefined
  transitionsLogString: string[] = []
  argv: Args
  transitionEventManager: TransitionEventManager

  constructor(issue: string, jira: Jira, argv: Args, context: Context) {
    this.issue = issue
    const pmatch = issue.match(/(?<projectName>[a-zA-Z]{2,})-[0-9]{2,}/)
    this.projectName = pmatch?.groups?.projectName.toUpperCase() ?? ''
    this.jira = jira
    this.argv = argv
    this.transitionEventManager = new TransitionEventManager(context, jira, argv)
  }
  async build(): Promise<Issue> {
    await this.getJiraIssueObject()
    this.beforeStatus = await this.getStatus()
    this.toStatus = this.transitionEventManager.githubEventToState(this.projectName)

    this.issueTransitions = await this.getTransitions()
    if (this.issueTransitions) {
      for (const transition of this.issueTransitions) {
        if (transition.id) {
          this.transitionIds.push(transition.id)
        }
        if (transition.name) {
          this.transitionNames.push(transition.name)
        }
        let stateName = 'unknown'
        if (transition['to'] !== undefined) {
          stateName = transition['to'].name ?? 'unknown'
        }

        this.transitionsLogString.push(
          `{ id: ${transition.id}, name: ${transition.name} } transitions issue to '${stateName}' status.`
        )
      }
    }
    return this
  }

  requiresTransition(): boolean {
    if (this.status === null) return false
    // check for current status vs ignored status
    return !this.transitionEventManager.getIgnoredStates(this.projectName).includes(this.status)
  }

  transitionToApply(): IssueTransition | undefined {
    if (this.toStatus) {
      const iT = _.find(this.issueTransitions, t => {
        if (t.to && t.to.name?.toLowerCase() === this.toStatus?.toLowerCase()) {
          return true
        }
      }) as IssueTransition
      return {
        ...iT,
        isGlobal: true
      } as IssueTransition
    } else if (this.status) {
      return _.find(this.issueTransitions, t => {
        if (t.name?.toLowerCase?.() === this.status?.toLowerCase()) {
          return true
        }
      }) as IssueTransition
    } else {
      return undefined
    }
  }

  async transition(): Promise<void> {
    const transitionToApply = this.transitionToApply()

    if (transitionToApply) {
      core.info(`${this.issue} will attempt to transition to: ${JSON.stringify(transitionToApply)}`)

      try {
        core.info(`Applying transition for ${this.issue}`)
        await this.jira.transitionIssue(this.issue, transitionToApply)
        this.status = await this.getStatus(true)
        core.info(`Changed ${this.issue} status from ${this.beforeStatus} to ${this.status}.`)
      } catch (error) {
        core.error(`Transition failed for ${this.issue}`)
        if (this.argv.failOnError) {
          throw error
        } else {
          core.error(error)
        }
      }
    } else {
      core.info('Possible transitions:')
      core.info(this.transitionsLogString.join('\n'))
    }
  }

  async getOutputs(): Promise<IssueOutput> {
    return {
      issue: this.issue,
      names: this.transitionNames,
      ids: this.transitionIds,
      status: this.status ?? (await this.getStatus(true)),
      beforestatus: this.beforeStatus as string
    }
  }

  async getStatus(fresh = false): Promise<string> {
    if (fresh) {
      await this.getJiraIssueObject()
    }
    return _.get(this.issueObject, 'fields.status.name') as string
  }
  setIssue(issue: string): void {
    this.issue = issue
  }

  async getTransitions(): Promise<IssueTransition[] | undefined> {
    const {transitions} = await this.jira.getIssueTransitions(this.issue)

    if (transitions == null) {
      core.warning('No transitions found for issue')
      if (this.argv.failOnError) throw new Error(`Issue ${this.issue} has no available transitions`)
    }
    return transitions
  }

  async getJiraIssueObject(): Promise<IssueBean> {
    this.issueObject = await this.jira.getIssue(this.issue)
    return this.issueObject
  }
}

export type Issues = Issue[]
