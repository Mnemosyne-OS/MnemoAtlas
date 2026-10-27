/**
 * The translated-names loader: a language whose file does not arrive falls
 * back to English and SAYS so, and the failure is never cached.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {useAnatomyNames} from './anatomyNames';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useAnatomyNames', () => {
  it('a file that comes back 404 leaves English names, untranslated, and tries again next time', async () => {
    fetchMock.mockResolvedValue({ok: false, status: 404});
    const first = renderHook(() => useAnatomyNames('zh'));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    // Untranslated, not « translated with nothing in it »: the quiz keeps its pool.
    expect(first.result.current).toMatchObject({translated: false, count: 0});
    first.unmount();

    const second = renderHook(() => useAnatomyNames('zh'));
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a file that arrives is cached: the next mount does not fetch again', async () => {
    fetchMock.mockResolvedValue({ok: true, status: 200, json: async () => ({FMA7088: 'coração'})});
    const first = renderHook(() => useAnatomyNames('pt'));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    expect(first.result.current).toMatchObject({translated: true, count: 1});
    first.unmount();
    renderHook(() => useAnatomyNames('pt'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('the request carries a signal, so a language switch or a hang can end it', async () => {
    fetchMock.mockResolvedValue({ok: false, status: 404});
    const {result} = renderHook(() => useAnatomyNames('ru'));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const init = fetchMock.mock.calls[0]?.[1] as {signal?: AbortSignal} | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
