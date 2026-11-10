import { findUserAccessViolation } from './user-access-rules';

describe('findUserAccessViolation', () => {
  it('refuses to remove your own access', () => {
    expect(
      findUserAccessViolation({
        isSelf: true,
        removesAccess: true,
        removesActiveAdmin: true,
        activeAdminCount: 3,
      }),
    ).toBe('USER_SELF_RESTRICTION');
  });

  it('lets you change your own name', () => {
    expect(
      findUserAccessViolation({
        isSelf: true,
        removesAccess: false,
        removesActiveAdmin: false,
        activeAdminCount: 1,
      }),
    ).toBeNull();
  });

  it('refuses to remove the last active admin', () => {
    expect(
      findUserAccessViolation({
        isSelf: false,
        removesAccess: true,
        removesActiveAdmin: true,
        activeAdminCount: 1,
      }),
    ).toBe('USER_LAST_ADMIN');
  });

  it('allows removing an admin while another active admin remains', () => {
    expect(
      findUserAccessViolation({
        isSelf: false,
        removesAccess: true,
        removesActiveAdmin: true,
        activeAdminCount: 2,
      }),
    ).toBeNull();
  });

  it('allows blocking someone who is not an active admin', () => {
    expect(
      findUserAccessViolation({
        isSelf: false,
        removesAccess: true,
        removesActiveAdmin: false,
        activeAdminCount: 1,
      }),
    ).toBeNull();
  });
});
