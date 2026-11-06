// A custom style: a round face whose colour, eyes, cheeks and mouth the seed picks.
//
// `create` is handed a prng seeded by the project root and returns an SVG body. Every choice comes
// from the prng, so a repo always gets the same face. Keep the main features on wide ranges (a hue
// of 0 to 359, not four colours): with few choices, different repos end up looking alike.

import type { Style } from '../vendor/dicebear.js'

export const meta: Style['meta'] = { title: 'Blob', creator: 'Joe' }

const MOUTHS = [
  'M35 66 Q50 80 65 66', // smile
  'M38 68 L62 68', // flat
  'M35 72 Q50 60 65 72', // frown
  'M40 66 Q50 74 60 66 Z', // open
]

export const create: Style['create'] = ({ prng }) => {
  const hue = prng.integer(0, 359)
  const eyeY = prng.integer(36, 46)
  const eyeR = prng.integer(4, 8)
  const mouth = prng.pick(MOUTHS, 'M38 68 L62 68')
  const cheeks = prng.bool(40)
    ? `<circle cx="28" cy="60" r="6" fill="hsl(${hue} 80% 60%)"/>` +
      `<circle cx="72" cy="60" r="6" fill="hsl(${hue} 80% 60%)"/>`
    : ''

  return {
    attributes: { viewBox: '0 0 100 100' },
    body:
      `<circle cx="50" cy="52" r="40" fill="hsl(${hue} 65% 75%)"/>${cheeks}` +
      `<circle cx="36" cy="${eyeY}" r="${eyeR}" fill="#1f1d2e"/>` +
      `<circle cx="64" cy="${eyeY}" r="${eyeR}" fill="#1f1d2e"/>` +
      `<path d="${mouth}" stroke="#1f1d2e" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  }
}
