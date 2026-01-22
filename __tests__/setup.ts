// Test setup - set mock credentials before tests run
process.env.JIRA_BASE_URL = 'https://mock-jira.atlassian.net';
process.env.JIRA_USER_EMAIL = 'test@example.com';
process.env.JIRA_API_TOKEN = 'mock-api-token';

// Disable proxy settings for tests to ensure nock can intercept requests
// Add mock host to no_proxy before deleting proxy vars to avoid any caching issues
const mockHost = 'mock-jira.atlassian.net';
const noProxy = process.env.no_proxy || process.env.NO_PROXY || '';
process.env.no_proxy = noProxy ? `${noProxy},${mockHost}` : mockHost;
process.env.NO_PROXY = process.env.no_proxy;
process.env.GLOBAL_AGENT_NO_PROXY = process.env.no_proxy;

// Clear all proxy settings
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.GLOBAL_AGENT_HTTP_PROXY;
delete process.env.GLOBAL_AGENT_HTTPS_PROXY;
