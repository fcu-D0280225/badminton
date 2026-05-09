import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coach } from '../entities/coach.entity';
import { CoachClass } from '../entities/coach-class.entity';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coach, CoachClass])],
  controllers: [CoachController],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
