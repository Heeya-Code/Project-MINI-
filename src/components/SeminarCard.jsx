import EventCard from './EventCard'

// Seminars use the shared event card (it shows speaker + seat availability for seminars).
export default function SeminarCard(props) {
  return <EventCard {...props} event={props.seminar || props.event} />
}
