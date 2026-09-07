import type {
  PageBlock,
  BookingPage,
  Language,
  HydratedPageBlock,
  HydratedBookingPage,
  HeaderBlock,
  ParagraphBlock,
  HydratedImageBlock,
  HydratedVideoBlock
} from '#/lib/experiences'
import { resolveTranslatable } from '#/lib/experiences'
import { buildImageUrl } from '#/lib/pocketbase';

// ============================================================
// EXISTING RENDERERS (Left exactly as they were)
// ============================================================

const HeaderRenderer = ({ block, lang }: { block: Extract<PageBlock, { type: 'header' }>; lang: Language }) => {
  const text = resolveTranslatable(block.text, lang)
  const cls = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-lg' }[block.level]
  const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3'
  return <Tag className={`display-title font-medium tracking-tight text-balance text-[var(--brand-navy)] ${cls}`}>{text}</Tag>
}

const ParagraphRenderer = ({ block, lang }: { block: Extract<PageBlock, { type: 'paragraph' }>; lang: Language }) => (
  <p className="text-[15px] leading-relaxed text-pretty text-[var(--brand-navy)]/75">
    {resolveTranslatable(block.text, lang)}
  </p>
)

const ImageRenderer = ({ block, lang }: { block: Extract<PageBlock, { type: 'image' }>; lang: Language }) => {
  const src = block.file ? URL.createObjectURL(block.file) : null

  return (
    <figure className="flex flex-col gap-2">
      {src
        ? <img src={src} alt={resolveTranslatable(block.alt, lang)} className="w-full mx-auto h-96 object-cover rounded-xl shadow-lg shadow-[var(--brand-navy)]/10" />
        : <div className="flex h-56 w-full items-center justify-center rounded-xl border border-dashed border-[var(--brand-navy)]/20 bg-[#f1ede6]">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-navy)]/40">No image uploaded</span>
        </div>
      }
      {block.caption && (
        <figcaption className="text-center text-xs italic text-[var(--brand-navy)]/50">
          {resolveTranslatable(block.caption, lang)}
        </figcaption>
      )}
    </figure>
  )
}

const VideoRenderer = ({ block, lang }: { block: Extract<PageBlock, { type: 'video' }>; lang: Language }) => {
  const src = block.file ? URL.createObjectURL(block.file) : null
  return (
    <figure className="flex flex-col gap-2">
      {src
        ? <video src={src} controls className="w-full rounded-xl shadow-lg shadow-[var(--brand-navy)]/10" />
        : <div className="flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-[var(--brand-navy)]/20 bg-[#f1ede6]">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-navy)]/40">No video uploaded</span>
        </div>
      }
      {block.title && (
        <figcaption className="text-center text-xs italic text-[var(--brand-navy)]/50">
          {resolveTranslatable(block.title, lang)}
        </figcaption>
      )}
    </figure>
  )
}

const MediaRenderer = ({ block, lang }: { block: Extract<PageBlock, { type: "media" }>, lang: Language }) => {
  return (
    <figure className="flex flex-col gap-2">
      {
        block.src ?
          block.assetType === "image" ? (
            <img src={block.src} alt={block.alt} className="w-full mx-auto h-96 object-cover rounded-xl shadow-lg shadow-[var(--brand-navy)]/10" />
          ) :
            block.assetType === "svg" ? (
              <img src={block.src} alt={block.alt} className="w-full mx-auto h-96 object-cover rounded-xl shadow-lg shadow-[var(--brand-navy)]/10" />
            ) : (
              <video src={block.src} controls className="w-full rounded-xl shadow-lg shadow-[var(--brand-navy)]/10" />
            )
          :
          (<div className="flex h-56 w-full items-center justify-center rounded-xl border border-dashed border-[var(--brand-navy)]/20 bg-[#f1ede6]">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-navy)]/40">No image uploaded</span>
          </div>
          )
      }
      {block.name && (
        <figcaption className="text-center text-xs italic text-[var(--brand-navy)]/50">
          {block.name}
        </figcaption>
      )}
    </figure>
  )
}

type BookingPageRendererProps = {
  page: Pick<BookingPage, 'blocks'>
  lang: Language
}

