import { resolveTranslatable, createEmptyBlock, type ExperienceStatus, type Translatable, type Language, type PageBlock } from '#/lib/experiences'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo, type ChangeEvent } from 'react'
import { BookingPageRenderer } from '#/components/BookingPageRenderer'
import { Button, SectionCard, SelectField, controlClass } from '#/components/dashboard/form-controls'
import { Trash2 } from 'lucide-react'
import { setTranslated } from '#/lib/utils'
import type { Asset } from '#/lib/pocketbase'
import MediaModel from '#/components/MediaModel'
import { createBlogPage, createEvent, type BlogPageBlock } from '#/lib/blog'

const MAX_SIZE = 5242880
const MAX_VIDEO_SIZE = 52428800

export const Route = createFileRoute('/_authed/dashboard/create-post')({
  component: RouteComponent,
})

type PostType = 'blog' | 'event'

type SkeletonPageData = {
  title: Translatable
  content: Record<string, any>
  start_date?: string
  end_date?: string
  type: PostType
  defaultLanguage: Language
  enabledLanguages: Language[]
  status: ExperienceStatus
}

const BLOCK_TYPES: PageBlock['type'][] = ['header', 'paragraph', "media"]

function useObjectUrl(file: File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setUrl(null); return }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url
}


function useBlocks() {
  const [entries, setEntries] = useState<{ id: string; block: PageBlock }[]>([])
  const addBlock = useCallback((type: PageBlock['type']) => {
    setEntries((prev) => [...prev, { id: crypto.randomUUID(), block: createEmptyBlock(type, prev.length) }])
  }, [])
  const updateBlock = useCallback((id: string, updated: PageBlock) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, block: updated } : e)))
  }, [])
  const deleteBlock = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])
  const blocks = useMemo(() => entries.map((e) => e.block), [entries])
  const serialize = useCallback((): BlogPageBlock[] => {
    return entries.map((e, i) => {
      // Remove any `id` that may exist on PageBlock and add index
      const { id, ...rest } = e.block as any;
      return { ...rest, index: i } as BlogPageBlock;
    });
  }, [entries]);
  return { entries, blocks, addBlock, updateBlock, deleteBlock, serialize }
}

function HeaderBlockEditor({ block, lang, onChange }: { block: Extract<PageBlock, { type: 'header' }>; lang: Language; onChange: (b: Extract<PageBlock, { type: 'header' }>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <SelectField label="Level" value={block.level} onChange={(e) => onChange({ ...block, level: parseInt(e.target.value, 10) as 1 | 2 | 3 })}>
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </SelectField>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Text</span>
        <input className={controlClass} value={resolveTranslatable(block.text, lang)} placeholder="Heading text…" onChange={(e) => onChange({ ...block, text: setTranslated(block.text, lang, e.target.value) })} />
      </label>
    </div>
  )
}

function ParagraphBlockEditor({ block, lang, onChange }: { block: Extract<PageBlock, { type: 'paragraph' }>; lang: Language; onChange: (b: Extract<PageBlock, { type: 'paragraph' }>) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Text</span>
      <textarea className={`${controlClass} min-h-20 resize-y`} value={resolveTranslatable(block.text, lang)} placeholder="Paragraph text…" onChange={(e) => onChange({ ...block, text: setTranslated(block.text, lang, e.target.value) })} />
    </label>
  )
}

function ImageBlockEditor({ block, lang, onChange }: { block: Extract<PageBlock, { type: 'image' }>; lang: Language; onChange: (b: Extract<PageBlock, { type: 'image' }>) => void }) {
  const previewUrl = useObjectUrl(block.file)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Image</span>
        <input type="file" accept="image/*" className={controlClass} onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          if (file.size > MAX_SIZE) { setError('Image exceeds 5MB.'); e.target.value = ''; return }
          setError(null)
          onChange({ ...block, file })
        }} />
        {error && <span className="mt-1 block text-xs text-[var(--destructive)]">{error}</span>}
        {previewUrl && !error && <img src={previewUrl} alt="preview" className="mt-1 rounded-sm max-h-36 object-cover w-full" />}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Alt text</span>
        <input className={controlClass} value={resolveTranslatable(block.alt, lang)} placeholder="Alt text…" onChange={(e) => onChange({ ...block, alt: setTranslated(block.alt, lang, e.target.value) })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Caption</span>
        <input className={controlClass} value={block.caption ? resolveTranslatable(block.caption, lang) : ''} placeholder="Caption (optional)…" onChange={(e) => onChange({ ...block, caption: setTranslated(block.caption ?? { default: '' }, lang, e.target.value) })} />
      </label>
    </div>
  )
}

