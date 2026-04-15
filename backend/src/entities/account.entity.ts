import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

export type AccountRole = 'venue' | 'organizer' | 'player' | 'member' | 'booker';

@Entity('accounts')
@Unique(['username'])
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  passwordHash: string;

  @Column()
  role: AccountRole;

  @Column()
  entityId: number;

  @Column({ nullable: true })
  linkedEntityId: number; // member 角色專用：organizerId 存 entityId，playerId 存 linkedEntityId

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
