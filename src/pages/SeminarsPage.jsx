import EventsBoard from '../components/EventsBoard'

export default function SeminarsPage() {
  return <EventsBoard title="Seminars" kinds={['seminar']} defaultKind="seminar" />
}
