import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { TasksService } from '../tasks/tasks.service';
import { AgentRole } from '../agents/schemas/agent.schema';
import { TaskStatus } from '../tasks/schemas/task.schema';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly tasksService: TasksService,
  ) {}

  async handleUserRequest(request: string) {
    // 1. Create a parent task for the user request
    const parentTask = await this.tasksService.create({
      title: 'Orchestration Task',
      description: request,
      status: TaskStatus.PROCESSING,
    });

    // 2. Fetch available agents
    const agents = await this.agentsService.findAll();
    const designAgent = agents.find((a) => a.role === AgentRole.DESIGN);
    const backendAgent = agents.find((a) => a.role === AgentRole.BACKEND);
    const uiAgent = agents.find((a) => a.role === AgentRole.UI);

    const subtasks = [];

    // 3. Mock decomposition: Assign tasks sequentially
    // Step 3.1: Design
    if (designAgent) {
      const designTask = await this.tasksService.create({
        title: `Design for: ${request}`,
        description: 'Analyze requirements and produce specs',
        assignedTo: designAgent._id,
        status: TaskStatus.PENDING,
      });
      subtasks.push(designTask);
    }

    // Step 3.2: Backend
    if (backendAgent) {
      const backendTask = await this.tasksService.create({
        title: `Backend for: ${request}`,
        description: 'Implement API and DB Schema based on Design',
        assignedTo: backendAgent._id,
        status: TaskStatus.PENDING,
      });
      subtasks.push(backendTask);
    }

    // Step 3.3: UI
    if (uiAgent) {
      const uiTask = await this.tasksService.create({
        title: `UI for: ${request}`,
        description: 'Implement Frontend interface',
        assignedTo: uiAgent._id,
        status: TaskStatus.PENDING,
      });
      subtasks.push(uiTask);
    }

    return {
      message: 'Request processed and tasks assigned',
      parentTaskId: parentTask._id,
      subtasks: subtasks,
    };
  }
}