export const BookingPageRenderer = ({ page, lang }: BookingPageRendererProps) => (
  <div className="w-full h-full overflow-y-auto bg-white">
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
      {page.blocks.map((block) => {
        switch (block?.type) {
          case 'header':
            return <HeaderRenderer key={block.index} block={block} lang={lang} />
          case 'paragraph':
            return <ParagraphRenderer key={block.index} block={block} lang={lang} />
          case 'image':
            return <ImageRenderer key={block.index} block={block} lang={lang} />
          case 'video':
            return <VideoRenderer key={block.index} block={block} lang={lang} />
          case "media":
            return <MediaRenderer key={block.collectionId} block={block} lang={lang} />
          default:
            return <div key={(block as any).index}>Oops component not found</div>
        }
      })}
    </div>
  </div>
)

// ============================================================
// NEW HYDRATED RENDERERS (Prefixed to avoid collisions)
// ============================================================

type HydratedHeaderRendererProps = {
  block: HeaderBlock;
  lang: Language;
};

export const HydratedHeaderRenderer = ({ block, lang }: HydratedHeaderRendererProps) => {
  const text = resolveTranslatable(block.text, lang);
  const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;

  const classes = {
    1: "text-3xl font-bold tracking-tight text-gray-900 md:text-4xl",
    2: "text-2xl font-semibold tracking-tight text-gray-900",
    3: "text-xl font-medium tracking-tight text-gray-900",
  }[block.level];

  return <Tag className={classes}>{text}</Tag>;
};

type HydratedParagraphRendererProps = {
  block: ParagraphBlock;
  lang: Language;
};

export const HydratedParagraphRenderer = ({ block, lang }: HydratedParagraphRendererProps) => {
  const text = resolveTranslatable(block.text, lang);
  return <p className="text-base leading-7 text-gray-700">{text}</p>;
};

type HydratedImageRendererProps = {
  block: HydratedImageBlock;
  lang: Language;
};

export const HydratedImageRenderer = ({ block, lang }: HydratedImageRendererProps) => {
  const altText = resolveTranslatable(block.alt, lang);
  const captionText = block.caption ? resolveTranslatable(block.caption, lang) : undefined;

  return (
    <figure className="my-4 flex flex-col gap-2">
      <img
        src={block.url}
        alt={altText}
        className="rounded-lg object-cover w-full max-h-[450px] shadow-sm"
      />
      {captionText && (
        <figcaption className="text-center text-sm text-gray-500 italic">
          {captionText}
        </figcaption>
      )}
    </figure>
  );
};

type HydratedVideoRendererProps = {
  block: HydratedVideoBlock;
  lang: Language;
};

export const HydratedVideoRenderer = ({ block, lang }: HydratedVideoRendererProps) => {
  const titleText = block.title ? resolveTranslatable(block.title, lang) : undefined;

  return (
    <div className="my-4 flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg bg-black shadow-sm aspect-video">
        <video
          src={block.url}
          controls
          title={titleText}
          className="w-full h-full"
        />
      </div>
      {titleText && (
        <span className="text-sm font-medium text-gray-600">{titleText}</span>
      )}
    </div>
  );
};

type FlatPageRendererProps = {
  data: HydratedBookingPage;
  lang: Language;
};

export const FlatPageRenderer = ({ data, lang }: FlatPageRendererProps) => {
  return (
    <div className="w-full h-full overflow-y-auto bg-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
        {data.blocks.map((block: HydratedPageBlock) => {
          switch (block.type) {
            case "header":
              return <HydratedHeaderRenderer key={block.index} block={block} lang={lang} />;
            case "paragraph":
              return <HydratedParagraphRenderer key={block.index} block={block} lang={lang} />;
            case "image":
              return <HydratedImageRenderer key={block.index} block={block} lang={lang} />;
            case "video":
              return <HydratedVideoRenderer key={block.index} block={block} lang={lang} />;
            case "media":
              return <MediaRenderer key={block.index} block={block as any} lang={lang} />;
            default:
              return (
                <div key={(block as any).index} className="text-red-500 text-sm italic">
                  Component type missing or unhandled.
                </div>
              );
          }
        })}
      </div>
    </div>
  );
};
