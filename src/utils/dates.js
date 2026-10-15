// Date/time helpers. Dates are plain ISO strings ("2026-10-13") and times are
// "HH:MM" strings, so they compare and sort correctly as text and never
// suffer from timezone shifts.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const pad = n => String(n).padStart(2, '0')

export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayISO = () => toISO(new Date())
export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const weekdayOf = iso => DAY_NAMES[parseISO(iso).getDay()]
export const isWorkingDay = iso => WEEKDAYS.includes(weekdayOf(iso))
export function nextWorkingDay(iso) {
  let d = iso
  while (!isWorkingDay(d)) d = addDays(d, 1)
  return d
}
export function startOfWeek(iso) {
  const d = parseISO(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back to Monday
  return toISO(d)
}
export const weekDates = iso => WEEKDAYS.map((_, i) => addDays(startOfWeek(iso), i))

export const formatDate = iso =>
  parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const formatDay = iso =>
  parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const toHHMM = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}
export const formatRange = (s, e) => `${formatTime(s)} – ${formatTime(e)}`
export const nowHHMM = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
