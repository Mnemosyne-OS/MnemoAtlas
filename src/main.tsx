import { createRoot } from 'react-dom/client';
import { onHostConfig } from '@mnemosyne_os/cartridge-sdk';
import Home from './atlas/page';
import './atlas/globals.css';
import { applyInitialTheme } from './atlas/theme';

// Inherit the shell's theme and design tokens. Harmless outside the shell:
// with no host broadcasting, nothing is applied and the viewer keeps its own
// look — which is exactly what `pnpm dev` in a plain tab should show.
onHostConfig();
// The broadcasts above fire on changes only; the opening theme is in the URL.
applyInitialTheme();

createRoot(document.getElementById('root')!).render(<Home />);
