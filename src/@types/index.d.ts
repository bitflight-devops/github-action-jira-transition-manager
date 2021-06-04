export interface JiraConfig {
  baseUrl: string
  token: string
  email: string
  transitionId?: string
  project?: string
  issuetype?: string
  summary?: string
  description?: string
  issue?: string
}
export interface Args {
  issues: string
  failOnError: boolean
  jiraTransitionsYaml: string
  config: JiraAuthConfig
}

export interface JiraAuthConfig {
  baseUrl: string
  token: string
  email: string
}
