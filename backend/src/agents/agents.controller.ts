import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new AI Agent' })
  create(@Body() createAgentDto: any) {
    return this.agentsService.create(createAgentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all registered agents' })
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details' })
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }
}
