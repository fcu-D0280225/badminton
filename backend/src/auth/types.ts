import { AccountRole } from '../entities/account.entity';

export interface AuthUser {
  id: number;
  username: string;
  role: AccountRole;
  entityId: number;
  linkedEntityId?: number; // member 角色才有：playerId
}
