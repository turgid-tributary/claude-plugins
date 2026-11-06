// Types for dicebear.js, the bundle scripts/vendor-dicebear.sh generates, written by hand from
// @dicebear/core's own (lib/types.d.ts): what the mod and its custom styles (hooks/styles/) use.

/** The seeded random-number generator a style's `create` draws every choice from. */
export interface Prng {
  seed: string
  next(): void
  /** True with `likelihood` percent chance (default 50). */
  bool(likelihood?: number): boolean
  /** A whole number from `min` to `max`, both included. */
  integer(min: number, max: number): number
  pick<T>(items: T[], fallback: T): T
  pick<T>(items: T[]): T | undefined
  shuffle<T>(items: T[]): T[]
  string(length: number, characters?: string): string
}

export interface StyleCreateProps {
  prng: Prng
  /** The options `createAvatar` was given, defaults filled in. */
  options: Readonly<Record<string, unknown>>
}

export interface StyleCreateResult {
  /** The `<svg>` element's attributes; `viewBox` is the coordinate space `body` draws in. */
  attributes: { viewBox: string; [attribute: string]: string }
  /** Everything inside the `<svg>` element. */
  body: string
}

export interface StyleMeta {
  title?: string
  source?: string
  creator?: string
  homepage?: string
  license?: { name: string; url: string }
}

/** A DiceBear style: `create` draws the avatar; `meta` names it in the SVG's metadata. */
export interface Style {
  meta?: StyleMeta
  schema?: unknown
  create: (props: StyleCreateProps) => StyleCreateResult
}

export type AvatarOptions = {
  seed?: string
  size?: number
  flip?: boolean
  /** Wrap the avatar in a mask the size of its viewBox (default true). */
  clip?: boolean
  [option: string]: unknown
}

export declare function createAvatar(style: Style, options?: AvatarOptions): { toString(): string }

/** Every style in @dicebear/collection, by its camelCase export name (`pixelArt`). */
export declare const styles: Readonly<Record<string, Style>>

/** `<core version>/<collection version>`, as bundled. */
export declare const version: string
