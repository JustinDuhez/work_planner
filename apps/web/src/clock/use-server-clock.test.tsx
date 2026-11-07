import { act, renderHook } from '@testing-library/react';
import { useServerClock } from './use-server-clock';

const ONE_HOUR_IN_MILLISECONDS = 3_600_000;

describe('useServerClock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("follows the server's clock when the computer clock is behind", () => {
    const serverNow = new Date(Date.now() + ONE_HOUR_IN_MILLISECONDS).toISOString();

    const { result } = renderHook(() => useServerClock(serverNow));

    expect(result.current.getTime() - Date.now()).toBeCloseTo(ONE_HOUR_IN_MILLISECONDS, -3);
  });

  it('uses the computer clock until the server answers', () => {
    const { result } = renderHook(() => useServerClock(undefined));

    expect(result.current.getTime()).toBe(Date.now());
  });

  it('renders again every second', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount += 1;
      return useServerClock(undefined);
    });
    const before = renderCount;

    for (let second = 0; second < 3; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    expect(renderCount).toBe(before + 3);
  });
});
