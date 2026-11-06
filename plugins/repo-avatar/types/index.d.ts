export type Avatar = {
  /** The project root the avatar is seeded by, absolute. */
  seed: string
  /** The root's last path segment, drawn beside the avatar. */
  name: string
  /** The DiceBear style that drew it, kebab case (`pixel-art`). */
  style: string
  /** The avatar as an SVG document, for surfaces that draw `Svg`. */
  svg: string
  /** The avatar as a PNG, base64, for the terminal; absent when no converter ran. */
  png?: string
}

declare module 'claude-code' {
  interface PluginState {
    'repo-avatar': { avatar: Shaped<Avatar | null> }
  }
}
