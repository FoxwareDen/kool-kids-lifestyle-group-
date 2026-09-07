import {
  fetchExperienceById,
  parseCategories,
  resolveTranslatable,
  type HydratedBookingPage,
  type Language,
} from '#/lib/experiences'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CalendarDays, Clock, Loader2, MapPin, Users } from 'lucide-react'
import { ExperiencesHero } from '#/components/experiences/ExperiencesHero'
import { BookingSlotModal } from '#/components/experiences/BookingSlotModal'
import { FlatPageRenderer } from '#/components/BookingPageRenderer'
import { fetchBookingsByScheduleId, fetchCalendarScheduleByExperiencesIds, type Booking, type BookingResponse, type TransformedCalendarSchedule } from '#/lib/booking'

export const Route = createFileRoute('/experiences/$id')({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: (search.lang as Language) ?? 'en',
  }),
  loaderDeps: ({ search: { lang } }) => ({ lang }),
  component: RouteComponent,
})

/**
 * Title-case a raw category string for display.
 * @param {string} category - The raw category label.
 * @returns {string} The display label.
 */
function categoryLabel(category: string): string {
  return category
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function RouteComponent() {
  const { lang } = Route.useLoaderDeps();
  const { id } = Route.useParams()
  const [bookingOpen, setBookingOpen] = useState(false)

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['experience', id],
    queryFn: async (): Promise<HydratedBookingPage | null> => {
      const result = await fetchExperienceById(id);
      if (!result.success || !result.value) return null
      return result.value
    },
    staleTime: 5 * 60 * 1000,
  })
  const [scheduleData, setScheduleData] = useState<TransformedCalendarSchedule[] | null>(null);
  const [existingBookings, setExistingBookings] = useState<BookingResponse[] | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleDataLoading, setScheduleDataLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setScheduleDataLoading(true);

        const result = await fetchCalendarScheduleByExperiencesIds(id);

        if (!result.success) {
          throw new Error("failed to fetch schedule");
        }

        if (!result.value) {
          throw new Error("No schedules found");
        }

        // @ts-ignore
        const bookings: BookingResponse[] = (
          await Promise.all(
            result.value.map((schedule) =>
              fetchBookingsByScheduleId(schedule.id)
            )
          )
        )
          .filter((booking) => booking.success && booking.value != null)
          .flatMap((booking) => booking.value);

        console.log("bookings//", bookings);

        setExistingBookings(bookings);

        setScheduleData(result.value);
      } catch (error) {
        console.error(error)
        setScheduleError("Failed to get schedule data")
      } finally {
        setScheduleDataLoading(false);
      }
    })()
  }, [id])

  if (isLoading) {
    return (
      <main className="flex min-h-[70svh] flex-col items-center justify-center gap-3 bg-[#f4efe7]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-orange)]" strokeWidth={1.5} />
        <p className="text-sm font-medium text-[var(--brand-navy)]/55">Loading experience…</p>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-[70svh] flex-col items-center justify-center gap-4 bg-[#f4efe7] px-6 text-center">
        <h1 className="display-title text-2xl font-medium text-[var(--brand-navy)]">
          Experience not found
        </h1>
        <p className="max-w-md text-sm text-[var(--brand-navy)]/60">
          We couldn&apos;t find the experience you were looking for. It may have been moved or is no
          longer available.
        </p>
        <a
          href="/experiences"
          className="inline-flex items-center gap-2 bg-[var(--brand-orange)] px-5 py-3 text-sm font-bold uppercase tracking-wide !text-white no-underline transition-colors hover:bg-[var(--brand-orange-deep)]"
        >
          Browse all experiences
        </a>
      </main>
    )
  }


  const title = resolveTranslatable(data.title, lang)
  const description = data.description ? resolveTranslatable(data.description, lang) : ''
  const tags = parseCategories(data.category).filter((c) => c.toLowerCase() !== 'featured')

  return (
    <main className="bg-[#f4efe7]">
      <ExperiencesHero
        eyebrow={tags[0] ? categoryLabel(tags[0]) : 'Experience'}
        title={title}
        subtitle={description ? '' : 'An unforgettable Karoo adventure awaits.'}
        image={data.coverImage}
        crumbs={[
          { label: 'Experiences', href: '/experiences' },
          { label: title },
        ]}
      />

      <section className="mx-auto w-full max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Main content */}
          <article className="flex flex-col gap-8">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/experiences?category=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-[var(--brand-navy)]/15 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] !text-[var(--brand-navy)] no-underline transition-colors hover:border-[var(--brand-orange)] hover:!text-[var(--brand-orange)]"
                  >
                    {categoryLabel(tag)}
                  </a>
                ))}
              </div>
            )}

            {description && (
              <p className="text-lg leading-relaxed text-pretty text-[var(--brand-navy)]/75">
                {description}
              </p>
            )}

            {data.blocks?.length > 0 && (
              <div className="border-t border-[var(--brand-navy)]/10 pt-8">
                <FlatPageRenderer lang={lang} data={data} />
              </div>
            )}
          </article>

          {/* Booking sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col gap-5 border border-[var(--brand-navy)]/10 bg-white p-6 shadow-lg shadow-[var(--brand-navy)]/5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                  Ready to go?
                </p>
                <h2 className="display-title mt-1 text-xl font-medium text-[var(--brand-navy)]">
                  Book this experience
                </h2>
              </div>

              <ul className="flex flex-col gap-3 text-sm text-[var(--brand-navy)]/70">
                <li className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-[var(--brand-orange)]" />
                  Choose any available date
                </li>
                <li className="flex flex-col items-start gap-3">
                  <span className='flex items-center gap-3'>
                    <Users className="h-4 w-4 text-[var(--brand-orange)]" />
                    Multiple unit options
                  </span>
                  <div className='pl-5 w-full'>
                    <span className='flex items-center gap-3 font-medium text-xs text-[var(--brand-navy)]/50'>Options:</span>
                    <ul className='pl-5 mt-1 list-disc flex flex-col gap-1'>
                      {scheduleDataLoading ? (
                        <li className="text-xs text-[var(--brand-navy)]/40 animate-pulse list-none">Loading options…</li>
                      ) : scheduleData && scheduleData[0]?.units ? (
                        scheduleData[0].units.map((unit) => (
                          <li key={unit.id} className="text-xs">{unit.label}</li>
                        ))
                      ) : (
                        <li className="text-xs text-[var(--brand-navy)]/40 list-none">No options available</li>
                      )}
                    </ul>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-[var(--brand-orange)]" />
                  Prieska, Northern Cape
                </li>
              </ul>

              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 bg-[var(--brand-orange)] px-5 py-3.5 text-sm font-bold uppercase tracking-wide !text-white shadow-lg shadow-[var(--brand-orange)]/20 transition-colors hover:bg-[var(--brand-orange-deep)]"
              >
                <CalendarDays className="h-4 w-4" />
                Book Now
              </button>

              <p className="text-center text-xs text-[var(--brand-navy)]/45">
                Live availability shown at checkout.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <BookingSlotModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        experienceTitle={title}
        calendarSchedule={scheduleData}
        existingBookings={existingBookings}
        loading={scheduleDataLoading}
        error={scheduleError}
      />
    </main>
  )
}
