import EventsBoard from '../components/EventsBoard'

export default function EventsPage() {
  return <EventsBoard title="Events, Workshops & Guest Lectures" kinds={['event', 'workshop', 'guest_lecture']} defaultKind="event" />
}
