import { setGlobalProxyFromEnv } from 'node:http';

import * as core from '@actions/core';
import * as github from '@actions/github';

import { Action } from './action';
import { getInputs } from './input-helper';

async function exec(): Promise<void> {
  // Preserve Axios-era HTTP(S)_PROXY/NO_PROXY support with Node 24 native fetch.
  setGlobalProxyFromEnv();
  await new Action(github.context, getInputs()).execute();
}

exec().catch((error) => {
  core.setFailed(error);
});
