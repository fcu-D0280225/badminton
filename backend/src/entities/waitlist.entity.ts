import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('waitlists')
export class Waitlist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  venueId: number;

  @Column()
  date: string; // YYYY-MM-DD

  @Column()
  timeSlot: string; // HH:MM-HH:MM

  @Column({ nullable: true })
  playerId: number;

  @Column({ nullable: true })
  organizerId: number;

  @Column({ default: 'waiting' })
  status: string; // waiting | notified | confirmed | expired

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
