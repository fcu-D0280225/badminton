import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { AuthUser } from './types';

/** venue 角色：可管理的所有 venueId（pivot 為主，fallback entityId） */
export function getVenueIdsForUser(user: AuthUser): number[] {
  if (user.role !== 'venue') return [];
  if (user.venueIds && user.venueIds.length > 0) return user.venueIds;
  return [user.entityId];
}

/**
 * 給 booking 查詢用：依 user.role 回傳一組 OR-clauses，符合任一即可看見。
 * venue 使用者：可看見自己所有綁定場館的預約（多場館支援，FEAT-007）
 * organizer：只能看見自己當團主的預約
 * player：只能看見自己當臨打的預約
 * member：organizer + player 兩種身分皆可
 * booker：只能看見自己當預約人的預約
 */
export function bookingOwnerWhereClauses(user: AuthUser): object[] {
  switch (user.role) {
    case 'venue': {
      const venueIds = getVenueIdsForUser(user);
      return [{ venueId: In(venueIds) }];
    }
    case 'organizer':
      return [{ organizerId: user.entityId }];
    case 'player':
      return [{ playerId: user.entityId }];
    case 'member': {
      const clauses: object[] = [{ organizerId: user.entityId }];
      if (user.linkedEntityId) clauses.push({ playerId: user.linkedEntityId });
      return clauses;
    }
    case 'booker':
      return [{ bookerId: user.entityId }];
    default:
      throw new ForbiddenException('未知的角色');
  }
}

/**
 * 判斷某筆 booking 是否屬於 user。供 service 在取得單筆後做門檻檢查。
 */
export function isBookingOwnedBy(
  user: AuthUser,
  booking: {
    venueId?: number;
    organizerId?: number;
    playerId?: number;
    bookerId?: number;
  },
): boolean {
  if (!booking) return false;
  switch (user.role) {
    case 'venue':
      return getVenueIdsForUser(user).includes(booking.venueId);
    case 'organizer':
      return booking.organizerId === user.entityId;
    case 'player':
      return booking.playerId === user.entityId;
    case 'member':
      return (
        booking.organizerId === user.entityId ||
        (user.linkedEntityId != null && booking.playerId === user.linkedEntityId)
      );
    case 'booker':
      return booking.bookerId === user.entityId;
    default:
      return false;
  }
}

/** venue 角色是否可管理此 venueId */
export function venueOwnsVenue(user: AuthUser, venueId: number): boolean {
  return user.role === 'venue' && getVenueIdsForUser(user).includes(venueId);
}

/**
 * organizer 資源（id）是否歸屬於 user。
 * venue 角色看不到 organizer 個人資料（沒有 venueId 連結），預設拒絕；
 * 如果未來需要 venue 看得到「在我場地預約過的 organizer」可改為查 booking 反推。
 */
export function ownsOrganizer(user: AuthUser, organizerId: number): boolean {
  if (user.role === 'organizer' || user.role === 'member') {
    return user.entityId === organizerId;
  }
  return false;
}

/**
 * player 資源是否歸屬於 user。
 */
export function ownsPlayer(user: AuthUser, playerId: number): boolean {
  if (user.role === 'player') return user.entityId === playerId;
  if (user.role === 'member') return user.linkedEntityId === playerId;
  return false;
}
