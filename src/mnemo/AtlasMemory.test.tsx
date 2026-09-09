/**
 * Two properties, both chosen because a green suite would otherwise hide them.
 *
 * The first is the house rule every cartridge is judged on: with nothing on the
 * other side of the bridge — which is what a denied permission, a shell that
 * has not answered, and `pnpm dev` in a plain tab all look like — the panel
 * must NAME the situation. A blank div passes typecheck, passes lint, renders
 * fine, and tells the reader the feature is broken.
 *
 * The second is the one specific to a body. An answer is about the structure it
 * was asked about, and about no other. If the liver's answer can still be on
 * screen under the heart's title, this cartridge fabricates anatomical facts —
 * silently, plausibly, and in the surface people would trust most.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MnemoCartridgeSDK } from '@mnemosyne_os/cartridge-sdk';
import { AtlasMemory } from './AtlasMemory';

const HEART = { id: 'FMA7088', name: 'heart' };
const LIVER = { id: 'FMA7197', name: 'liver' };

// fireEvent, not a raw dispatchEvent: testing-library wraps it in act(), and
// without that every state update this click causes is logged as an act(...)
// warning. Warnings in a green suite are how a real one gets scrolled past.
const click = (el: HTMLElement) => fireEvent.click(el);

describe('AtlasMemory with no host answering', () => {
  it('names the missing shell instead of going blank', async () => {
    // Spied, not silenced: the cartridge is SUPPOSED to log this. A catch that
    // says nothing is the failure this project cares about most.
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<AtlasMemory concept={HEART} />);
    click(screen.getByRole('button', { name: /Ask what I know/ }));

    // jsdom has no parent frame, so the SDK rejects with its own words.
    expect(await screen.findByText(/open outside Mnemosyne/)).toBeInTheDocument();
    // And it says the 3D still works — the reader must not think the whole
    // cartridge is dead because one panel could not reach a host.
    expect(document.body.textContent).toContain('works exactly the same');
    expect(warned).toHaveBeenCalled();
    warned.mockRestore();
  });
});

describe('AtlasMemory when memory answers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tells "no notes yet" apart from "this is broken"', async () => {
    vi.spyOn(MnemoCartridgeSDK.prototype, 'query').mockResolvedValue({
      success: true,
      text: 'NOTHING IN MEMORY',
    });

    render(<AtlasMemory concept={HEART} />);
    click(screen.getByRole('button', { name: /Ask what I know/ }));

    expect(await screen.findByText(/holds nothing about the heart yet/)).toBeInTheDocument();
    // An empty memory is not an error, so no alert is raised and the sentence
    // says what to do next rather than what went wrong.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('never leaves one structure’s answer under another structure’s name', async () => {
    vi.spyOn(MnemoCartridgeSDK.prototype, 'query').mockResolvedValue({
      success: true,
      text: 'Your lecture notes describe the four chambers.',
    });

    const view = render(<AtlasMemory concept={HEART} />);
    click(screen.getByRole('button', { name: /Ask what I know/ }));
    await screen.findByText(/four chambers/);

    // The human clicks a different structure. The previous answer is now a
    // claim about the wrong organ and must be gone on the very next render.
    view.rerender(<AtlasMemory concept={LIVER} />);

    await waitFor(() => expect(screen.queryByText(/four chambers/)).toBeNull());
    expect(screen.getByRole('button', { name: /Ask what I know/ })).toBeInTheDocument();
  });

  it('drops a reply that lands after the human moved on', async () => {
    let land: (value: { success: boolean; text: string }) => void = () => {};
    vi.spyOn(MnemoCartridgeSDK.prototype, 'query').mockReturnValue(
      new Promise((resolve) => {
        land = resolve;
      }),
    );

    const view = render(<AtlasMemory concept={HEART} />);
    click(screen.getByRole('button', { name: /Ask what I know/ }));
    await screen.findByText(/Reading your memory/);

    // Selection changes while the request is still in flight. postMessage
    // cannot be cancelled, so the guard has to be on the ANSWER.
    view.rerender(<AtlasMemory concept={LIVER} />);
    land({ success: true, text: 'Your lecture notes describe the four chambers.' });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Ask what I know/ })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/four chambers/)).toBeNull();
  });
});
