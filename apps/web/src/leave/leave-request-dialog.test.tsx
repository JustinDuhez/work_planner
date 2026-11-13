import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../api/query-client';
import { copy } from '../copy';
import { DAY_TYPES } from '../test/leave-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { LeaveRequestDialog } from './leave-request-dialog';

const CREATED = {
  id: 1,
  user: { id: 7, firstName: 'Léa', lastName: 'Moreau' },
  dayTypeCode: 'leave',
  startDate: '2026-11-23',
  startHalf: 'am',
  endDate: '2026-11-23',
  endHalf: 'pm',
  halfDayCount: 2,
  status: 'pending',
  reason: null,
  ruleNote: null,
  isAutoApproved: false,
  reviewer: null,
  declaredBy: null,
  reviewComment: null,
  reviewedAt: null,
  createdAt: '2026-11-12T09:00:00.000Z',
  canReview: false,
  canCancel: true,
};

function renderDialog(routes: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    'GET /api/v1/day-types': { status: 200, body: DAY_TYPES },
    'GET /api/v1/public-holidays?year=2026': {
      status: 200,
      body: [{ date: '2026-12-25', label: 'Noël' }],
    },
    ...routes,
  });
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={createQueryClient({ shouldRetry: false })}>
      <LeaveRequestDialog initialDate="2026-11-23" minDate="2026-11-12" onClose={onClose} />
    </QueryClientProvider>,
  );
  return {
    fetchMock,
    onClose,
    user: userEvent.setup(),
    dialog: screen.getByRole('dialog', { name: copy.leave.dialogTitle }),
  };
}

async function sentBody(fetchMock: jest.Mock): Promise<unknown> {
  let body: unknown;
  await waitFor(() => {
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/v1/leave-requests' && (init as RequestInit | undefined)?.method === 'POST',
    ) as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    body = JSON.parse(call?.[1].body as string);
  });
  return body;
}

// The type list loads asynchronously: wait for its options before choosing.
async function chooseType(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  code: string,
) {
  const select = await within(dialog).findByLabelText(copy.leave.type);
  await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
  await user.selectOptions(select, code);
}

describe('LeaveRequestDialog', () => {
  it('requests the chosen day by default, morning to afternoon', async () => {
    const { user, dialog, fetchMock } = renderDialog({
      'POST /api/v1/leave-requests': { status: 201, body: CREATED },
    });

    await chooseType(user, dialog, 'leave');
    expect(within(dialog).getByText('1 jour · lun. 23 nov.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await sentBody(fetchMock)).toEqual({
      dayTypeCode: 'leave',
      startDate: '2026-11-23',
      startHalf: 'am',
      endDate: '2026-11-23',
      endHalf: 'pm',
    });
    expect(await within(dialog).findByRole('status')).toHaveTextContent(copy.leave.sentToManager);
  });

  it('summarizes a range without weekends and holidays', async () => {
    const { user, dialog } = renderDialog();

    await chooseType(user, dialog, 'leave');
    await user.clear(within(dialog).getByLabelText(copy.leave.endDate));
    await user.type(within(dialog).getByLabelText(copy.leave.endDate), '2026-11-26');
    await user.selectOptions(within(dialog).getByLabelText(copy.leave.endHalf), 'am');

    expect(
      within(dialog).getByText('3,5 jours · du lun. 23 nov. matin au jeu. 26 nov. midi'),
    ).toBeInTheDocument();
  });

  it('asks for a reason and locks one half-day for an early departure', async () => {
    const { user, dialog, fetchMock } = renderDialog({
      'POST /api/v1/leave-requests': {
        status: 201,
        body: { ...CREATED, dayTypeCode: 'early_departure' },
      },
    });

    await chooseType(user, dialog, 'early_departure');
    expect(within(dialog).queryByLabelText(copy.leave.endDate)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));
    expect(within(dialog).getByText(copy.leave.reasonRequired)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(copy.leave.reason), 'Rendez-vous médical');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await sentBody(fetchMock)).toEqual({
      dayTypeCode: 'early_departure',
      startDate: '2026-11-23',
      startHalf: 'pm',
      endDate: '2026-11-23',
      endHalf: 'pm',
      reason: 'Rendez-vous médical',
    });
  });

  it('says when telework was approved at once', async () => {
    const { user, dialog } = renderDialog({
      'POST /api/v1/leave-requests': {
        status: 201,
        body: { ...CREATED, dayTypeCode: 'telework', status: 'approved', isAutoApproved: true },
      },
    });

    await chooseType(user, dialog, 'telework');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      copy.leave.teleworkApproved,
    );
  });

  it('explains telework held by the 3-day rule', async () => {
    const note = 'Il ne resterait que 2,5 jours sur site la semaine du 23 nov.';
    const { user, dialog } = renderDialog({
      'POST /api/v1/leave-requests': {
        status: 201,
        body: { ...CREATED, dayTypeCode: 'telework', ruleNote: note },
      },
    });

    await chooseType(user, dialog, 'telework');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      `${copy.leave.needsApproval} ${note}`,
    );
  });

  it('says telework is approved when nobody could be asked to hold it', async () => {
    const note = 'Il ne resterait que 2,5 jours sur site la semaine du 23 nov.';
    const { user, dialog } = renderDialog({
      'POST /api/v1/leave-requests': {
        status: 201,
        body: { ...CREATED, dayTypeCode: 'telework', status: 'approved', ruleNote: note },
      },
    });

    await chooseType(user, dialog, 'telework');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      copy.leave.teleworkApproved,
    );
  });

  it('shows an overlap refusal from the server', async () => {
    const { user, dialog } = renderDialog({
      'POST /api/v1/leave-requests': {
        status: 409,
        body: { code: 'LEAVE_OVERLAP', message: 'Le 23 nov. (matin) est déjà déclaré.' },
      },
    });

    await chooseType(user, dialog, 'leave');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Le 23 nov. (matin) est déjà déclaré.',
    );
  });

  it('asks for a type without sending anything when none is chosen', async () => {
    const { user, dialog, fetchMock } = renderDialog();

    await within(dialog).findByLabelText(copy.leave.type);
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(within(dialog).getByText(copy.leave.typeRequired)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false);
  });

  it('clears the missing-type error once a type is chosen', async () => {
    const { user, dialog } = renderDialog();

    await within(dialog).findByLabelText(copy.leave.type);
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));
    expect(within(dialog).getByText(copy.leave.typeRequired)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Type/ }), 'leave');

    expect(within(dialog).queryByText(copy.leave.typeRequired)).not.toBeInTheDocument();
  });

  it('does not send a reason typed for an early departure after switching type', async () => {
    const { user, dialog, fetchMock } = renderDialog({
      'POST /api/v1/leave-requests': { status: 201, body: CREATED },
    });

    await chooseType(user, dialog, 'early_departure');
    await user.type(within(dialog).getByLabelText(copy.leave.reason), 'Rendez-vous');
    await chooseType(user, dialog, 'leave');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.submit }));

    expect(await sentBody(fetchMock)).not.toHaveProperty('reason');
  });
});
