import { copy } from '../copy';

/** The main landmark: the skip link and the phone menu both move focus there. */
export const MAIN_ID = 'contenu';

/** One list for the desktop links and the phone menu (a bottom tab bar could reuse it, E8b-D3). */
export const NAV_ITEMS = [
  { to: '/', label: copy.nav.clock, isEnd: true },
  { to: '/calendrier', label: copy.nav.calendar },
  { to: '/planning', label: copy.nav.planning },
  { to: '/annuaire', label: copy.nav.directory },
  { to: '/equipes', label: copy.nav.teams },
  { to: '/demandes', label: copy.nav.leave },
] as const;
