import { absenceRuns, isAbsentOn } from './absences';

const NON_BADGEABLE = new Set(['leave', 'sick', 'training_travel', 'recovery', 'early_departure']);

describe('isAbsentOn', () => {
  it('counts one approved non-workable half-day', () => {
    expect(
      isAbsentOn(
        [{ date: '2026-11-13', status: 'approved', dayTypeCode: 'early_departure' }],
        '2026-11-13',
        NON_BADGEABLE,
      ),
    ).toBe(true);
  });

  it.each([
    ['telework', 'approved'],
    ['leave', 'pending'],
  ])('ignores %s %s', (dayTypeCode, status) => {
    expect(
      isAbsentOn(
        [{ date: '2026-11-13', status: status as 'approved' | 'pending', dayTypeCode }],
        '2026-11-13',
        NON_BADGEABLE,
      ),
    ).toBe(false);
  });

  it('ignores another day', () => {
    expect(
      isAbsentOn(
        [{ date: '2026-11-12', status: 'approved', dayTypeCode: 'leave' }],
        '2026-11-13',
        NON_BADGEABLE,
      ),
    ).toBe(false);
  });
});

describe('absenceRuns', () => {
  it('merges consecutive halves of the same type and status', () => {
    expect(
      absenceRuns([
        { date: '2026-11-23', half: 'am', dayTypeCode: 'leave', status: 'approved' },
        { date: '2026-11-23', half: 'pm', dayTypeCode: 'leave', status: 'approved' },
        { date: '2026-11-24', half: 'am', dayTypeCode: 'leave', status: 'approved' },
        { date: '2026-11-24', half: 'pm', dayTypeCode: 'leave', status: 'approved' },
        { date: '2026-12-01', half: 'pm', dayTypeCode: 'telework', status: 'pending' },
      ]),
    ).toEqual([
      {
        dayTypeCode: 'leave',
        status: 'approved',
        startDate: '2026-11-23',
        startHalf: 'am',
        endDate: '2026-11-24',
        endHalf: 'pm',
      },
      {
        dayTypeCode: 'telework',
        status: 'pending',
        startDate: '2026-12-01',
        startHalf: 'pm',
        endDate: '2026-12-01',
        endHalf: 'pm',
      },
    ]);
  });

  it('splits on a change of type, of status or a gap', () => {
    const runs = absenceRuns([
      { date: '2026-11-20', half: 'pm', dayTypeCode: 'leave', status: 'approved' },
      { date: '2026-11-23', half: 'am', dayTypeCode: 'leave', status: 'approved' },
      { date: '2026-11-23', half: 'pm', dayTypeCode: 'leave', status: 'pending' },
      { date: '2026-11-24', half: 'am', dayTypeCode: 'sick', status: 'pending' },
    ]);

    expect(runs).toHaveLength(4);
  });

  it('sorts unsorted input first', () => {
    expect(
      absenceRuns([
        { date: '2026-11-24', half: 'am', dayTypeCode: 'leave', status: 'approved' },
        { date: '2026-11-23', half: 'pm', dayTypeCode: 'leave', status: 'approved' },
      ]),
    ).toHaveLength(1);
  });
});
