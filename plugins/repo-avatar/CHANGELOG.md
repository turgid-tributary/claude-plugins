# Changelog

## 1.0.0 — 2026-11-04

- First release: an avatar above the prompt, seeded by the project root. You can pick any of the 31
  DiceBear 9.4.3 styles in `/config`. Avatars are mirrored to face left, except `initials`, whose
  letters would read backwards.
- The default style is `orc`: a bold cartoon peon or grunt. The seed picks the head, the expression,
  tusks, hair, mustache and beard, more than 20 hats, eyewear (monocles included), war paint, scars,
  earrings, clothing, neckwear and props.
- Custom styles: drop a `.ts` file exporting `create` into `hooks/styles/`, then run
  `scripts/sync-styles.sh` to add it to the `/config` picker. Ships with `orc` and `blob`.
