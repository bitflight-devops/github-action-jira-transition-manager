<!-- start title -->

# GitHub Action: Jira Transition Manager

<!-- end title -->
<!-- start description -->

This action will transition the list of Jira issues provided between states, or it will display the available transitions and the current issue state.

<!-- end description -->

## Action Usage

<!-- start usage -->

```yaml
- uses: bitflight-devops/github-action-transition-jira-ticket@v1.0.1
  with:
    # A comma delimited list of one or more Jira issues to be transitioned
    issues: ''

    # YAML configuration that overrides the configuration in the
    # `.github/github_event_jira_transitions.yml` file.
    jira_transitions_yaml: ''

    # The Jira cloud base url including protocol i.e. 'https://company.atlassian.net'
    # or use environment variable JIRA_BASE_URL
    jira_base_url: ''

    # The Jira cloud user email address or use environment variable JIRA_USER_EMAIL
    jira_user_email: ''

    # The Jira cloud user api token or use environment variable JIRA_API_TOKEN
    jira_api_token: ''

    # If there is an error during transition, the action will error out.
    # Default: false
    fail-on-error: ''
```

<!-- end usage -->

## GitHub Action Inputs

<!-- start inputs -->

| **Input**                   | **Description**                                                                                                           | **Default** | **Required** |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :---------: | :----------: |
| **`issues`**                | A comma delimited list of one or more Jira issues to be transitioned                                                      |             |   **true**   |
| **`jira_transitions_yaml`** | YAML configuration that overrides the configuration in the `.github/github_event_jira_transitions.yml` file.              |             |  **false**   |
| **`jira_base_url`**         | The Jira cloud base url including protocol i.e. 'https://company.atlassian.net' or use environment variable JIRA_BASE_URL |             |  **false**   |
| **`jira_user_email`**       | The Jira cloud user email address or use environment variable JIRA_USER_EMAIL                                             |             |  **false**   |
| **`jira_api_token`**        | The Jira cloud user api token or use environment variable JIRA_API_TOKEN                                                  |             |  **false**   |
| **`fail-on-error`**         | If there is an error during transition, the action will error out.                                                        |             |  **false**   |

<!-- end inputs -->

## GitHub Action Outputs

<!-- start outputs -->

| **Output**     | **Description**                                         | **Default** | **Required** |
| :------------- | :------------------------------------------------------ | ----------- | ------------ |
| `issueOutputs` | A JSON list of Jira Issues and their transition details |             |              |

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
