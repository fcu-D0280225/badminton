import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coach } from '../entities/coach.entity';
import { CoachClass } from '../entities/coach-class.entity';
import { CoachClassEnrollment } from '../entities/coach-class-enrollment.entity';
import { Player } from '../entities/player.entity';
import { CoachService } from './coach.service';
import { EnrollmentService } from './enrollment.service';
import { CoachController } from './coach.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coach, CoachClass, CoachClassEnrollment, Player]),
  ],
  controllers: [CoachController],
  providers: [CoachService, EnrollmentService],
  exports: [CoachService, EnrollmentService],
})
export class CoachModule {}
