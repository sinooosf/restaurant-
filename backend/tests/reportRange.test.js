import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, daysBetween, isDay, resolveRange, spanDays } from '../src/reportRange.js'

describe('report date ranges', () => {
  const today = '2026-10-23' // a Friday

  it('day maths never drifts (month ends, leap day, year end)', () => {
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
    assert.equal(addDays('2028-03-01', -1), '2028-02-29')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(spanDays('2026-10-01', '2026-10-31'), 31)
    assert.equal(spanDays('2026-10-05', '2026-10-05'), 1)
    assert.equal(daysBetween('2026-10-30', '2026-11-02').join(), '2026-10-30,2026-10-31,2026-11-01,2026-11-02')
  })

  it('rejects dates that do not exist', () => {
    assert.equal(isDay('2026-02-31'), false)
    assert.equal(isDay('2026-13-01'), false)
    assert.equal(isDay('2026-1-1'), false)
    assert.equal(isDay(20261001), false)
    assert.equal(isDay('2026-10-01'), true)
  })

  it('presets', () => {
    assert.deepEqual(resolveRange({ range: 'today' }, today), { from: today, to: today, prevFrom: '2026-10-22', prevTo: '2026-10-22' })
    assert.deepEqual(resolveRange({ range: 'week' }, today), { from: '2026-10-17', to: today, prevFrom: '2026-10-10', prevTo: '2026-10-16' })
    assert.deepEqual(resolveRange({ range: 'last30' }, today), { from: '2026-09-24', to: today, prevFrom: '2026-08-25', prevTo: '2026-09-23' })
  })

  it('this month is compared with the same days of last month', () => {
    assert.deepEqual(resolveRange({ range: 'month' }, today), { from: '2026-10-01', to: today, prevFrom: '2026-09-01', prevTo: '2026-09-23' })
    // 31 days into a 30-day previous month: capped at its last day
    assert.deepEqual(resolveRange({ range: 'month' }, '2026-10-31'), { from: '2026-10-01', to: '2026-10-31', prevFrom: '2026-09-01', prevTo: '2026-09-30' })
    // January looks back into December of the year before
    assert.deepEqual(resolveRange({ range: 'month' }, '2026-01-15'), { from: '2026-01-01', to: '2026-01-15', prevFrom: '2025-12-01', prevTo: '2025-12-15' })
  })

  it('last month is the whole previous month, compared with the one before', () => {
    assert.deepEqual(resolveRange({ range: 'lastmonth' }, today), { from: '2026-09-01', to: '2026-09-30', prevFrom: '2026-08-01', prevTo: '2026-08-31' })
    assert.deepEqual(resolveRange({ range: 'lastmonth' }, '2026-03-10'), { from: '2026-02-01', to: '2026-02-28', prevFrom: '2026-01-01', prevTo: '2026-01-31' })
    assert.deepEqual(resolveRange({ range: 'lastmonth' }, '2026-01-10'), { from: '2025-12-01', to: '2025-12-31', prevFrom: '2025-11-01', prevTo: '2025-11-30' })
  })

  it('custom: validated, cut at today, previous period of the same length', () => {
    assert.deepEqual(resolveRange({ range: 'custom', from: '2026-10-10', to: '2026-10-14' }, today), { from: '2026-10-10', to: '2026-10-14', prevFrom: '2026-10-05', prevTo: '2026-10-09' })
    assert.equal(resolveRange({ range: 'custom', from: '2026-10-10', to: '2099-01-01' }, today).to, today)
    assert.ok(resolveRange({ range: 'custom', from: '2026-10-14', to: '2026-10-10' }, today).error)
    assert.ok(resolveRange({ range: 'custom', from: '2024-01-01', to: '2026-10-10' }, today).error)
    assert.ok(resolveRange({ range: 'custom', from: '2099-01-01', to: '2099-01-05' }, today).error)
    assert.ok(resolveRange({ range: 'custom' }, today).error)
    assert.ok(resolveRange({ range: 'bogus' }, today).error)
  })
})
