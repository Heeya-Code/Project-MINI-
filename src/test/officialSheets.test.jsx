import { describe, it, expect } from 'vitest'
import { render, within } from '@testing-library/react'
import TimetableGrid from '../components/TimetableGrid'
import { OFFICIAL_TIMETABLES_2 as T } from '../../server/seed/official-data-2.js'

// The eight timetables rendered by the app's own sheet grid, straight from the transcribed data.
describe('the eight official sheets render as native timetables (not placeholders)', () => {
  for (const [id, t] of Object.entries(T)) {
    it(`${id}: every entry is on screen, under the right day, with its breaks and parallel batches`, () => {
      const { container } = render(<TimetableGrid entries={t.entries} legend={t.legend} sheet={{ notes: t.sheetNotes, room: t.room }} />)
      const days = [...container.querySelectorAll('section.ott-day')]
      expect(days.map(d => d.getAttribute('aria-label'))).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
      // every stored entry produces exactly one item in its own day column
      for (const sec of days) {
        const day = sec.getAttribute('aria-label')
        expect(sec.querySelectorAll('.ott-item').length, `${id} ${day}`).toBe(t.entries.filter(e => e.day === day).length)
      }
      expect(container.querySelectorAll('.ott-item').length).toBe(t.entries.length)
      // breaks are shown on the sheet, clearly marked
      const breaks = t.entries.filter(e => e.kind === 'break')
      expect(container.querySelectorAll('.ott-item.kind-break').length).toBe(breaks.length)
      expect(breaks.length).toBeGreaterThan(0)
      // parallel practical batches share ONE time block
      const batchChips = [...container.querySelectorAll('.ott-batch')].map(c => c.textContent)
      expect(batchChips.length).toBe(t.entries.filter(e => e.batch).length)
      expect(container.querySelectorAll('.ott-block.parallel').length).toBeGreaterThan(0)
      // faculty codes resolve to the printed names where the legend has them
      const first = t.entries.find(e => e.faculty && t.legend.faculty[e.faculty])
      expect(container.textContent).toContain(t.legend.faculty[first.faculty])
    })
  }

  it('EXTC/Chemistry sheets carry no division anywhere and the longest strings do not break the grid markup', () => {
    for (const id of ['SE-ETC-1', 'TE-ETC-1', 'BE-ETC-1', 'SE-CHEM', 'TE-CHEM', 'BE-CHEM']) {
      expect(T[id].division).toBe('')
      const { container, unmount } = render(<TimetableGrid entries={T[id].entries} legend={T[id].legend} sheet={{ room: T[id].room }} />)
      expect(container.textContent).not.toMatch(/Division/)
      unmount()
    }
    // a pathologically long subject/faculty still renders inside its card
    const long = [{ day: 'Monday', start: '09:00', end: '10:00', kind: 'lecture', subject: 'X'.repeat(200), faculty: 'Y'.repeat(120), room: 'Z'.repeat(40), batch: '', label: '', note: '' }]
    const { container } = render(<TimetableGrid entries={long} legend={{}} sheet={{}} />)
    expect(within(container).getByText('X'.repeat(200))).toBeInTheDocument()
  })
})
