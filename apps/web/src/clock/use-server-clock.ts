import { useEffect, useState } from 'react';

const TICK_INTERVAL_IN_MILLISECONDS = 1000;

/**
 * Now, as the server sees it: the offset measured on the last answer corrects a wrong computer
 * clock, so the live counter matches what the server will record.
 */
export function useServerClock(serverNow: string | undefined): Date {
  const [offsetInMilliseconds, setOffsetInMilliseconds] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (serverNow !== undefined)
      setOffsetInMilliseconds(new Date(serverNow).getTime() - Date.now());
  }, [serverNow]);

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), TICK_INTERVAL_IN_MILLISECONDS);
    return () => clearInterval(timer);
  }, []);

  return new Date(Date.now() + offsetInMilliseconds);
}
