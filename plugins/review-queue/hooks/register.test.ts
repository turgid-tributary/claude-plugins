import type { On } from 'claude-code'
import { test, expect, mock } from 'claude-code/testing'
import { PREFIX } from './register'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

function setup(on: On, outputs: string[]) {
  const statuses: (string | undefined)[] = []
  const calls: string[][] = []
  on('process.run', ($, e) => {
    calls.push([...e.argv])
    const stdout = outputs.shift() ?? '0\n'
    return { value: { exitCode: stdout === 'FAIL' ? 1 : 0, stdout: stdout === 'FAIL' ? '' : stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.status', ($, e) => { statuses.push(e.text); return { value: undefined } })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return { statuses, calls, clock: mock.clock(on) }
}

test('shows the review count at start and refreshes every five minutes', async ($, on) => {
  const { statuses, calls, clock } = setup(on, ['9\n', '1\n'])
  await $.session.start(START)
  await clock.advance(0)
  expect(statuses.at(-1)).toBe(`${PREFIX} 9 reviews`)
  expect(calls[0]).toContain('search/issues')
  await clock.advance(5 * 60 * 1000)
  expect(statuses.at(-1)).toBe(`${PREFIX} 1 review`)
})

test('shows a question mark when gh fails', async ($, on) => {
  const { statuses, clock } = setup(on, ['FAIL'])
  await $.session.start(START)
  await clock.advance(0)
  expect(statuses.at(-1)).toBe(`${PREFIX} reviews: ?`)
})
