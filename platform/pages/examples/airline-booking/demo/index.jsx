import { Fragment, useEffect, useReducer, useRef, useState } from 'react'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'
import {
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

/**
 * The ordered steps of the booking journey. The agent moves the customer
 * between these by calling the `goToStep` function (and the side effects of the
 * other booking functions).
 */
const STEPS = [
  { key: 'search', label: 'Search', icon: MagnifyingGlassIcon },
  { key: 'flights', label: 'Flights', icon: PaperAirplaneIcon },
  { key: 'passengers', label: 'Travellers', icon: UsersIcon },
  { key: 'seats', label: 'Seats', icon: Squares2X2Icon },
  { key: 'baggage', label: 'Baggage', icon: BriefcaseIcon },
  { key: 'extras', label: 'Extras', icon: SparklesIcon },
  { key: 'payment', label: 'Payment', icon: CreditCardIcon },
  { key: 'confirmation', label: 'Done', icon: CheckCircleIcon },
]

const CABINS = [
  { value: 'economy', label: 'Economy', mult: 1 },
  { value: 'premium', label: 'Premium Economy', mult: 1.8 },
  { value: 'business', label: 'Business', mult: 3.2 },
  { value: 'first', label: 'First', mult: 5 },
]

/**
 * The single, growing booking object that captures everything collected during
 * the journey. This is the "massive object" that is the final result.
 */
const INITIAL_BOOKING = {
  tripType: 'return',
  from: '',
  to: '',
  departDate: '',
  returnDate: '',
  passengerCount: 1,
  cabin: 'economy',
  flight: null,
  passengers: [],
  seats: {}, // passengerId -> seat code
  baggage: { cabin: 1, checked: 0 },
  extras: { meal: null, insurance: false, priorityBoarding: false },
  payment: null, // { cardholderName, last4, expiry }
  fare: null,
  reference: null,
}

// The lowest economy return fare per destination. Keying off the route keeps
// prices realistic (a long-haul to Tokyo costs more than a hop to Paris) and lets
// the carousel "from" teasers line up with the cheapest option shown here.
const ROUTE_FROM_FARE = [
  ['new york', 329],
  ['tokyo', 549],
  ['paris', 89],
  ['dubai', 399],
  ['rome', 109],
  ['bali', 629],
  ['singapore', 559],
  ['sydney', 699],
]

function routeFromFare(to) {
  const t = (to || '').toLowerCase()

  for (const [name, fare] of ROUTE_FROM_FARE) {
    if (t.includes(name)) {
      return fare
    }
  }

  return 299
}

/**
 * Build a small, deterministic set of flight options for a route and cabin. Each
 * option's price is the route's lowest fare times a per-flight markup and the
 * cabin multiplier; the cheapest option equals the route "from" fare.
 */
function generateFlights(from, to, cabin) {
  const mult = CABINS.find((c) => c.value === cabin)?.mult || 1
  const fromFare = routeFromFare(to)

  const base = [
    { code: 'SW', no: '118', dep: '07:25', arr: '10:55', dur: '3h 30m', stops: 0, markup: 1.32, airline: 'Skyway' }, // prettier-ignore
    { code: 'SW', no: '204', dep: '11:40', arr: '15:05', dur: '3h 25m', stops: 0, markup: 1.18, airline: 'Skyway' }, // prettier-ignore
    { code: 'AU', no: '882', dep: '14:15', arr: '18:30', dur: '4h 15m', stops: 1, markup: 1.0, airline: 'Aurora Air' }, // prettier-ignore
    { code: 'SW', no: '376', dep: '18:50', arr: '22:10', dur: '3h 20m', stops: 0, markup: 1.55, airline: 'Skyway' }, // prettier-ignore
  ]

  return base.map((f) => ({
    id: `${f.code}${f.no}`,
    airline: f.airline,
    flightNo: `${f.code}${f.no}`,
    from,
    to,
    departTime: f.dep,
    arriveTime: f.arr,
    duration: f.dur,
    stops: f.stops,
    cabin,
    price: Math.round(fromFare * f.markup * mult),
  }))
}

/**
 * Build a deterministic seat map so it does not reshuffle between renders.
 */
function generateSeatMap() {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  const rows = []

  for (let r = 1; r <= 20; r++) {
    const seats = letters.map((letter) => ({
      code: `${r}${letter}`,
      row: r,
      letter,
      legroom: r === 1 || r === 10 || r === 11,
      occupied: (r * 7 + letter.charCodeAt(0)) % 6 === 0,
    }))

    rows.push({ row: r, seats })
  }

  return rows
}

/**
 * Compute the fare breakdown from the current booking. Used both for the live
 * price summary and for the final confirmation.
 */
function computeFare(booking, seatMap) {
  const pax = booking.passengerCount || booking.passengers.length || 1

  const base = (booking.flight?.price || 0) * pax
  const taxes = Math.round(base * 0.18)
  const baggage = (booking.baggage?.checked || 0) * 40

  const meal = booking.extras?.meal ? 15 * pax : 0
  const insurance = booking.extras?.insurance ? 25 * pax : 0
  const priority = booking.extras?.priorityBoarding ? 8 * pax : 0

  const allSeats = seatMap.flatMap((row) => row.seats)

  const seatSurcharge = Object.values(booking.seats || {}).reduce(
    (sum, code) => {
      const seat = allSeats.find((s) => s.code === code)

      return sum + (seat?.legroom ? 18 : 0)
    },
    0
  )

  const extras = meal + insurance + priority
  const total = base + taxes + baggage + extras + seatSurcharge

  return {
    pax,
    base,
    taxes,
    baggage,
    meal,
    insurance,
    priority,
    seatSurcharge,
    extras,
    total,
  }
}

function cabinLabel(value) {
  return CABINS.find((c) => c.value === value)?.label || value
}

function reducer(state, action) {
  const { booking } = state

  switch (action.type) {
    case 'GO_TO': {
      return { ...state, step: action.step }
    }

    case 'SEARCH': {
      return {
        ...state,
        step: 'flights',
        flightOptions: action.flightOptions,
        booking: { ...booking, ...action.trip, flight: null },
      }
    }

    case 'SELECT_FLIGHT': {
      return {
        ...state,
        step: 'passengers',
        booking: { ...booking, flight: action.flight },
      }
    }

    case 'SET_PASSENGERS': {
      return {
        ...state,
        step: 'seats',
        booking: {
          ...booking,
          passengers: action.passengers,
          passengerCount: action.passengers.length || booking.passengerCount,
          seats: {},
        },
      }
    }

    case 'ASSIGN_SEAT': {
      return {
        ...state,
        booking: {
          ...booking,
          seats: { ...booking.seats, [action.passengerId]: action.seat },
        },
      }
    }

    case 'SET_BAGGAGE': {
      return {
        ...state,
        step: 'extras',
        booking: { ...booking, baggage: { ...booking.baggage, ...action.baggage } }, // prettier-ignore
      }
    }

    case 'SET_EXTRAS': {
      return {
        ...state,
        step: 'payment',
        booking: {
          ...booking,
          extras: { ...booking.extras, ...action.extras },
        },
      }
    }

    case 'SET_PAYMENT': {
      return { ...state, booking: { ...booking, payment: action.payment } }
    }

    case 'CONFIRM': {
      return {
        ...state,
        step: 'confirmation',
        booking: {
          ...booking,
          reference: action.reference,
          fare: action.fare,
        },
      }
    }

    case 'RESET': {
      return { ...state, step: 'search', flightOptions: [], booking: INITIAL_BOOKING } // prettier-ignore
    }

    default: {
      return state
    }
  }
}

/* ----------------------------- shared UI bits ----------------------------- */

// banner-aligned brand palette (sampled from banner.png)
//   deep #18559a · primary #2470bd · mid #2873c1 · light #6ba1e0 · navy #143f74

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#2470bd] focus:ring-1 focus:ring-[#2470bd] outline-none'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </span>
      {children}
    </label>
  )
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#eef4fb] px-3 py-1 text-xs font-medium text-[#1b5598]">
      {children}
    </span>
  )
}

