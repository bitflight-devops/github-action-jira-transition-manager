import { Context } from '@actions/github/lib/context';
import { Args, JiraConfig } from './@types/';
import Jira from './Jira';
export declare class Action {
    jira: Jira;
    config: JiraConfig;
    argv: Args;
    githubEvent: Context;
    constructor(githubEvent: Context, argv: Args);
    execute(): Promise<boolean>;
}
