import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getEvent } from '#/lib/blog'
import { resolveTranslatable, type Language, type PageBlock } from '#/lib/experiences'
import { TimelineHero } from '#/components/timeline/TimelineHero'
import { BookingPageRenderer } from '#/components/BookingPageRenderer'

export const Route = createFileRoute('/events/$eventId')({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: (search.lang as Language) ?? 'en',
  }),
  loaderDeps: ({ search: { lang } }) => ({ lang }),
  component: RouteComponent,
})

function RouteComponent() {
  const { lang } = Route.useLoaderDeps()
  const { eventId } = Route.useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const result = await getEvent(eventId)
      if (!result.success) throw new Error(result.error ?? 'Failed to load event')
      return result.value
    },
  })

  if (isLoading) {
    return (
      <main className="flex min-h-[70svh] items-center justify-center bg-[#f4efe7]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--brand-orange)] border-t-transparent" />
          <p className="mt-3 text-sm text-[var(--brand-navy)]/60">Loading event…</p>
        </div>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-[70svh] flex-col items-center justify-center bg-[#f4efe7] px-6 text-center">
        <h1 className="text-2xl font-medium text-[var(--brand-navy)]">Event not found</h1>
        <p className="mt-2 max-w-md text-sm text-[var(--brand-navy)]/60">
          The event you're looking for doesn't exist or has been removed.
        </p>
        <a
          href="/events"
          className="mt-6 inline-block bg-[var(--brand-orange)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[var(--brand-orange-deep)]"
        >
          Back to events
        </a>
      </main>
    )
  }

  const title = resolveTranslatable(data.title, lang)
  const startDate = data.startDate.toLocaleDateString(lang, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const endDate = data.endDate.toLocaleDateString(lang, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const dateDisplay = startDate === endDate ? startDate : `${startDate} – ${endDate}`

  return (
    <main className="bg-[#f4efe7]">
      <TimelineHero
        crumbLabel="Events"
        crumbHref="/events"
        eyebrow={`Event • ${dateDisplay}`}
        title={title}
        subtitle="Join us for this special experience"
      />

      <section className="mx-auto w-full max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr]">
          <article className="flex flex-col gap-8">
            {data.content?.length > 0 ? (
              <BookingPageRenderer page={{ blocks: data.content as PageBlock[] }} lang={lang} />
            ) : (
              <p className="text-sm text-[var(--brand-navy)]/50">No content yet.</p>
            )}
          </article>
        </div>
      </section>
    </main>
  )
}
