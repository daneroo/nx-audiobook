import { formatElapsed } from './time';

describe('formatElapsed', () => {
  it('should format a zero duration', () => {
    // this might be brittle as formatElapsed references the current time (+new Date())
    const startMs = +new Date();
    expect(formatElapsed(startMs)).toEqual('0.000s');
  });
});
