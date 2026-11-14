// Import your own cycle from a Flo data export (JSON): pick the file, see what it holds, confirm.
// The file is read on this device; only the list of period days is sent, to your own log.
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
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 20e6) return toast('That file is too large to be a Flo export.')
    const r = parseFlo(await file.text(), todayISO())
    if (r.error) return toast(r.error)
    const { added, kept } = planImport(have, r.days)
    if (!added) return toast('Everything in this file is already in your log.')
    confirmSheet({
      title: 'Import from Flo?',
      message: `Found ${r.periods} period${r.periods === 1 ? '' : 's'} from ${fmtDate(r.from, false, true)} to ${fmtDate(r.to, false, true)}. ${added} new day${added === 1 ? '' : 's'} will be added${kept ? `; ${kept} you already logged stay as they are` : ''}${r.skipped ? `. ${r.skipped} entr${r.skipped === 1 ? 'y' : 'ies'} could not be used and ${r.skipped === 1 ? 'was' : 'were'} skipped` : ''}. Only period days are imported, not symptoms or moods.`,
      confirmText: 'Import',
      onConfirm: () => importDays(r.days).then(x => toast(`Imported ${x.added} period day${x.added === 1 ? '' : 's'}`), e => toast(e.message)),
    })
  }
  input.click()
}
