/** Compact (? ) hint with hover/focus tooltip (space-saving inspector help). */
export default function InspectorHint({ text }: { text: string }) {
  return (
    <span
      className="inspector-field-hint"
      role="img"
      aria-label={text}
      data-tooltip={text}
      tabIndex={0}
    >
      ?
    </span>
  )
}
