import { render, screen } from '@testing-library/react';
import { CaptionBar } from './CaptionBar';

describe('CaptionBar', () => {
  it('renders the active voice caption accessibly', () => {
    render(<CaptionBar text="Short spoken answer." />);

    expect(screen.getByRole('status', { name: 'Voice caption' })).toHaveTextContent('Short spoken answer.');
  });

  it('renders nothing for empty captions', () => {
    const { container } = render(<CaptionBar text="" />);

    expect(container).toBeEmptyDOMElement();
  });
});
