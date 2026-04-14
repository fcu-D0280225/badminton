import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organizer } from './organizer.entity';

@Entity('organizer_notes')
export class OrganizerNote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Organizer, (organizer) => organizer.notes)
  @JoinColumn()
  organizer: Organizer;

  @Column()
  organizerId: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'public' })
  visibility: string; // public (給所有人看), player (只給臨打看)

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
