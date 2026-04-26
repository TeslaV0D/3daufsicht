/** Kompaktes (?)-Icon mit Hover-/Fokus-Tooltip; Style über `.inspector-field-hint`. */
export default function InfoIcon({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <span
      className={['inspector-field-hint', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={title}
      data-tooltip={title}
      tabIndex={0}
    >
      ?
    </span>
  )
}
