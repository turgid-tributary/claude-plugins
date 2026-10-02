import type { Register, EngineInterface } from 'claude-code'

const REFRESH_MS = 5 * 60 * 1000
export const PREFIX = "You're a slacker, McFly:"
const QUERY = 'is:pr is:open review-requested:@me archived:false'

export async function refresh($: EngineInterface): Promise<void> {
  try {
    const { exitCode, stdout } = await $.process.run(
      ['gh', 'api', '-X', 'GET', 'search/issues', '-f', `q=${QUERY}`, '-f', 'per_page=1', '--jq', '.total_count'],
      { timeoutMs: 15_000 },
    )
    const count = Number.parseInt(stdout.trim(), 10)
    if (exitCode !== 0 || Number.isNaN(count)) {
      $.ui.status(`${PREFIX} reviews: ?`)
      return
    }
    $.ui.status(`${PREFIX} ${count} review${count === 1 ? '' : 's'}`)
  } catch {
    $.ui.status(`${PREFIX} reviews: ?`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refresh($)
    $.clock.every(REFRESH_MS, () => void refresh($))
    return started
  })
}
