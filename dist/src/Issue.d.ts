import { Context } from '@actions/github/lib/context';
import { IssueBean, IssueTransition } from 'jira.js/out/version3/models';
import { Args } from './@types';
import Jira from './Jira';
import TransitionEventManager from './TransitionEventManager';
export interface IssueOutput {
    issue: string;
    names: string[];
    ids: string[];
    status: string;
    beforestatus: string;
}
export default class Issue {
    issue: string;
    projectName: string;
    transitionNames: string[];
    transitionIds: string[];
    beforeStatus: string | null;
    toStatus: string | null;
    status: null | string;
    jira: Jira;
    issueObject: IssueBean | null;
    issueTransitions: IssueTransition[] | undefined;
    transitionsLogString: string[];
    argv: Args;
    transitionEventManager: TransitionEventManager;
    constructor(issue: string, jira: Jira, argv: Args, context: Context);
    build(): Promise<Issue>;
    requiresTransition(): boolean;
    transitionToApply(): IssueTransition | undefined;
    transition(): Promise<void>;
    getOutputs(): Promise<IssueOutput>;
    getStatus(fresh?: boolean): Promise<string>;
    setIssue(issue: string): void;
    getTransitions(): Promise<IssueTransition[] | undefined>;
    getJiraIssueObject(): Promise<IssueBean>;
}
export declare type Issues = Issue[];