function BrandHeader({ booking }) {
  const hasTrip = !!booking.from

  return (
    <div>
      <div
        className="h-32 w-full rounded-2xl bg-cover shadow-sm"
        style={{
          backgroundImage: "url('/examples/airline-booking/banner.png')",
          backgroundPosition: 'center 38%',
        }}
        role="img"
        aria-label="Skyway Airlines"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasTrip ? (
          <>
            <Chip>{`${booking.from} → ${booking.to}`}</Chip>
            {booking.departDate ? <Chip>{booking.departDate}</Chip> : null}
            <Chip>{cabinLabel(booking.cabin)}</Chip>
            <Chip>
              {`${booking.passengerCount} traveller${
                booking.passengerCount > 1 ? 's' : ''
              }`}
            </Chip>
          </>
        ) : (
          <span className="text-sm text-gray-500">
            Your journey starts with a message - just say hello to Sky.
          </span>
        )}
      </div>
    </div>
  )
}

function Stepper({ step }) {
  const idx = STEPS.findIndex((s) => s.key === step)

  const containerRef = useRef(null)
  const activeRef = useRef(null)

  // keep the current step centred without letting the user scroll the bar

  useEffect(() => {
    const container = containerRef.current
    const active = activeRef.current

    if (!container || !active) {
      return
    }

    const target =
      active.offsetLeft - container.clientWidth / 2 + active.offsetWidth / 2

    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [idx])

  return (
    <div
      ref={containerRef}
      className="relative mt-5 flex items-center gap-1 overflow-hidden pb-1"
    >
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const done = i < idx
        const active = i === idx

        return (
          <Fragment key={s.key}>
            <div
              ref={active ? activeRef : null}
              className={clsx(
                'flex items-center gap-2 px-2 py-1 rounded-full whitespace-nowrap text-xs font-medium',
                active
                  ? 'text-[#1b5598]'
                  : done
                    ? 'text-[#2470bd]'
                    : 'text-gray-400'
              )}
            >
              <span
                className={clsx(
                  'flex items-center justify-center w-7 h-7 rounded-full border',
                  active
                    ? 'border-[#2470bd] bg-[#2470bd] text-white'
                    : done
                      ? 'border-[#b3ccea] bg-[#d6e4f5] text-[#2470bd]'
                      : 'border-gray-200 bg-white'
                )}
              >
                {done ? (
                  <CheckIcon className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={clsx(
                  'h-px w-3 flex-shrink-0',
                  done ? 'bg-[#8cb4e0]' : 'bg-gray-200'
                )}
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}

function Card({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm',
        className
      )}
    />
  )
}

function ScreenHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      ) : null}
    </div>
  )
}

