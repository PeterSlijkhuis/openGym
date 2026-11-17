// Import your own cycle from a Flo data export (JSON): pick the file, see what it holds, confirm.
// The file is read on this device; only the days (flow, symptoms, moods) are sent, to your own log.
// Plain English: ours, not upstream's.
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { parseFlo, planImport } from '../lib/cycle-import.js'
import { importDays } from './useCycle.js'
import { confirmSheet } from '../sheets.jsx'

const toast = m => useUI.getState().toast(m)

/** Opens the file picker, then the confirmation. `have` is the days already logged. */
export function importFromFlo(have) {
  const input = document.createElement('input')
  input.type = 'file'
  // No `accept`: Android greys out a .json that arrives as application/octet-stream (mail, Drive),
  // and parseFlo already explains a wrong file. Kept in the page while the picker is open, since a
  // detached input can lose its change event on mobile browsers.
  input.hidden = true
  document.body.append(input)
  input.oncancel = () => input.remove()
  input.onchange = async () => {
    input.remove()
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 20e6) return toast('That file is too large to be a Flo export.')
    const r = parseFlo(await file.text(), todayISO())
    if (r.error) return toast(r.error)
    const { added, kept } = planImport(have, r.days)
    if (!added) return toast('Everything in this file is already in your log.')
    confirmSheet({
      title: 'Import from Flo?',
      message: `Found ${r.periods} period${r.periods === 1 ? '' : 's'}${r.logged ? ` and ${r.logged} day${r.logged === 1 ? '' : 's'} with symptoms or moods` : ''}, from ${fmtDate(r.from, false, true)} to ${fmtDate(r.to, false, true)}. ${added} day${added === 1 ? '' : 's'} will be added or filled in${kept ? `; ${kept} already match your log` : ''}${r.skipped ? `. ${r.skipped} entr${r.skipped === 1 ? 'y' : 'ies'} could not be used and ${r.skipped === 1 ? 'was' : 'were'} skipped` : ''}. Flow you logged yourself stays as it is. Sleep, sport, weight and notes are not imported.`,
      confirmText: 'Import',
      onConfirm: () => importDays(r.days).then(x => toast(`Imported ${x.added} day${x.added === 1 ? '' : 's'}`), e => toast(e.message)),
    })
  }
  input.click()
}
