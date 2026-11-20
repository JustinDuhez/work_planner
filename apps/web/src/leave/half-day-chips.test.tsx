import { render, screen } from '@testing-library/react';
import { DAY_TYPES } from '../test/leave-fixtures';
import { HalfDayChips } from './half-day-chips';

describe('HalfDayChips', () => {
  it('shows one chip for a whole day of the same type', () => {
    render(
      <HalfDayChips
        halfDays={{
          am: { dayTypeCode: 'leave', status: 'approved' },
          pm: { dayTypeCode: 'leave', status: 'approved' },
        }}
        dayTypes={DAY_TYPES}
      />,
    );

    expect(screen.getByText('Congé')).toBeInTheDocument();
    expect(screen.queryByText(/matin/)).not.toBeInTheDocument();
  });

  it('shows each half with its own chip and marks pending ones', () => {
    render(
      <HalfDayChips
        halfDays={{
          am: { dayTypeCode: 'telework', status: 'pending' },
          pm: { dayTypeCode: 'early_departure', status: 'approved' },
        }}
        dayTypes={DAY_TYPES}
      />,
    );

    expect(screen.getByText('Télétravail · matin (en attente)')).toBeInTheDocument();
    expect(screen.getByText('Départ anticipé · après-midi')).toBeInTheDocument();
  });

  it('tells a pending chip from an approved one', () => {
    render(
      <HalfDayChips
        halfDays={{
          am: { dayTypeCode: 'sick', status: 'pending' },
          pm: { dayTypeCode: 'leave', status: 'approved' },
        }}
        dayTypes={DAY_TYPES}
      />,
    );

    expect(screen.getByText('Maladie · matin (en attente)')).toHaveAttribute(
      'data-state',
      'pending',
    );
    expect(screen.getByText('Congé · après-midi')).toHaveAttribute('data-state', 'approved');
  });

  it('names the chip after the code for an unknown type', () => {
    render(
      <HalfDayChips
        halfDays={{ am: { dayTypeCode: 'mystery', status: 'approved' }, pm: null }}
        dayTypes={DAY_TYPES}
      />,
    );

    expect(screen.getByText('mystery · matin')).toBeInTheDocument();
  });

  it('shows nothing for an ordinary day', () => {
    const { container } = render(
      <HalfDayChips halfDays={{ am: null, pm: null }} dayTypes={DAY_TYPES} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
