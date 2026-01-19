import { Version2Client } from 'jira.js';

interface JiraSeedConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface Project {
  key: string;
  name: string;
  projectTypeKey: string;
  lead: string;
}

interface IssueData {
  projectKey: string;
  summary: string;
  issueType: string;
  description?: string;
}

export class JiraSeeder {
  private client: Version2Client;

  constructor(config: JiraSeedConfig) {
    this.client = new Version2Client({
      host: config.baseUrl,
      telemetry: false,
      authentication: {
        basic: {
          email: config.email,
          apiToken: config.apiToken,
        },
      },
    });
  }

  async waitForJira(maxRetries = 30, retryInterval = 5000): Promise<void> {
    console.log('Waiting for Jira to be ready...');
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.client.myself.getCurrentUser();
        console.log('Jira is ready!');
        return;
      } catch (error) {
        console.log(`Attempt ${i + 1}/${maxRetries}: Jira not ready yet...`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
    throw new Error('Jira did not become ready in time');
  }

  async createProject(project: Project): Promise<any> {
    try {
      console.log(`Creating project ${project.key}...`);
      const result = await this.client.projects.createProject({
        key: project.key,
        name: project.name,
        projectTypeKey: project.projectTypeKey,
        leadAccountId: project.lead,
      });
      console.log(`Project ${project.key} created successfully`);
      return result;
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.errorMessages?.includes('A project with that name already exists.')) {
        console.log(`Project ${project.key} already exists, skipping...`);
        return null;
      }
      throw error;
    }
  }

  async getProjectId(projectKey: string): Promise<string> {
    const project = await this.client.projects.getProject({ projectIdOrKey: projectKey });
    return project.id as string;
  }

  async createIssue(issueData: IssueData): Promise<any> {
    try {
      console.log(`Creating issue in project ${issueData.projectKey}: ${issueData.summary}`);
      const result = await this.client.issues.createIssue({
        fields: {
          project: {
            key: issueData.projectKey,
          },
          summary: issueData.summary,
          issuetype: {
            name: issueData.issueType,
          },
          description: issueData.description || '',
        },
      });
      console.log(`Issue created: ${result.key}`);
      return result;
    } catch (error: any) {
      console.error(`Failed to create issue: ${error.message}`);
      throw error;
    }
  }

  async getIssueTransitions(issueKey: string): Promise<any> {
    return this.client.issues.getTransitions({ issueIdOrKey: issueKey });
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    console.log(`Transitioning issue ${issueKey} with transition ID ${transitionId}`);
    await this.client.issues.doTransition({
      issueIdOrKey: issueKey,
      transition: { id: transitionId },
    });
  }

  async getCurrentUser(): Promise<any> {
    return this.client.myself.getCurrentUser();
  }

  async seedTestData(): Promise<void> {
    try {
      // Wait for Jira to be ready
      await this.waitForJira();

      // Get current user to use as project lead
      const currentUser = await this.getCurrentUser();
      const leadAccountId = currentUser.accountId;

      // Create test projects
      const projects: Project[] = [
        {
          key: 'DVPS',
          name: 'DevOps Project',
          projectTypeKey: 'software',
          lead: leadAccountId,
        },
        {
          key: 'UNICORN',
          name: 'Unicorn Project',
          projectTypeKey: 'software',
          lead: leadAccountId,
        },
      ];

      for (const project of projects) {
        await this.createProject(project);
      }

      // Create test issues
      const testIssues: IssueData[] = [
        {
          projectKey: 'DVPS',
          summary: 'Test issue for transition testing',
          issueType: 'Task',
          description: 'This is a test issue for e2e testing',
        },
        {
          projectKey: 'DVPS',
          summary: 'Another test issue',
          issueType: 'Task',
          description: 'Second test issue',
        },
        {
          projectKey: 'DVPS',
          summary: 'Bug fix test',
          issueType: 'Bug',
          description: 'Test bug for workflow transitions',
        },
        {
          projectKey: 'UNICORN',
          summary: 'Unicorn project task',
          issueType: 'Task',
          description: 'Test task in Unicorn project',
        },
        {
          projectKey: 'UNICORN',
          summary: 'Feature request',
          issueType: 'Story',
          description: 'Test story for feature work',
        },
      ];

      const createdIssues = [];
      for (const issueData of testIssues) {
        const issue = await this.createIssue(issueData);
        createdIssues.push(issue);
      }

      console.log('\n=== Test Data Summary ===');
      console.log(`Projects created: ${projects.map(p => p.key).join(', ')}`);
      console.log(`Issues created: ${createdIssues.map(i => i.key).join(', ')}`);
      console.log('=========================\n');

      return;
    } catch (error: any) {
      console.error('Failed to seed test data:', error.message);
      throw error;
    }
  }
}

// Script execution
async function main() {
  const config: JiraSeedConfig = {
    baseUrl: process.env.JIRA_BASE_URL || 'http://localhost:8080',
    email: process.env.JIRA_USER_EMAIL || 'admin@example.com',
    apiToken: process.env.JIRA_API_TOKEN || 'admin',
  };

  const seeder = new JiraSeeder(config);
  await seeder.seedTestData();
}

// Only run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default JiraSeeder;
