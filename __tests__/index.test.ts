import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'

import {Args} from '../src/@types'
import {Action} from '../src/action'
import * as fsHelper from '../src/fs-helper'
import * as inputHelper from '../src/input-helper'

const originalGitHubWorkspace = process.env.GITHUB_WORKSPACE
const gitHubWorkspace = path.resolve('/checkout-tests/workspace')

export const issues = 'DVPS-336,DVPS-339'
export const jira_transitions_yaml = `
projects:
  UNICORN:
    ignored_states:
      - 'done'
      - 'testing'
    to_state:
      'solution review':
        - eventName: create
      'code review':
        - eventName: pull_request
          action: 'opened'
        - eventName: pull_request
          action: 'synchronized'
      'testing':
        - eventName: pull_request
          payload:
            merged: true
          action: 'closed'
        - eventName: pull_request_review
          payload:
            state: 'APPROVED'
  DVPS:
    ignored_states:
      - 'done'
      - 'testing'
    to_state:
      'On Hold':
        - eventName: start_test
      'In Progress':
        - eventName: create
      'Code Review':
        - eventName: pull_request
          action: 'opened'
        - eventName: pull_request
          action: 'synchronized'
      'testing':
        - eventName: pull_request
          payload:
            merged: true
          action: 'closed'
        - eventName: pull_request_review
          payload:
            state: 'APPROVED'
`
export const baseUrl = process.env.JIRA_BASE_URL as string
// Inputs for mock @actions/core
let inputs = {} as any
// Shallow clone original @actions/github context
const originalContext = {...github.context}

describe('jira ticket transition', () => {
  beforeAll(() => {
    // Mock getInput
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      // eslint-disable-next-line security/detect-object-injection
      return inputs[name]
    })
    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(console.log)
    jest.spyOn(core, 'warning').mockImplementation(console.log)
    jest.spyOn(core, 'info').mockImplementation(console.log)
    jest.spyOn(core, 'debug').mockImplementation(console.log)

    // Mock github context
    jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
      return {
        owner: 'some-owner',
        repo: 'some-repo'
      }
    })
    github.context.ref = 'refs/heads/some-ref'
    github.context.sha = '1234567890123456789012345678901234567890'

    // Mock ./fs-helper directoryExistsSync()
    jest.spyOn(fsHelper, 'directoryExistsSync').mockImplementation((fspath: string) => fspath === gitHubWorkspace)

    // GitHub workspace
    process.env.GITHUB_WORKSPACE = gitHubWorkspace
  })
  beforeEach(() => {
    // Reset inputs
    inputs = {}
    inputs.issues = issues

    inputs.jira_transitions_yaml = jira_transitions_yaml
    inputs.jira_base_url = baseUrl
  })
  afterAll(() => {
    // Restore GitHub workspace
    process.env.GITHUB_WORKSPACE = undefined
    if (originalGitHubWorkspace) {
      process.env.GITHUB_WORKSPACE = originalGitHubWorkspace
    }

    // Restore @actions/github context
    github.context.ref = originalContext.ref
    github.context.sha = originalContext.sha

    // Restore
    jest.restoreAllMocks()
  })

  it('sets defaults', () => {
    const settings: Args = inputHelper.getInputs()
    expect(settings).toBeTruthy()
    expect(settings.issues).toEqual(issues)
    expect(settings.config).toBeTruthy()
    expect(settings.config.baseUrl).toEqual(baseUrl)
  })

  it('get transitions', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'push'
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })

  it('GitHub Event: start_test', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'start_test'
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })

  it('GitHub Event: create', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'create'
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })

  it('GitHub Event: pull_request, Github Action: opened', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'pull_request'
    github.context.action = 'opened'
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })
  it('GitHub Event: pull_request, Github Action: synchronized', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'pull_request'
    github.context.action = 'synchronized'
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })
  it('GitHub Event: pull_request, Github Action: closed, GitHub Payload: merged', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'pull_request'
    github.context.action = 'closed'
    github.context.payload.merged = true
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })
  it('GitHub Event: pull_request_review, Github State: APPROVED', async () => {
    // expect.hasAssertions()
    github.context.eventName = 'pull_request_review'
    github.context.payload.state = 'APPROVED'
    const settings: Args = inputHelper.getInputs()
    const action = new Action(github.context, settings)
    const result = await action.execute()
    expect(result).toEqual(true)
  })
})
