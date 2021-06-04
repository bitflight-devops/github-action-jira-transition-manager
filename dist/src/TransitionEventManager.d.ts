import { Context } from '@actions/github/lib/context';
import { Args } from './@types';
import Jira from './Jira';
export declare const isObject: (v: any) => boolean;
export declare function objEquals(v1: any, v2: any): boolean;
export declare function checkConditions(a: any, b: any): boolean;
export declare type GitHubEventConditions = {
    [key: string]: string;
};
export declare type GitHubEvents = {
    [key: string]: GitHubEventConditions | undefined;
};
export declare type StatusEvents = {
    [key: string]: GitHubEvents;
};
export interface JiraProjectTransitionEvents {
    ignored_states?: string[];
    to_state: StatusEvents;
}
export declare type JiraProjects = {
    [key: string]: JiraProjectTransitionEvents;
};
export interface GitHubEventJiraTransitions {
    projects: Map<string, JiraProjectTransitionEvents>;
}
export default class TransitionEventManager {
    context: Context;
    projects: JiraProjects;
    jira: Jira;
    failOnError: boolean;
    ignoredStates: Map<string, string[]>;
    listenForEvents: string[];
    constructor(context: Context, jira: Jira, argv: Args);
    getIgnoredStates(currentProject: string): string[];
    githubEventToState(currentProjectName: string): string;
}