type MediaBlockEditorAcceptedTypes = "image" | "video"

function MediaBlockEditor({ block, lang, onChange }: { block: Extract<PageBlock, { type: "media" }>, lang: Language, onChange: (b: Extract<PageBlock, { type: string }>) => void }) {
  const [mode, setMode] = useState<MediaBlockEditorAcceptedTypes>("image")
  const [open, setOpen] = useState(false)

  const toggleModel = () => setOpen(prev => !prev);

  const bindOnChange = (data: Asset & { src: string }) => {
    onChange({
      ...block,
      id: data.id,
      alt: data.alt,
      file: data.file,
      name: data.name,
      collectionId: data.collectionId,
      collectionName: data.collectionName,
      src: data.src,
      type: "media",
      assetType: mode
    })
  }

  return (
    <div className="flex flex-row gap-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)] capitalize">{mode}</span>
        <MediaModel open={open} toggleOpen={toggleModel} onClick={bindOnChange} accept={mode} />
        <Button onClick={toggleModel}>open</Button>
      </label>
      <label className="block capitalize">
        <SelectField label="mode" value={mode} onChange={(e) => setMode(e.target.value as MediaBlockEditorAcceptedTypes)} className="w-32">
          <option value="image">Image</option>
          <option value="video">Video</option>
        </SelectField>
      </label>
    </div>
  )
}

function VideoBlockEditor({ block, lang, onChange }: { block: Extract<PageBlock, { type: 'video' }>; lang: Language; onChange: (b: Extract<PageBlock, { type: 'video' }>) => void }) {
  const previewUrl = useObjectUrl(block.file)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Video</span>
        <input type="file" accept="video/*" className={controlClass} onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          if (file.size > MAX_VIDEO_SIZE) { setError('Video exceeds 50MB.'); e.target.value = ''; return }
          setError(null)
          onChange({ ...block, file })
        }} />
        {error && <span className="mt-1 block text-xs text-[var(--destructive)]">{error}</span>}
        {previewUrl && !error && <video src={previewUrl} controls className="mt-1 rounded-sm max-h-36 w-full" />}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Title</span>
        <input className={controlClass} value={block.title ? resolveTranslatable(block.title, lang) : ''} placeholder="Video title (optional)…" onChange={(e) => onChange({ ...block, title: setTranslated(block.title ?? { default: '' }, lang, e.target.value) })} />
      </label>
    </div>
  )
}

function BlockEditor({ block, lang, onChange, onDelete }: { block: PageBlock; lang: Language; onChange: (u: PageBlock) => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-[var(--line)] bg-[var(--surface-strong)] p-3.5">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-orange)]">{block.type}</span>
        <button type="button" onClick={onDelete} className="text-[var(--sea-ink-soft)] hover:text-[var(--destructive)]">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {block.type === 'header' && <HeaderBlockEditor block={block} lang={lang} onChange={onChange} />}
      {block.type === 'paragraph' && <ParagraphBlockEditor block={block} lang={lang} onChange={onChange} />}
      {block.type === "media" && <MediaBlockEditor block={block} lang={lang} onChange={onChange} />}
      {block.type === 'image' && <ImageBlockEditor block={block} lang={lang} onChange={onChange} />}
      {block.type === 'video' && <VideoBlockEditor block={block} lang={lang} onChange={onChange} />}
    </div>
  )
}

