import { describe, it, expect, vi, afterEach } from 'vitest';
import { createId } from '../id';
import { copyText } from '../copy';

describe('createId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'uuid-from-crypto'),
    });

    expect(createId()).toBe('uuid-from-crypto');
  });

  it('uses crypto.getRandomValues when randomUUID is unavailable', () => {
    const values = new Uint8Array(16);
    let index = 0;

    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i += 1) {
          array[i] = values[i] + index + i;
        }
        index += 1;
        return array;
      }),
    });

    const first = createId();
    const second = createId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]+$/i);
    expect(second).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]+$/i);
    expect(first).not.toBe(second);
  });

  it('falls back to Math.random when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);

    const first = createId();
    const second = createId();

    expect(first).toMatch(/^id-[0-9a-z]+-[0-9a-z]+$/i);
    expect(second).toMatch(/^id-[0-9a-z]+-[0-9a-z]+$/i);
    expect(first).not.toBe(second);
  });
});

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('falls back to document.execCommand when navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    await expect(copyText('hello world')).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
