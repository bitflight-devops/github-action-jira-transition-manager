import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packagedActionPath = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

interface IssueOutput {
  issue: string;
  names: string[];
  ids: string[];
  status: string;
  beforestatus: string;
}

interface ActionInvocation {
  issues: string[];
  baseUrl: string;
  username: string;
  password: string;
  transitionsYaml: string;
  payload: Record<string, unknown>;
  eventName?: string;
  failOnError?: boolean;
  configSource?: 'input' | 'file';
}

interface ActionResult {
  code: number;
  stdout: string;
  stderr: string;
  outputs: IssueOutput[];
}

function parseIssueOutputs(contents: string): IssueOutput[] {
  const lines = contents.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('issueOutputs<<'));
  if (start === -1) throw new Error('The packaged action did not write issueOutputs to GITHUB_OUTPUT');
  const delimiter = lines[start].slice('issueOutputs<<'.length);
  const end = lines.indexOf(delimiter, start + 1);
  if (end === -1) throw new Error('The packaged action wrote an incomplete GITHUB_OUTPUT value');
  const outputs: unknown = JSON.parse(lines.slice(start + 1, end).join('\n'));
  if (!Array.isArray(outputs)) throw new Error('issueOutputs must be a JSON array');
  return outputs as IssueOutput[];
}

/** Runs the built entry point the same way the GitHub runner launches a JavaScript action. */
export async function runPackagedAction(invocation: ActionInvocation): Promise<ActionResult> {
  const workspace = await mkdtemp(path.join(tmpdir(), 'jira-transition-e2e-'));
  const eventPath = path.join(workspace, 'event.json');
  const outputPath = path.join(workspace, 'github-output');

  try {
    await writeFile(eventPath, JSON.stringify(invocation.payload));
    await writeFile(outputPath, '');
    if (invocation.configSource === 'file') {
      await mkdir(path.join(workspace, '.github'));
      await writeFile(path.join(workspace, '.github/github_event_jira_transitions.yml'), invocation.transitionsYaml);
    }

    // The host job may itself be an action or a pull request run. Its inputs,
    // credentials, and event must not leak into the action being exercised.
    const env = { ...process.env };
    for (const name of Object.keys(env)) {
      if (/^(INPUT_|JIRA_|GITHUB_)/.test(name) || name === 'NODE_OPTIONS') delete env[name];
    }
    Object.assign(env, {
      NODE_ENV: 'production',
      GITHUB_ACTIONS: 'true',
      GITHUB_ACTION: 'transition-step',
      GITHUB_EVENT_NAME: invocation.eventName ?? 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_WORKSPACE: workspace,
      GITHUB_OUTPUT: outputPath,
      GITHUB_REPOSITORY: 'integration-tests/jira-transition-manager',
      GITHUB_REF: 'refs/pull/42/merge',
      GITHUB_SHA: '1234567890123456789012345678901234567890',
      GITHUB_ACTOR: 'integration-test',
      INPUT_ISSUES: invocation.issues.join(', '),
      INPUT_FAIL_ON_ERROR: String(invocation.failOnError ?? true),
      INPUT_JIRA_TRANSITIONS_YAML: invocation.configSource === 'file' ? '' : invocation.transitionsYaml,
      INPUT_JIRA_BASE_URL: invocation.baseUrl,
      INPUT_JIRA_USER_EMAIL: invocation.username,
      INPUT_JIRA_API_TOKEN: invocation.password,
    });

    const result = await new Promise<Omit<ActionResult, 'outputs'>>((resolve, reject) => {
      const child = spawn(process.execPath, [packagedActionPath], {
        cwd: workspace,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 45000,
        killSignal: 'SIGKILL',
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.once('error', reject);
      child.once('close', (code, signal) => {
        if (signal || code === null) {
          reject(new Error(`Packaged action terminated (${signal}):\n${stdout}\n${stderr}`));
        } else {
          resolve({ code, stdout, stderr });
        }
      });
    });

    try {
      return { ...result, outputs: parseIssueOutputs(await readFile(outputPath, 'utf8')) };
    } catch (error) {
      throw new Error(`${String(error)}\nExit: ${result.code}\n${result.stdout}\n${result.stderr}`);
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