function RouteComponent() {
  const navigate = useNavigate()
  const [lang, setLang] = useState<Language>('en')
  const [status, setStatus] = useState<ExperienceStatus>('Published')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [postData, setPostData] = useState<SkeletonPageData>({
    title: { default: '' },
    content: {},
    type: 'blog',
    start_date: '',
    end_date: '',
    defaultLanguage: 'en',
    enabledLanguages: ['en'],
    status: 'Published',
  })

  const { entries, blocks, addBlock, updateBlock, deleteBlock, serialize } = useBlocks()

  const handleTypeChange = (type: PostType) => {
    setPostData(prev => ({
      ...prev,
      type,
      start_date: type === 'blog' ? '' : prev.start_date,
      end_date: type === 'blog' ? '' : prev.end_date,
    }))
  }

  const handleMetaChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const fieldLang: Language = (e.target.dataset.lang as Language) ?? 'en'
    if (name !== 'title') return
    setPostData((prev) => ({
      ...prev,
      [name]: setTranslated(prev[name] as Translatable, fieldLang, value),
    }))
  }, [])

  const getMetaValue = (key: 'title'): string => {
    const field = postData[key]
    if (!field) return ''
    return resolveTranslatable(field, lang)
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    if (!postData.title.default.trim()) {
      setSubmitError('Title is required.');
      return
    }

    setSubmitting(true)

    // Get blocks with index, and ensure no id field (which would conflict with BlogPageBlock)
    const blocksData = serialize() as BlogPageBlock[]; // type assertion

    if (postData.type === 'blog') {
      const result = await createBlogPage({
        title: postData.title,
        content: blocksData,
        status: status,
      })

      setSubmitting(false)
      if (!result.success) {
        setSubmitError(result.error ?? 'Something went wrong.')
      } else {
        navigate({ to: '/dashboard' })
      }
    } else {
      // Event
      if (!postData.start_date) {
        setSubmitError('Start date is required for events.')
        setSubmitting(false)
        return
      }
      if (!postData.end_date) {
        setSubmitError('End date is required for events.')
        setSubmitting(false)
        return
      }

      const result = await createEvent({
        title: postData.title,
        content: blocksData,
        status: status,
        startDate: new Date(postData.start_date),
        endDate: new Date(postData.end_date),
      })

      setSubmitting(false)
      if (!result.success) {
        setSubmitError(result.error ?? 'Something went wrong.')
      } else {
        navigate({ to: '/dashboard' })
      }
    }
  }

  return (
    <div className="flex h-full w-full bg-[var(--dash-canvas)]">
      {/* Preview */}
      <div className="flex-2 flex min-h-0 justify-center overflow-y-auto border-r border-[var(--line)] p-6">
        <div className="w-11/12 overflow-hidden rounded-sm border border-[var(--line)] shadow-lg shadow-black/10">
          <BookingPageRenderer page={{ blocks }} lang={lang} />
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-5 overflow-y-auto bg-[var(--surface-strong)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--brand-orange)]">Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--sea-ink)]">Create Post</h1>
          </div>
          <SelectField label="Language" value={lang} onChange={(e) => setLang(e.target.value as Language)} className="w-32 cursor-pointer">
            <option value="en">English</option>
            <option value="af">Afrikaans</option>
          </SelectField>
        </div>

        <SectionCard title="Post details">
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Post type</span>
              <SelectField
                label="Type"
                value={postData.type}
                onChange={(e) => handleTypeChange(e.target.value as PostType)}
              >
                <option value="blog">Blog</option>
                <option value="event">Event</option>
              </SelectField>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Title</span>
              <input name="title" data-lang={lang} className={controlClass} value={getMetaValue('title')} onChange={handleMetaChange} placeholder="Post title" />
            </label>

            {postData.type === 'event' && (
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">Start date</span>
                  <input
                    type="date"
                    className={controlClass}
                    value={postData.start_date || ''}
                    onChange={(e) => setPostData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">End date</span>
                  <input
                    type="date"
                    className={controlClass}
                    value={postData.end_date || ''}
                    onChange={(e) => setPostData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </label>
              </div>
            )}

            <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as ExperienceStatus)}>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </SelectField>
          </div>
        </SectionCard>

        <SectionCard title="Content blocks">
          <div className="flex flex-col gap-3">
            {entries.map(({ id, block }) => (
              <BlockEditor key={id} block={block} lang={lang} onChange={(u) => updateBlock(id, u)} onDelete={() => deleteBlock(id)} />
            ))}
            <div className="flex flex-wrap gap-2">
              {BLOCK_TYPES.map((type) => (
                <button key={type} type="button" onClick={() => addBlock(type)} className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink-soft)] transition-colors hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)]">
                  + {type}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {submitError && (
          <p className="rounded-sm bg-[color-mix(in_oklab,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-[var(--destructive)]">{submitError}</p>
        )}

        <Button variant="primary" onClick={handleSubmit} disabled={submitting} className="self-start">
          {submitting ? 'Creating…' : 'Create Post'}
        </Button>
      </div>
    </div>
  )
}
