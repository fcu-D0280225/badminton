import { In } from 'typeorm';
import {
  bookingOwnerWhereClauses,
  isBookingOwnedBy,
  ownsOrganizer,
  ownsPlayer,
  getVenueIdsForUser,
  venueOwnsVenue,
} from './ownership.helper';
import { AuthUser } from './types';

const mkUser = (
  role: AuthUser['role'],
  entityId: number,
  linkedEntityId?: number,
  venueIds?: number[],
): AuthUser => ({
  id: 1,
  username: 'u',
  role,
  entityId,
  linkedEntityId,
  venueIds,
});

describe('bookingOwnerWhereClauses', () => {
  it('venue without venueIds → fallback to entityId via In([entityId])', () => {
    expect(bookingOwnerWhereClauses(mkUser('venue', 7))).toEqual([
      { venueId: In([7]) },
    ]);
  });

  it('venue with multiple venueIds → In([list])', () => {
    expect(
      bookingOwnerWhereClauses(mkUser('venue', 7, undefined, [7, 12])),
    ).toEqual([{ venueId: In([7, 12]) }]);
  });

  it('organizer → organizerId', () => {
    expect(bookingOwnerWhereClauses(mkUser('organizer', 3))).toEqual([
      { organizerId: 3 },
    ]);
  });

  it('player → playerId', () => {
    expect(bookingOwnerWhereClauses(mkUser('player', 5))).toEqual([
      { playerId: 5 },
    ]);
  });

  it('member with linkedEntityId → both organizerId and playerId', () => {
    expect(bookingOwnerWhereClauses(mkUser('member', 3, 5))).toEqual([
      { organizerId: 3 },
      { playerId: 5 },
    ]);
  });

  it('member without linkedEntityId → only organizerId', () => {
    expect(bookingOwnerWhereClauses(mkUser('member', 3))).toEqual([
      { organizerId: 3 },
    ]);
  });

  it('booker → bookerId', () => {
    expect(bookingOwnerWhereClauses(mkUser('booker', 9))).toEqual([
      { bookerId: 9 },
    ]);
  });
});

describe('isBookingOwnedBy', () => {
  it('venue matches venueId from venueIds list (multi-venue)', () => {
    expect(isBookingOwnedBy(mkUser('venue', 7, undefined, [7, 12]), { venueId: 7 })).toBe(true);
    expect(isBookingOwnedBy(mkUser('venue', 7, undefined, [7, 12]), { venueId: 12 })).toBe(true);
    expect(isBookingOwnedBy(mkUser('venue', 7, undefined, [7, 12]), { venueId: 99 })).toBe(false);
  });

  it('venue without venueIds falls back to entityId', () => {
    expect(isBookingOwnedBy(mkUser('venue', 7), { venueId: 7 })).toBe(true);
    expect(isBookingOwnedBy(mkUser('venue', 7), { venueId: 8 })).toBe(false);
  });

  it('player matches its own playerId only', () => {
    expect(isBookingOwnedBy(mkUser('player', 5), { playerId: 5 })).toBe(true);
    expect(isBookingOwnedBy(mkUser('player', 5), { playerId: 6 })).toBe(false);
    expect(isBookingOwnedBy(mkUser('player', 5), { organizerId: 5 })).toBe(false);
  });

  it('member matches own organizerId OR linkedEntityId as playerId', () => {
    const user = mkUser('member', 3, 5);
    expect(isBookingOwnedBy(user, { organizerId: 3 })).toBe(true);
    expect(isBookingOwnedBy(user, { playerId: 5 })).toBe(true);
    expect(isBookingOwnedBy(user, { organizerId: 4 })).toBe(false);
    expect(isBookingOwnedBy(user, { playerId: 6 })).toBe(false);
  });

  it('booker matches its own bookerId', () => {
    expect(isBookingOwnedBy(mkUser('booker', 9), { bookerId: 9 })).toBe(true);
    expect(isBookingOwnedBy(mkUser('booker', 9), { bookerId: 10 })).toBe(false);
  });

  it('returns false for null booking', () => {
    expect(isBookingOwnedBy(mkUser('player', 1), null as any)).toBe(false);
  });
});

describe('ownsOrganizer', () => {
  it('organizer/member match own entityId; venue/player/booker do not', () => {
    expect(ownsOrganizer(mkUser('organizer', 3), 3)).toBe(true);
    expect(ownsOrganizer(mkUser('organizer', 3), 4)).toBe(false);
    expect(ownsOrganizer(mkUser('member', 3), 3)).toBe(true);
    expect(ownsOrganizer(mkUser('venue', 3), 3)).toBe(false);
    expect(ownsOrganizer(mkUser('player', 3), 3)).toBe(false);
    expect(ownsOrganizer(mkUser('booker', 3), 3)).toBe(false);
  });
});

describe('getVenueIdsForUser', () => {
  it('returns venueIds list when present', () => {
    expect(getVenueIdsForUser(mkUser('venue', 7, undefined, [7, 12, 33]))).toEqual([7, 12, 33]);
  });
  it('falls back to [entityId] when venueIds empty', () => {
    expect(getVenueIdsForUser(mkUser('venue', 7))).toEqual([7]);
  });
  it('non-venue role returns empty array', () => {
    expect(getVenueIdsForUser(mkUser('player', 5))).toEqual([]);
    expect(getVenueIdsForUser(mkUser('organizer', 3))).toEqual([]);
  });
});

describe('venueOwnsVenue', () => {
  it('venue owns any venueId in their list', () => {
    expect(venueOwnsVenue(mkUser('venue', 7, undefined, [7, 12]), 12)).toBe(true);
    expect(venueOwnsVenue(mkUser('venue', 7, undefined, [7, 12]), 99)).toBe(false);
  });
  it('non-venue never owns', () => {
    expect(venueOwnsVenue(mkUser('player', 7), 7)).toBe(false);
    expect(venueOwnsVenue(mkUser('organizer', 7), 7)).toBe(false);
  });
});

describe('ownsPlayer', () => {
  it('player matches own entityId; member matches linkedEntityId', () => {
    expect(ownsPlayer(mkUser('player', 5), 5)).toBe(true);
    expect(ownsPlayer(mkUser('player', 5), 6)).toBe(false);
    expect(ownsPlayer(mkUser('member', 3, 5), 5)).toBe(true);
    expect(ownsPlayer(mkUser('member', 3, 5), 6)).toBe(false);
    expect(ownsPlayer(mkUser('member', 3), 5)).toBe(false);
    expect(ownsPlayer(mkUser('venue', 5), 5)).toBe(false);
    expect(ownsPlayer(mkUser('organizer', 5), 5)).toBe(false);
    expect(ownsPlayer(mkUser('booker', 5), 5)).toBe(false);
  });
});
