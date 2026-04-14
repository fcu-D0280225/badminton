import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Booking } from './booking.entity';
import { OrganizerNote } from './organizer-note.entity';

@Entity('organizers')
export class Organizer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  contact: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => Booking, (booking) => booking.organizer)
  bookings: Booking[];

  @OneToMany(() => OrganizerNote, (note) => note.organizer)
  notes: OrganizerNote[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
