/** Mehrere Farbwähler: ESC schließt zuerst den obersten (zuletzt geöffneten). */

type Entry = { id: number; close: () => void }

const stack: Entry[] = []
let nextId = 0

export function registerColorPickerEscape(close: () => void): () => void {
  const id = nextId++
  stack.push({ id, close })
  return () => {
    const i = stack.findIndex((e) => e.id === id)
    if (i >= 0) stack.splice(i, 1)
  }
}

export function dismissTopColorPickerEscape(): boolean {
  const top = stack.pop()
  if (!top) return false
  top.close()
  return true
}
