import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { Account } from '../entities/account.entity';
import { Venue } from '../entities/venue.entity';
import { Organizer } from '../entities/organizer.entity';
import { Player } from '../entities/player.entity';
import { Booker } from '../entities/booker.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, Venue, Organizer, Player, Booker]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'badminton-booking-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
