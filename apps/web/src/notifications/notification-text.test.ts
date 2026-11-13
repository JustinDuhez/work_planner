import type { NotificationView } from '@work-planner/domain';
import { notificationLink, notificationText } from './notification-text';

function leaveNotification(
  overrides: Partial<NotificationView> & Pick<NotificationView, 'type' | 'payload'>,
): NotificationView {
  return {
    id: 1,
    readAt: null,
    createdAt: '2026-11-12T09:00:00.000Z',
    ...overrides,
  };
}

describe('leave notifications', () => {
  const payload = {
    leaveRequestId: 4,
    actorName: 'Léa Moreau',
    dayTypeLabel: 'Congé',
    startDate: '2026-11-23',
    endDate: '2026-11-25',
  };

  it('tells a person a manager declared an absence for them and opens their calendar', () => {
    const notification = leaveNotification({
      type: 'leave_request_declared',
      payload: { ...payload, actorName: 'Sophie Dubois' },
    });

    expect(notificationText(notification)).toBe(
      'Sophie Dubois a déclaré pour vous : Congé, du 23 nov. 2026 au 25 nov. 2026',
    );
    expect(notificationLink(notification, 7)).toBe('/calendrier');
  });

  it('tells a person a manager cancelled their request and opens their calendar', () => {
    const notification = leaveNotification({
      type: 'leave_request_withdrawn',
      payload: { ...payload, actorName: 'Sophie Dubois' },
    });

    expect(notificationText(notification)).toBe(
      'Sophie Dubois a annulé votre demande : Congé, du 23 nov. 2026 au 25 nov. 2026',
    );
    expect(notificationLink(notification, 7)).toBe('/calendrier');
  });

  it('tells an approver about a new request and opens the inbox', () => {
    const notification = leaveNotification({ type: 'leave_request_received', payload });

    expect(notificationText(notification)).toBe(
      'Léa Moreau demande : Congé, du 23 nov. 2026 au 25 nov. 2026',
    );
    expect(notificationLink(notification, 2)).toBe('/demandes?onglet=a-valider');
  });

  it('tells the requester about the decision and opens their requests', () => {
    const approved = leaveNotification({
      type: 'leave_request_reviewed',
      payload: { ...payload, actorName: 'Sophie Dubois', decision: 'approved' },
    });
    const refused = leaveNotification({
      type: 'leave_request_reviewed',
      payload: {
        ...payload,
        actorName: 'Sophie Dubois',
        decision: 'refused',
        startDate: '2026-11-23',
        endDate: '2026-11-23',
      },
    });

    expect(notificationText(approved)).toBe(
      'Sophie Dubois a validé votre demande : Congé, du 23 nov. 2026 au 25 nov. 2026',
    );
    expect(notificationText(refused)).toBe(
      'Sophie Dubois a refusé votre demande : Congé, le 23 nov. 2026',
    );
    expect(notificationLink(approved, 7)).toBe('/demandes?onglet=mes-demandes');
  });

  it('tells approvers about a cancelled approved request', () => {
    expect(notificationText(leaveNotification({ type: 'leave_request_cancelled', payload }))).toBe(
      'Léa Moreau a annulé sa demande validée : Congé, du 23 nov. 2026 au 25 nov. 2026',
    );
  });
});
