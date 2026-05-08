
import { Controller, Post, Body } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('orchestrator')
@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post('execute')
  @ApiOperation({ summary: 'Orchestrate a user request' })
  async execute(@Body('request') request: string) {
    return this.orchestratorService.handleUserRequest(request);
  }
}
