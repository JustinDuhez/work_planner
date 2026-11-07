import { createPool, setSessionTimeZone } from './create-db';

describe('createPool', () => {
  it('keeps the process alive when an idle database connection drops', async () => {
    const pool = createPool('postgres://unused:unused@127.0.0.1:1/unused');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(pool.listenerCount('error')).toBeGreaterThanOrEqual(1);
    expect(() => pool.emit('error', new Error('connection terminated'))).not.toThrow();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
    await pool.end();
  });
});

describe('setSessionTimeZone', () => {
  it('logs instead of crashing when the connection drops during the SET', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('connection terminated');

    setSessionTimeZone({ query: () => Promise.reject(failure) });
    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleError).toHaveBeenCalledWith('Could not set the session time zone', failure);
    consoleError.mockRestore();
  });
});
