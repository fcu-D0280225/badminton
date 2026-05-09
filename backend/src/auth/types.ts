import { AccountRole } from '../entities/account.entity';

export interface AuthUser {
  id: number;
  username: string;
  role: AccountRole;
  entityId: number;
  linkedEntityId?: number; // member 角色才有：playerId
  venueIds?: number[];     // venue 角色才有：可管理的所有 venueId（含 entityId 主場館）
}
