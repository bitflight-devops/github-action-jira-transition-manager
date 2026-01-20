<!-- start title -->

# <img src=".github/ghadocs/branding.svg" width="60px" align="center" alt="branding<icon:chevron-right color:blue>" /> GitHub Action: Jira Transition Manager

<!-- end title -->
<!-- start description -->

This action will transition the list of Jira issues provided between states, or it will display the available transitions and the current issue state.

<!-- end description -->

## Action Usage

<!-- start usage -->

```yaml
- uses: bitflight-devops/github-action-transition-jira-ticket@v1.1.0
  with:
    # Description: A comma delimited list of one or more Jira issues to be
    # transitioned
    #
    issues: ''

    # Description: YAML configuration that overrides the configuration in the
    # `.github/github_event_jira_transitions.yml` file.
    #
    jira_transitions_yaml: ''

    # Description: The Jira cloud base url including protocol i.e.
    # 'https://company.atlassian.net' or use environment variable JIRA_BASE_URL
    #
    jira_base_url: ''

    # Description: The Jira cloud user email address or use environment variable
    # JIRA_USER_EMAIL
    #
    jira_user_email: ''

    # Description: The Jira cloud user api token or use environment variable
    # JIRA_API_TOKEN
    #
    jira_api_token: ''

    # Description: If there is an error during transition, the action will error out.
    #
    # Default: false
    fail_on_error: ''
```

<!-- end usage -->

## GitHub Action Inputs

<!-- start inputs -->

| **Input**                          | **Description**                                                                                                           | **Default** | **Required** |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ |
| <code>issues</code>                | A comma delimited list of one or more Jira issues to be transitioned                                                      |             | **true**     |
| <code>jira_transitions_yaml</code> | YAML configuration that overrides the configuration in the <code>.github/github_event_jira_transitions.yml</code> file.   |             | **false**    |
| <code>jira_base_url</code>         | The Jira cloud base url including protocol i.e. 'https://company.atlassian.net' or use environment variable JIRA_BASE_URL |             | **false**    |
| <code>jira_user_email</code>       | The Jira cloud user email address or use environment variable JIRA_USER_EMAIL                                             |             | **false**    |
| <code>jira_api_token</code>        | The Jira cloud user api token or use environment variable JIRA_API_TOKEN                                                  |             | **false**    |
| <code>fail_on_error</code>         | If there is an error during transition, the action will error out.                                                        |             | **false**    |

<!-- end inputs -->

## GitHub Action Outputs

<!-- start outputs -->

| **Output**                | **Description**                                         | **Value** |
| ------------------------- | ------------------------------------------------------- | --------- |
| <code>issueOutputs</code> | A JSON list of Jira Issues and their transition details |           |

<!-- end outputs -->

The `issueOutputs` JSON structure

```json
[
  {
    "issue": "string",
    "names": ["string", "array"],
    "ids": ["string", "array"],
    "status": "string",
    "beforestatus": "string"
  }
]
```

## Development

### Running Tests

Run the standard unit tests:

```bash
yarn test
```

### E2E Testing

This project includes comprehensive end-to-end tests using a dockerized Jira instance. See [e2e/README.md](e2e/README.md) for detailed instructions.

Quick start for E2E tests:

```bash
# Start Jira stack
yarn e2e:up

# Wait for Jira to be ready (3-5 minutes)
yarn e2e:wait

# Seed test data
yarn e2e:seed

# Run E2E tests
yarn e2e:test

# Stop Jira stack
yarn e2e:down
```

Or run everything at once:

```bash
yarn e2e:all
```

### Building

Build the action:

```bash
yarn build
```

### Linting

```bash
yarn lint
yarn format
```
