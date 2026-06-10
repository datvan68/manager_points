import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { TasksModule } from './tasks/tasks.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { CoreModule } from './core/core.module';
import { DepartmentsModule } from './departments/departments.module';
import { ClassesModule } from './classes/classes.module';
import { StudentsModule } from './students/students.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './core/mail/mail.module';
import { CategoriesModule } from './categories/categories.module';
import { CriteriaModule } from './criteria/criteria.module';
import { SemestersModule } from './semesters/semesters.module';
import { SummariesPointModule } from './summaries-point/summaries-point.module';
import { EvaluationDetailModule } from './evaluation-detail/evaluation-detail.module';
import { DailyClassReportModule } from './daily-class-report/daily-class-report.module';
import { AcademicRecordModule } from './academic-record/academic-record.module';
import { EvaluationPeriodsModule } from './evaluation-periods/evaluation-periods.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StudentTasksModule } from './student-tasks/student-tasks.module';
import { StudentTaskProgressModule } from './student-task-progress/student-task-progress.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5, // seconds
      max: 100, // maximum number of items in cache
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        // Optimization: Connection Pooling
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }),
      inject: [ConfigService],
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    AgentsModule,
    TasksModule,
    OrchestratorModule,
    CoreModule,
    DepartmentsModule,
    ClassesModule,
    StudentsModule,
    AuthModule,
    MailModule,
    CategoriesModule,
    CriteriaModule,
    SemestersModule,
    SummariesPointModule,
    EvaluationDetailModule,
    DailyClassReportModule,
    AcademicRecordModule,
    EvaluationPeriodsModule,
    NotificationsModule,
    StudentTasksModule,
    StudentTaskProgressModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
