import InfoIcon from './InfoIcon'

/** @deprecated Bevorzugt `InfoIcon` mit `title` und Text aus `fieldDescriptions`. */
export default function InspectorHint({ text }: { text: string }) {
  return <InfoIcon title={text} />
}