/**
 * A guidance callout reminding the customer that the booking is driven entirely
 * by chatting to Sky - the screens themselves have no inputs.
 */
function ChatHint({ children }) {
  return (
    <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#d6e4f5] bg-[#eef4fb] px-4 py-3 text-sm text-[#143f74]">
      <ChatBubbleLeftRightIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#3b82cf]" />
      <span>{children}</span>
    </div>
  )
}

function FareRow({ label, value }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span>£{value}</span>
    </div>
  )
}

function OrderSummary({ booking, seatMap }) {
  const fare = computeFare(booking, seatMap)

  return (
    <Card className="!p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Price summary
      </h3>
      <div className="space-y-2 text-sm">
        <FareRow label={`Fare × ${fare.pax}`} value={fare.base} />
        <FareRow label="Taxes & fees" value={fare.taxes} />
        {fare.baggage ? (
          <FareRow label="Checked baggage" value={fare.baggage} />
        ) : null}
        {fare.seatSurcharge ? (
          <FareRow label="Seat selection" value={fare.seatSurcharge} />
        ) : null}
        {fare.meal ? <FareRow label="Meals" value={fare.meal} /> : null}
        {fare.insurance ? (
          <FareRow label="Travel insurance" value={fare.insurance} />
        ) : null}
        {fare.priority ? (
          <FareRow label="Priority boarding" value={fare.priority} />
        ) : null}
        <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span>£{fare.total}</span>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------- screens ---------------------------------- */
// Every screen is display-only. The customer never types here - they talk to
// Sky, and Sky updates these screens by calling the registered functions.

function SearchScreen() {
  const destinations = [
    'New York',
    'Tokyo',
    'Paris',
    'Dubai',
    'Sydney',
    'Rome',
    'Singapore',
    'Reykjavík',
    'Cape Town',
    'Bali',
  ]

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6ba1e0] via-[#2470bd] to-[#002250] px-6 py-14 text-center text-white shadow-lg">
        <span className="cloud cloud-1" />
        <span className="cloud cloud-2" />
        <span className="cloud cloud-3" />
        <div className="relative">
          <PaperAirplaneIcon className="plane mx-auto w-16 h-16 drop-shadow-md" />
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight drop-shadow-sm">
            Where to next?
          </h2>
          <p className="mt-3 text-white/85 max-w-md mx-auto">
            Tell Sky where you dream of going and watch your journey take shape.
            No forms, no buttons - just a conversation.
          </p>
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee flex w-max gap-10 whitespace-nowrap px-6 text-sm font-medium text-gray-500">
          {[...destinations, ...destinations].map((d, i) => (
            <span key={i} className="flex items-center gap-2">
              <PaperAirplaneIcon className="w-3.5 h-3.5 text-[#6ba1e0]" />
              {d}
            </span>
          ))}
        </div>
      </div>

      <ChatHint>
        {`Try saying: "I'd like a return flight from London to New York next Friday for 2 people in business class."`}
      </ChatHint>

      <style jsx>{`
        .plane {
          transform: rotate(-45deg);
          animation: float 4s ease-in-out infinite;
        }

        @keyframes float {
          0%,
          100% {
            transform: rotate(-45deg) translateY(0);
          }
          50% {
            transform: rotate(-45deg) translateY(-10px);
          }
        }

        .marquee {
          animation: marquee 26s linear infinite;
        }

        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        .cloud {
          position: absolute;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 9999px;
          filter: blur(10px);
          pointer-events: none;
        }

        .cloud-1 {
          width: 130px;
          height: 42px;
          top: 24px;
          left: -60px;
          animation: drift 22s linear infinite;
        }

        .cloud-2 {
          width: 90px;
          height: 30px;
          top: 90px;
          left: -60px;
          animation: drift 30s linear infinite;
          animation-delay: -8s;
        }

        .cloud-3 {
          width: 170px;
          height: 54px;
          bottom: 16px;
          left: -80px;
          animation: drift 38s linear infinite;
          animation-delay: -4s;
        }

        @keyframes drift {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(520px);
          }
        }
      `}</style>
    </div>
  )
}

function FlightsScreen({ booking, flightOptions }) {
  return (
    <div>
      <ScreenHeader
        title={`${booking.from} → ${booking.to}`}
        subtitle={`${booking.departDate || ''} · ${cabinLabel(
          booking.cabin
        )} · ${booking.passengerCount} passenger${
          booking.passengerCount > 1 ? 's' : ''
        }`}
      />
      <div className="space-y-3">
        {flightOptions.map((f) => {
          const selected = booking.flight?.id === f.id

          return (
            <Card
              key={f.id}
              className={clsx(
                '!p-4 flex items-center gap-4 transition-shadow',
                selected && 'ring-2 ring-[#3b82cf] bg-[#eef4fb]/40'
              )}
            >
              <div className="flex flex-col items-center justify-center w-14 text-[#2470bd]">
                <PaperAirplaneIcon className="w-6 h-6 -rotate-45" />
                <span className="text-[10px] font-semibold mt-1">
                  {f.flightNo}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 text-gray-900 font-semibold">
                  <span>{f.departTime}</span>
                  <span className="flex-1 border-t border-dashed border-gray-300" />
                  <span>{f.arriveTime}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {f.duration}
                  </span>
                  <span>
                    {f.stops === 0
                      ? 'Direct'
                      : `${f.stops} stop${f.stops > 1 ? 's' : ''}`}
                  </span>
                  <span>{f.airline}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  £{f.price}
                </div>
                {selected ? (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-[#2470bd]">
                    <CheckCircleIcon className="w-4 h-4" />
                    Selected
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">{f.flightNo}</span>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      <ChatHint>
        {`Tell Sky which flight you'd like - for example "I'll take SW118" or "the cheapest direct one".`}
      </ChatHint>
    </div>
  )
}

function PassengersScreen({ booking }) {
  const count = booking.passengerCount || 1

  const slots = booking.passengers.length
    ? booking.passengers
    : Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}` }))

  return (
    <div>
      <ScreenHeader
        title="Who's flying?"
        subtitle="Share each traveller's details with Sky."
      />
      <div className="space-y-3">
        {slots.map((p, i) => {
          const filled = !!p.firstName

          return (
            <Card key={p.id || i} className="!p-4 flex items-center gap-3">
              <div
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold',
                  filled
                    ? 'bg-[#d6e4f5] text-[#1b5598]'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {filled
                  ? `${p.firstName[0]}${p.lastName?.[0] || ''}`.toUpperCase()
                  : i + 1}
              </div>
              <div className="flex-1">
                {filled ? (
                  <>
                    <div className="font-medium text-gray-900">
                      {p.title} {p.firstName} {p.lastName}
                    </div>
                    {p.dob ? (
                      <div className="text-xs text-gray-500">Born {p.dob}</div>
                    ) : null}
                  </>
                ) : (
                  <span className="text-sm text-gray-400">
                    Passenger {i + 1} · awaiting details…
                  </span>
                )}
              </div>
              {filled ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : null}
            </Card>
          )
        })}
      </div>
      <ChatHint>
        Tell Sky the full name and date of birth for each traveller.
      </ChatHint>
    </div>
  )
}

function SeatsScreen({ booking, seatMap }) {
  const next = booking.passengers.find((p) => !booking.seats[p.id])

  const ownerByCode = {}

  booking.passengers.forEach((p) => {
    if (booking.seats[p.id]) {
      ownerByCode[booking.seats[p.id]] = p
    }
  })

  return (
    <div>
      <ScreenHeader
        title="Choose your seats"
        subtitle={
          next
            ? `Sky is waiting for ${next.firstName} ${next.lastName}'s seat`
            : 'Everyone has a seat - ready to continue.'
        }
      />
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-white border border-gray-300" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-amber-50 border border-amber-300" />
          Extra legroom (+£18)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-gray-200" />
          Taken
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-[#2470bd]" />
          Yours
        </span>
      </div>
      <Card className="!p-4 max-h-[20rem] overflow-auto">
        <div className="flex flex-col items-center gap-1.5">
          {seatMap.map((row) => (
            <div key={row.row} className="flex items-center gap-1.5">
              <span className="w-5 text-[10px] text-gray-400 text-right">
                {row.row}
              </span>
              {row.seats.map((seat, idx) => {
                const owner = ownerByCode[seat.code]

                return (
                  <Fragment key={seat.code}>
                    {idx === 3 ? <span className="w-3" /> : null}
                    <div
                      className={clsx(
                        'w-7 h-7 rounded-md text-[10px] font-semibold border flex items-center justify-center',
                        owner
                          ? 'bg-[#2470bd] border-[#1b5598] text-white'
                          : seat.occupied
                            ? 'bg-gray-200 border-gray-200 text-gray-300'
                            : seat.legroom
                              ? 'bg-amber-50 border-amber-300 text-amber-600'
                              : 'bg-white border-gray-300 text-gray-500'
                      )}
                    >
                      {owner
                        ? `${owner.firstName[0]}${owner.lastName?.[0] || ''}`.toUpperCase()
                        : seat.letter}
                    </div>
                  </Fragment>
                )
              })}
            </div>
          ))}
        </div>
      </Card>
      {booking.passengers.length ? (
        <div className="mt-4 space-y-1.5">
          {booking.passengers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-600">
                {p.firstName} {p.lastName}
              </span>
              <span className="font-semibold text-gray-900">
                {booking.seats[p.id] || '-'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <ChatHint>
        {next
          ? `Tell Sky the seat you'd like, e.g. "12C" or "a window seat near the front".`
          : `Everyone's seated - tell Sky you're ready to continue.`}
      </ChatHint>
    </div>
  )
}

function BaggageScreen({ booking }) {
  const options = [0, 1, 2, 3]

  return (
    <div>
      <ScreenHeader
        title="Add checked baggage"
        subtitle="One cabin bag is included for free. Checked bags are £40 each."
      />
      <div className="grid grid-cols-2 gap-3">
        {options.map((n) => {
          const selected = booking.baggage.checked === n

          return (
            <div
              key={n}
              className={clsx(
                'rounded-2xl border p-5',
                selected
                  ? 'border-[#2470bd] bg-[#eef4fb] ring-2 ring-[#3b82cf]/30'
                  : 'border-gray-200 bg-white'
              )}
            >
              <BriefcaseIcon className="w-6 h-6 text-[#2470bd]" />
              <div className="mt-2 font-semibold text-gray-900">
                {n === 0
                  ? 'No checked bags'
                  : `${n} checked bag${n > 1 ? 's' : ''}`}
              </div>
              <div className="text-sm text-gray-500">
                {n === 0 ? 'Cabin bag only' : `£${n * 40}`}
              </div>
            </div>
          )
        })}
      </div>
      <ChatHint>Tell Sky how many checked bags you need.</ChatHint>
    </div>
  )
}

function ExtraRow({ label, hint, active, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 mb-3">
      <div>
        <div className="font-semibold text-gray-900">{label}</div>
        <div className="text-sm text-gray-500">{hint}</div>
      </div>
      {active ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
          <CheckCircleIcon className="w-5 h-5" />
          {value || 'Added'}
        </span>
      ) : (
        <span className="text-sm text-gray-300">Not added</span>
      )}
    </div>
  )
}

function ExtrasScreen({ booking }) {
  const { meal, insurance, priorityBoarding } = booking.extras

  return (
    <div>
      <ScreenHeader
        title="Make it yours"
        subtitle="Optional extras to upgrade your journey."
      />
      <ExtraRow
        label="In-flight meal"
        hint="A freshly prepared meal · £15 pp"
        active={!!meal}
        value={meal}
      />
      <ExtraRow
        label="Travel insurance"
        hint="Cancellation & medical cover · £25 pp"
        active={insurance}
      />
      <ExtraRow
        label="Priority boarding"
        hint="Be among the first on board · £8 pp"
        active={priorityBoarding}
      />
      <ChatHint>
        Ask Sky to add a meal, travel insurance or priority boarding - or to
        skip them.
      </ChatHint>
    </div>
  )
}

// Payment is the one exception to the "no inputs" rule - a card number can't
// safely be typed into chat, so it is captured in this secure on-screen form.
// On submit it notifies the agent, which then confirms the booking.
function PaymentScreen({ booking, seatMap, onSubmit }) {
  const fare = computeFare(booking, seatMap)
  const paid = !!booking.payment

  const [card, setCard] = useState({
    name: booking.payment?.cardholderName || '',
    number: '',
    expiry: booking.payment?.expiry || '',
    cvc: '',
  })

  const set = (key) => (e) => setCard((c) => ({ ...c, [key]: e.target.value }))

  const digits = card.number.replace(/\D/g, '')
  const last4 = booking.payment?.last4 || digits.slice(-4)

  const complete =
    card.name.trim() &&
    digits.length >= 12 &&
    card.expiry.trim() &&
    card.cvc.trim().length >= 3

  return (
    <div>
      <ScreenHeader
        title="Payment"
        subtitle="The one step you complete on screen - enter your card securely below."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/60">
                Skyway Pay
              </span>
              <CreditCardIcon className="w-6 h-6 text-white/70" />
            </div>
            <div className="mt-8 text-lg font-mono tracking-[0.2em]">
              {last4 ? `•••• •••• •••• ${last4}` : '•••• •••• •••• ••••'}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/40">
                  Cardholder
                </div>
                <div className="text-sm">{card.name || '-'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-white/40">
                  Expires
                </div>
                <div className="text-sm">{card.expiry || '-'}</div>
              </div>
            </div>
          </div>

          <Card className="!p-5 mt-4">
            <div className="space-y-4">
              <Field label="Cardholder name">
                <input
                  className={inputClass}
                  value={card.name}
                  onChange={set('name')}
                  placeholder="JOHN SMITH"
                  disabled={paid}
                />
              </Field>
              <Field label="Card number">
                <input
                  className={inputClass}
                  value={card.number}
                  onChange={set('number')}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  disabled={paid}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry">
                  <input
                    className={inputClass}
                    value={card.expiry}
                    onChange={set('expiry')}
                    placeholder="MM/YY"
                    disabled={paid}
                  />
                </Field>
                <Field label="CVC">
                  <input
                    className={inputClass}
                    value={card.cvc}
                    onChange={set('cvc')}
                    placeholder="123"
                    inputMode="numeric"
                    disabled={paid}
                  />
                </Field>
              </div>
            </div>
            <button
              type="button"
              disabled={!complete || paid}
              onClick={() => onSubmit(card)}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1b5598] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#143f74] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CreditCardIcon className="w-4 h-4" />
              {paid ? 'Payment complete' : `Pay £${fare.total}`}
            </button>
          </Card>

          <ChatHint>
            {paid
              ? `Thanks! Sky is confirming your booking…`
              : `Fill in your card and tap Pay - Sky will confirm your booking the moment payment goes through.`}
          </ChatHint>
        </div>
        <OrderSummary booking={booking} seatMap={seatMap} />
      </div>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="font-medium text-gray-900 truncate">{value || '-'}</div>
    </div>
  )
}

function ConfirmationScreen({ booking }) {
  return (
    <div>
      <Card className="text-center">
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <CheckCircleIcon className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          You&apos;re all booked!
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          A confirmation has been sent. Have a wonderful trip.
        </p>
        <div className="mt-4 inline-flex flex-col items-center rounded-xl bg-[#eef4fb] border border-[#d6e4f5] px-6 py-3">
          <span className="text-xs text-[#1b5598]">Booking reference</span>
          <span className="text-2xl font-bold tracking-widest text-[#143f74]">
            {booking.reference}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left text-sm">
          <Detail label="Route" value={`${booking.from} → ${booking.to}`} />
          <Detail label="Flight" value={booking.flight?.flightNo} />
          <Detail label="Depart" value={booking.departDate} />
          <Detail
            label="Travellers"
            value={booking.passengers
              .map((p) => `${p.firstName} ${p.lastName}`)
              .join(', ')}
          />
          <Detail
            label="Seats"
            value={Object.values(booking.seats).join(', ') || '-'}
          />
          <Detail label="Total paid" value={`£${booking.fare?.total}`} />
        </div>
      </Card>

      <Card className="!p-4 mt-4">
        <div className="text-xs font-semibold text-gray-500 mb-2">
          Captured booking object
        </div>
        <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
          {JSON.stringify(booking, null, 2)}
        </pre>
      </Card>

      <ChatHint>
        Want to go again? Just tell Sky you&apos;d like to book another trip.
      </ChatHint>
    </div>
  )
}

/**
 * The example demonstrates how an AI agent can orchestrate a complete, multi-step
 * airline booking journey. The screens on the left are display-only and driven by
 * the chat agent, which records every choice into a single growing booking object
 * and decides which screen is rendered by calling client-side functions. The one
 * exception is the payment form, which is completed on screen and then notifies
 * the agent so it can confirm the booking.
 */
export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    step: 'search',
    booking: INITIAL_BOOKING,
    flightOptions: [],
    seatMap: generateSeatMap(),
  }))

  const widget = useWidgetInstance('chatbotkit-widget', {
    waitForReady: true,
  })

  // payment is captured on screen; record it locally then let the agent know so
  // it can confirm the booking (the only place the UI talks back to the agent)

  function handlePaymentSubmit(card) {
    const last4 = card.number.replace(/\D/g, '').slice(-4)

    dispatch({
      type: 'SET_PAYMENT',
      payment: {
        cardholderName: card.name,
        last4,
        expiry: card.expiry,
      },
    })

    widget?.sendMessage({
      message: `I've entered my card in the secure form (card ending ${last4}) and completed payment. Please confirm my booking.`,
      respond: true,
    })
  }

  useEffect(() => {
    if (!widget) {
      return
    }

    const { booking, seatMap } = state

    // The functions the AI agent uses to drive the booking app. The customer
    // never touches the screens directly - the agent collects everything in
    // conversation and reflects it here by calling these functions.

    widget.functions = {
      goToStep: {
        description:
          'Show a specific screen of the booking app. Use this to navigate the customer through the journey.',
        parameters: {
          type: 'object',
          properties: {
            step: {
              type: 'string',
              enum: STEPS.map((s) => s.key),
              description: 'The screen to display',
            },
          },
          required: ['step'],
        },
        handler: async ({ step }) => {
          dispatch({ type: 'GO_TO', step })

          return { step }
        },
      },

      searchFlights: {
        description:
          'Record the trip details and search for available flights. Shows the flights screen.',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Origin city or airport' },
            to: { type: 'string', description: 'Destination city or airport' },
            departDate: { type: 'string', description: 'Departure date (YYYY-MM-DD)' }, // prettier-ignore
            returnDate: { type: 'string', description: 'Return date (YYYY-MM-DD), if a return trip' }, // prettier-ignore
            tripType: { type: 'string', enum: ['return', 'oneway'] },
            passengers: { type: 'number', description: 'Number of passengers' },
            cabin: {
              type: 'string',
              enum: CABINS.map((c) => c.value),
              description: 'Cabin class',
            },
          },
          required: ['from', 'to'],
        },
        handler: async ({
          from,
          to,
          departDate = '',
          returnDate = '',
          tripType = 'return',
          passengers = 1,
          cabin = 'economy',
        }) => {
          const flightOptions = generateFlights(from, to, cabin)

          dispatch({
            type: 'SEARCH',
            trip: {
              from,
              to,
              departDate,
              returnDate,
              tripType,
              passengerCount: passengers,
              cabin,
            },
            flightOptions,
          })

          return { step: 'flights', options: flightOptions }
        },
      },

      selectFlight: {
        description:
          'Select one of the flights returned by searchFlights. Shows the passengers screen.',
        parameters: {
          type: 'object',
          properties: {
            flightId: {
              type: 'string',
              description: 'The id of the flight to select (e.g. SW118)',
            },
          },
          required: ['flightId'],
        },
        handler: async ({ flightId }) => {
          const flight = state.flightOptions.find((f) => f.id === flightId)

          if (!flight) {
            return { error: `Flight ${flightId} not found` }
          }

          dispatch({ type: 'SELECT_FLIGHT', flight })

          return { step: 'passengers', flight }
        },
      },

      setPassengers: {
        description:
          'Record the traveller details for every passenger. Shows the seats screen.',
        parameters: {
          type: 'object',
          properties: {
            passengers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  dateOfBirth: { type: 'string', description: 'YYYY-MM-DD' },
                },
                required: ['firstName', 'lastName'],
              },
            },
          },
          required: ['passengers'],
        },
        handler: async ({ passengers = [] }) => {
          const list = passengers.map((p, i) => ({
            id: `p${i + 1}`,
            title: p.title || 'Mr',
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            dob: p.dateOfBirth || p.dob || '',
          }))

          dispatch({ type: 'SET_PASSENGERS', passengers: list })

          return { step: 'seats', passengers: list }
        },
      },

      assignSeat: {
        description:
          'Assign a seat to a passenger. Pass the passenger name (or leave blank for the next unseated passenger).',
        parameters: {
          type: 'object',
          properties: {
            seat: { type: 'string', description: 'Seat code, e.g. 12C' },
            passenger: {
              type: 'string',
              description: 'The passenger name or id the seat is for',
            },
          },
          required: ['seat'],
        },
        handler: async ({ seat, passenger }) => {
          const code = String(seat).toUpperCase().replace(/\s/g, '')

          const seatInfo = seatMap
            .flatMap((row) => row.seats)
            .find((s) => s.code === code)

          if (!seatInfo) {
            return { error: `Seat ${code} not found` }
          }

          if (seatInfo.occupied) {
            return { error: `Seat ${code} is already taken` }
          }

          const match =
            booking.passengers.find(
              (p) =>
                passenger &&
                (p.id === passenger ||
                  `${p.firstName} ${p.lastName}`
                    .toLowerCase()
                    .includes(String(passenger).toLowerCase()) ||
                  p.firstName.toLowerCase() === String(passenger).toLowerCase())
            ) || booking.passengers.find((p) => !booking.seats[p.id])

          if (!match) {
            return { error: 'Every passenger already has a seat' }
          }

          dispatch({ type: 'ASSIGN_SEAT', passengerId: match.id, seat: code })

          const remaining = booking.passengers.filter(
            (p) => !booking.seats[p.id] && p.id !== match.id
          ).length

          return {
            assigned: {
              passenger: `${match.firstName} ${match.lastName}`,
              seat: code,
            },
            allAssigned: remaining === 0,
          }
        },
      },

      setBaggage: {
        description:
          'Record how many checked bags the customer wants. Shows the extras screen.',
        parameters: {
          type: 'object',
          properties: {
            checkedBags: {
              type: 'number',
              description: 'Number of checked bags (£40 each)',
            },
          },
          required: ['checkedBags'],
        },
        handler: async ({ checkedBags = 0 }) => {
          dispatch({ type: 'SET_BAGGAGE', baggage: { checked: checkedBags } })

          return { step: 'extras', checkedBags }
        },
      },

      setExtras: {
        description:
          'Record optional extras. Shows the payment screen afterwards.',
        parameters: {
          type: 'object',
          properties: {
            meal: {
              type: 'string',
              description: 'Meal choice, or empty for none',
            },
            insurance: { type: 'boolean' },
            priorityBoarding: { type: 'boolean' },
          },
        },
        handler: async ({ meal, insurance, priorityBoarding }) => {
          const extras = {
            meal: meal && meal.toLowerCase() !== 'none' ? meal : null,
            insurance: !!insurance,
            priorityBoarding: !!priorityBoarding,
          }

          dispatch({ type: 'SET_EXTRAS', extras })

          return { step: 'payment', extras }
        },
      },

      confirmBooking: {
        description:
          'Finalise the booking. Computes the fare, generates a booking reference and shows the confirmation screen. Returns the complete booking object.',
        parameters: { type: 'object', properties: {} },
        handler: async () => {
          const fare = computeFare(booking, seatMap)

          const reference =
            'SW' + Math.random().toString(36).slice(2, 8).toUpperCase()

          dispatch({ type: 'CONFIRM', reference, fare })

          return { reference, fare, booking: { ...booking, reference, fare } }
        },
      },

      startOver: {
        description:
          'Clear the current booking and return to the start so the customer can book a brand new trip.',
        parameters: { type: 'object', properties: {} },
        handler: async () => {
          dispatch({ type: 'RESET' })

          return { step: 'search' }
        },
      },

      getBooking: {
        description:
          'Get the current booking object and which screen is showing. Use this to recall what has been captured so far.',
        parameters: { type: 'object', properties: {} },
        handler: async () => ({ step: state.step, booking }),
      },
    }
  }, [widget, state])

  const { step, booking, flightOptions, seatMap } = state

  let screen = null

  switch (step) {
    case 'search':
      screen = <SearchScreen />

      break
    case 'flights':
      screen = <FlightsScreen booking={booking} flightOptions={flightOptions} />

      break
    case 'passengers':
      screen = <PassengersScreen booking={booking} />

      break
    case 'seats':
      screen = <SeatsScreen booking={booking} seatMap={seatMap} />

      break
    case 'baggage':
      screen = <BaggageScreen booking={booking} />

      break
    case 'extras':
      screen = <ExtrasScreen booking={booking} />

      break
    case 'payment':
      screen = (
        <PaymentScreen
          booking={booking}
          seatMap={seatMap}
          onSubmit={handlePaymentSubmit}
        />
      )

      break
    case 'confirmation':
      screen = <ConfirmationScreen booking={booking} />

      break
    default:
      screen = null
  }

  return (
    <SideBySidePage className="bg-gray-100">
      <div className="w-full h-full overflow-auto bg-gradient-to-b from-[#eef4fb] to-white rounded-xl">
        <div className="max-w-2xl mx-auto p-6">
          <BrandHeader booking={booking} />
          <Stepper step={step} />
          <div className="mt-6">{screen}</div>
        </div>
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg bg-white">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/airline-booking/frame"
        />
        <div
          className={clsx('absolute inset-0 flex items-center justify-center', {
            hidden: !!widget,
          })}
        >
          <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
        </div>
      </div>
    </SideBySidePage>
  )
}

// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Airline Booking"
      description="This demo shows how an AI agent can orchestrate a complete, multi-step airline booking journey - from flight search to seat selection, baggage, extras and payment. The screens are display-only; the only way to book is by talking to the agent."
      slug="airline-booking"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/airline-booking/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
