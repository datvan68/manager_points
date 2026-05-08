import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { TasksModule } from '../tasks/tasks.module';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [AgentsModule, TasksModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
})
export class OrchestratorModule {}
