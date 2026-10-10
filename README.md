<!-- start title -->

# <img src=".github/ghadocs/branding.svg" width="60px" align="center" alt="branding<icon:chevron-right color:blue>" /> GitHub Action: Jira Transition Manager

<!-- end title -->

<!-- start description -->

This action will transition the list of Jira issues provided between states, or it will display the available transitions and the current issue state.

<!-- end description -->

Map GitHub events to Jira workflow states for the issue keys you supply. The action uses the Node.js 24 runtime and accepts Jira Cloud email/API-token credentials or Jira Data Center username/password credentials through Basic authentication.

## Quick start

Check out the repository so the action can read `.github/github_event_jira_transitions.yml`. Supply your issue keys and Jira connection details:

```yaml
name: Transition Jira issues
on:
  pull_request:
    types: [opened, synchronize, closed]

permissions:
  contents: read

jobs:
  jira:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - name: Apply Jira transitions
        id: jira
        uses: bitflight-devops/github-action-jira-transition-manager@main
        with:
          issues: "PROJECT1-123, PROJECT1-456"
          jira_base_url: ${{ secrets.JIRA_BASE_URL }}
          jira_user_email: ${{ secrets.JIRA_USER_EMAIL }}
          jira_api_token: ${{ secrets.JIRA_API_TOKEN }}
          fail_on_error: "true"
```

Replace the example issue keys and project with your own. Choose a reviewed release or full commit SHA when pinning the action in your workflow. The Jira account must be able to view these issues and perform the configured transitions.

## Transition configuration

Create `.github/github_event_jira_transitions.yml` with your uppercase Jira project keys and destination status names:

```yaml
projects:
  PROJECT1:
    ignored_states:
      - Done
    to_state:
      In Progress:
        - eventName: pull_request
          action: opened
        - eventName: pull_request
          action: synchronize
      Done:
        - eventName: pull_request
          action: closed
          payload:
            pull_request:
              merged: true
```

This example moves issues to `In Progress` when a pull request opens or its head branch changes, and to `Done` only when it closes after merging. A pull request closed without merging does not match the `Done` rule.

Every field in one condition must match. Multiple conditions under a destination state are alternatives; the first matching state in configuration order wins. The top-level `action` condition refers to the webhook action such as `opened`, not the workflow step identifier. Nested webhook fields belong under `payload`.

Use status names that exist in your Jira workflow. The action selects an available transition by its destination status, compares status names without regard to case, and leaves issues unchanged when they already have the destination status or are in `ignored_states`. With no matching event, it reports the current status and available transitions.

You can instead provide the same YAML through `jira_transitions_yaml`; that input takes precedence over the repository file. For example, this inline mapping transitions issues on a push:

```yaml
- uses: bitflight-devops/github-action-jira-transition-manager@main
  with:
    issues: "PROJECT1-123"
    jira_base_url: ${{ secrets.JIRA_BASE_URL }}
    jira_user_email: ${{ secrets.JIRA_USER_EMAIL }}
    jira_api_token: ${{ secrets.JIRA_API_TOKEN }}
    fail_on_error: "true"
    jira_transitions_yaml: |
      projects:
        PROJECT1:
          ignored_states: [Done]
          to_state:
            In Progress:
              - eventName: push
```

See the [example configuration](.github/github_event_jira_transitions.example.yml). A configuration file may use either the `.yml` or `.yaml` extension. Connection values can also be supplied through `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, and `JIRA_API_TOKEN` environment variables.

## Outputs and failure behavior

`issueOutputs` is a JSON array. Each successfully processed issue includes `issue`, `beforestatus`, `status`, `names`, and `ids`. The `names` and `ids` arrays describe the available transitions Jira returned. Unchanged issues also receive an output record.

Set `fail_on_error: 'true'` when a rejected transition or missing issue must fail the workflow. With the default `false`, those failures produce warnings. Failed issues are omitted from the output array; successfully processed issues remain in it even when another issue in the batch fails.

## Action reference

The following sections are generated from [action.yml](action.yml).

### Usage

<!-- start usage -->

```yaml
- uses: bitflight-devops/github-action-jira-transition-manager@v1.1.8
  with:
    # Description: A comma delimited list of one or more Jira issues to be
    # transitioned
    #
    issues: ""

    # Description: YAML configuration that overrides the configuration in the
    # `.github/github_event_jira_transitions.yml` file.
    #
    jira_transitions_yaml: ""

    # Description: The Jira Cloud or Data Center base URL including protocol, e.g.
    # 'https://company.atlassian.net' or use environment variable JIRA_BASE_URL
    #
    jira_base_url: ""

    # Description: The Jira Cloud user email address or Data Center username for Basic
    # authentication or use environment variable JIRA_USER_EMAIL
    #
    jira_user_email: ""

    # Description: The Jira Cloud API token or Data Center user password for Basic
    # authentication or use environment variable JIRA_API_TOKEN
    #
    jira_api_token: ""

    # Description: If there is an error during transition, the action will error out.
    #
    # Default: false
    fail_on_error: ""
```

<!-- end usage -->

### Inputs

<!-- start inputs -->

| **Input**                                 | **Description**                                                                                                                           | **Default**        | **Required** |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------ |
| <b><code>issues</code></b>                | A comma delimited list of one or more Jira issues to be transitioned                                                                      |                    | **true**     |
| <b><code>jira_transitions_yaml</code></b> | YAML configuration that overrides the configuration in the <code>.github/github_event_jira_transitions.yml</code> file.                   |                    | **false**    |
| <b><code>jira_base_url</code></b>         | The Jira Cloud or Data Center base URL including protocol, e.g. 'https://company.atlassian.net' or use environment variable JIRA_BASE_URL |                    | **false**    |
| <b><code>jira_user_email</code></b>       | The Jira Cloud user email address or Data Center username for Basic authentication or use environment variable JIRA_USER_EMAIL            |                    | **false**    |
| <b><code>jira_api_token</code></b>        | The Jira Cloud API token or Data Center user password for Basic authentication or use environment variable JIRA_API_TOKEN                 |                    | **false**    |
| <b><code>fail_on_error</code></b>         | If there is an error during transition, the action will error out.                                                                        | <code>false</code> | **false**    |

<!-- end inputs -->

### Outputs

<!-- start outputs -->

| **Output**                       | **Description**                                         | **Value** |
| -------------------------------- | ------------------------------------------------------- | --------- |
| <b><code>issueOutputs</code></b> | A JSON list of Jira Issues and their transition details |           |

<!-- end outputs -->

## Development and CI

Use Node.js 24.19 or newer within the supported range in `package.json`, and Yarn 1.22.22:

```bash
yarn install --frozen-lockfile
yarn tsc --noEmit
yarn lint
yarn test
yarn build
git diff --exit-code -- dist
```

The [Jira E2E guide](e2e/README.md) explains how to run the packaged action against a disposable Jira Data Center instance. Its local lifecycle uses `yarn e2e:prepare`, `yarn e2e:test`, and `yarn e2e:down`. See the [shared fixture documentation](e2e/jira/README.md) for Docker prerequisites, official image pins, setup, licensing, cache validation, required restores, and diagnostics.

CI verifies both packaged execution and a native `uses: ./` invocation against real Jira, with independent checks of status, changelog, and action outputs. This Data Center test lane does not establish Jira Cloud compatibility; Cloud-specific behavior requires a real Cloud test site.

Run `yarn generate-docs` after changing the action contract. It updates the generated README sections and stages their configuration and branding SVG. During release preparation, the generated version comes from `package.json` so it matches the version being tagged.
