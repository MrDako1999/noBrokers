// Pure functions that expand an owner's weekly `AvailabilityRule`s into
// concrete time slots for a query window, subtract `AvailabilityException`
// blocks, then subtract any "busy" viewings. Kept free of I/O so it can be
// unit-tested without the database, and so the /slots endpoint stays thin.
//
// Timezone handling is done with `Intl.DateTimeFormat` — no external deps.
// Correct for any IANA zone including those with DST transitions.

const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function partsInZone(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(date)
  const out = {}
  for (const p of parts) out[p.type] = p.value
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: out.hour === '24' ? 0 : Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAY_MAP[out.weekday],
  }
}

// Milliseconds to add to a UTC instant to get the wall-clock in `tz`.
function zoneOffsetMs(utcMs, tz) {
  const p = partsInZone(new Date(utcMs), tz)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - utcMs
}

// Convert a wall-clock (year/month/day/hour/minute) in `tz` to a UTC Date.
// Uses a two-step correction so spring-forward / fall-back boundaries land
// on the right instant (second pass catches the DST case).
function zonedTimeToUtc(year, month, day, hour, minute, tz) {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const offset1 = zoneOffsetMs(wall, tz)
  let utc = wall - offset1
  const offset2 = zoneOffsetMs(utc, tz)
  if (offset2 !== offset1) utc = wall - offset2
  return new Date(utc)
}

// Next zoned midnight after `d` (same zone). Used when advancing day-by-day.
function addDays(d, days) {
  return new Date(d.getTime() + days * 86400000)
}

// --- Rule expansion ---------------------------------------------------------

// Generate all candidate slots implied by an owner's rules within
// [from, to]. Does NOT subtract exceptions or viewings; that's layered on
// top. Output slots are plain objects so they serialize cleanly to JSON.
function expandRules(rules, from, to) {
  if (!rules.length) return []
  const slots = []

  // We walk day-by-day in each rule's timezone. Rules can have different
  // timezones (unlikely in practice) so we scope the iteration per rule.
  for (const rule of rules) {
    if (rule.active === false) continue
    if (rule.effectiveFrom && new Date(rule.effectiveFrom) > to) continue
    if (rule.effectiveTo && new Date(rule.effectiveTo) < from) continue

    const tz = rule.timezone || 'Asia/Kuala_Lumpur'
    // Start from the zoned-date of `from` and walk forward in 24h jumps.
    // 24h jumps are DST-safe because we re-resolve the wall-clock each day.
    let cursor = from
    // Cap the outer loop to prevent pathological input ranges.
    const maxDays = Math.ceil((to - from) / 86400000) + 2
    for (let i = 0; i < maxDays; i++) {
      const zp = partsInZone(cursor, tz)
      if (zp.weekday === rule.weekday) {
        const step = (rule.slotLengthMin || 30) + (rule.bufferMin || 0)
        for (
          let minute = rule.startMinute;
          minute + rule.slotLengthMin <= rule.endMinute;
          minute += step
        ) {
          const startUtc = zonedTimeToUtc(
            zp.year, zp.month, zp.day,
            Math.floor(minute / 60), minute % 60,
            tz,
          )
          const endUtc = new Date(startUtc.getTime() + rule.slotLengthMin * 60000)
          if (endUtc <= from) continue
          if (startUtc >= to) break

          // Rule's effective window might clip the slot at the edges.
          if (rule.effectiveFrom && startUtc < new Date(rule.effectiveFrom)) continue
          if (rule.effectiveTo && endUtc > new Date(rule.effectiveTo)) continue

          slots.push({
            startAt: startUtc,
            endAt: endUtc,
            timezone: tz,
            scopeKind: rule.scope?.kind || 'all',
            scopeListing: rule.scope?.listing || null,
          })
        }
      }
      cursor = addDays(cursor, 1)
      if (cursor > to) break
    }
  }

  // Dedup: multiple rules can produce the same slot (e.g. per-listing + global).
  const seen = new Set()
  const unique = []
  for (const s of slots.sort((a, b) => a.startAt - b.startAt)) {
    const key = `${s.startAt.getTime()}-${s.endAt.getTime()}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(s)
    }
  }
  return unique
}

// --- Exceptions -------------------------------------------------------------

// Remove slots that fall inside any `block` exception, and inject slots
// implied by any `open` exception. Open exceptions are emitted as a single
// slot spanning their whole window — the UI can chop it if needed; for v1
// we treat an "open exception" as one bookable block.
function applyExceptions(slots, exceptions, { slotLengthMin = 30 } = {}) {
  const blocks = []
  const opens = []
  for (const ex of exceptions || []) {
    const s = new Date(ex.startAt)
    const e = new Date(ex.endAt)
    if (ex.kind === 'block') blocks.push({ s, e })
    else if (ex.kind === 'open') opens.push({ s, e })
  }

  const kept = slots.filter((slot) => {
    return !blocks.some((b) => slot.startAt < b.e && slot.endAt > b.s)
  })

  for (const o of opens) {
    // Chop an open window into slot-sized pieces so the UI can surface them.
    let cursor = o.s.getTime()
    while (cursor + slotLengthMin * 60000 <= o.e.getTime()) {
      kept.push({
        startAt: new Date(cursor),
        endAt: new Date(cursor + slotLengthMin * 60000),
        scopeKind: 'all',
        scopeListing: null,
        fromException: true,
      })
      cursor += slotLengthMin * 60000
    }
  }

  return kept.sort((a, b) => a.startAt - b.startAt)
}

// --- Busy subtraction -------------------------------------------------------

// Drop any candidate slot that overlaps with an existing viewing that's
// still "holding" time (requested, counter_proposed, or accepted). Declined
// and cancelled viewings never block time.
function subtractViewings(slots, viewings) {
  if (!viewings?.length) return slots
  const busy = viewings
    .filter((v) => ['requested', 'counter_proposed', 'accepted'].includes(v.status))
    .map((v) => ({ s: new Date(v.startAt), e: new Date(v.endAt) }))
  if (!busy.length) return slots
  return slots.filter(
    (slot) => !busy.some((b) => slot.startAt < b.e && slot.endAt > b.s),
  )
}

module.exports = {
  expandRules,
  applyExceptions,
  subtractViewings,
  zonedTimeToUtc,
  zoneOffsetMs,
  partsInZone,
}
