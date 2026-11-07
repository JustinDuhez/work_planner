import { render, screen } from '@testing-library/react';
import { copy } from '../copy';
import { WorkModeIcon } from './day-row';

describe('WorkModeIcon', () => {
  it('shows the telework icon', () => {
    render(<WorkModeIcon workMode="telework" />);
    expect(screen.getByLabelText(copy.clock.telework)).toBeInTheDocument();
  });

  it('shows the on-site icon', () => {
    render(<WorkModeIcon workMode="on_site" />);
    expect(screen.getByLabelText(copy.clock.onSite)).toBeInTheDocument();
  });

  it('shows nothing before a work mode is set', () => {
    const { container } = render(<WorkModeIcon workMode={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
