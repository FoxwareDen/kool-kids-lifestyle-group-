import { createResult, pb, Result, uploadAsset, type Asset } from "./pocketbase";
import type { PageBlock, Translatable } from "./experiences";

// ============================================================
// STATUS
// ============================================================

export type PostStatus = "Published" | "Draft";

// ============================================================
// BLOCK TYPES – reuse PageBlock, add index
// ============================================================

//export type BlogPageBlock = Omit<PageBlock, "id"> & { index: number };
export type BlogPageBlock = PageBlock & { index: number };
export type EventBlock = PageBlock & { index: number };

// ============================================================
// BLOG PAGE
// ============================================================

export type BlogPage = {
  id: string;
  title: Translatable;
  content: BlogPageBlock[];
  status: PostStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type HydratedBlogPage = {
  id: string;
  title: Translatable;
  content: BlogPageBlock[];
  status: PostStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateBlogPageInput = Omit<BlogPage, "id" | "createdAt" | "updatedAt">;
export type UpdateBlogPageInput = Omit<BlogPage, "id" | "createdAt" | "updatedAt">;

// ============================================================
// EVENT
// ============================================================

export type Event = {
  id: string;
  title: Translatable;
  content: EventBlock[];
  status: PostStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type HydratedEvent = {
  id: string;
  title: Translatable;
  content: EventBlock[];
  status: PostStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateEventInput = Omit<Event, "id" | "createdAt" | "updatedAt">;
export type UpdateEventInput = Omit<Event, "id" | "createdAt" | "updatedAt">;

// ============================================================
// CRUD FUNCTIONS
// ============================================================

export async function createBlogPage(
  input: CreateBlogPageInput
): Promise<Result<HydratedBlogPage, string>> {
  try {
    const processedContent = await processBlocks(input.content);

    const result = await pb.collection("Posts").create({
      title: JSON.stringify(input.title),
      content: JSON.stringify(processedContent),
      type: "blog",
      status: input.status,
    });

    return createResult<HydratedBlogPage, string>({
      id: result.id,
      title: input.title,
      content: processedContent,
      status: input.status,
      createdAt: new Date(result.created),
      updatedAt: new Date(result.updated),
    }, null);
  } catch (error) {
    return createResult<HydratedBlogPage, string>(null, `${error}`);
  }
}

export async function updateBlogPage(
  id: string,
  input: UpdateBlogPageInput
): Promise<Result<HydratedBlogPage, string>> {
  try {
    const processedContent = await processBlocks(input.content);

    const result = await pb.collection("Posts").update(id, {
      title: JSON.stringify(input.title),
      content: JSON.stringify(processedContent),
      type: "blog",
      status: input.status,
    });

    return createResult<HydratedBlogPage, string>({
      id: result.id,
      title: input.title,
      content: processedContent,
      status: input.status,
      createdAt: new Date(result.created),
      updatedAt: new Date(result.updated),
    }, null);
  } catch (error) {
    return createResult<HydratedBlogPage, string>(null, `${error}`);
  }
}

export async function deleteBlogPage(id: string): Promise<Result<true, string>> {
  try {
    await pb.collection("Posts").delete(id);
    return createResult<true, string>(true, null);
  } catch (error) {
    return createResult<true, string>(null, `${error}`);
  }
}

export async function getBlogPage(id: string): Promise<Result<HydratedBlogPage, string>> {
  try {
    const result = await pb.collection("Posts").getOne(id, {
      filter: 'type = "blog"',
    });
    return createResult<HydratedBlogPage, string>(hydrateBlogRecord(result), null);
  } catch (error) {
    return createResult<HydratedBlogPage, string>(null, `${error}`);
  }
}

export async function listBlogPages(): Promise<Result<HydratedBlogPage[], string>> {
  try {
    const results = await pb.collection("Posts").getFullList({
      filter: 'type = "blog"',
    });
    return createResult<HydratedBlogPage[], string>(results.map(hydrateBlogRecord), null);
  } catch (error) {
    return createResult<HydratedBlogPage[], string>(null, `${error}`);
  }
}

// ============================================================
// EVENT CRUD FUNCTIONS
// ============================================================

export async function createEvent(
  input: CreateEventInput
): Promise<Result<HydratedEvent, string>> {
  try {
    const processedContent = await processBlocks(input.content);

    const result = await pb.collection("Posts").create({
      title: JSON.stringify(input.title),
      content: JSON.stringify(processedContent),
      start_date: input.startDate.toISOString(),
      end_date: input.endDate.toISOString(),
      type: "event",
      status: input.status,
    });

    return createResult<HydratedEvent, string>({
      id: result.id,
      title: input.title,
      content: processedContent,
      status: input.status,
      startDate: new Date(result.start_date),
      endDate: new Date(result.end_date),
      createdAt: new Date(result.created),
      updatedAt: new Date(result.updated),
    }, null);
  } catch (error) {
    return createResult<HydratedEvent, string>(null, `${error}`);
  }
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput
): Promise<Result<HydratedEvent, string>> {
  try {
    const processedContent = await processBlocks(input.content);

    const result = await pb.collection("Posts").update(id, {
      title: JSON.stringify(input.title),
      content: JSON.stringify(processedContent),
      start_date: input.startDate.toISOString(),
      end_date: input.endDate.toISOString(),
      type: "event",
      status: input.status,
    });

    return createResult<HydratedEvent, string>({
      id: result.id,
      title: input.title,
      content: processedContent,
      status: input.status,
      startDate: new Date(result.start_date),
      endDate: new Date(result.end_date),
      createdAt: new Date(result.created),
      updatedAt: new Date(result.updated),
    }, null);
  } catch (error) {
    return createResult<HydratedEvent, string>(null, `${error}`);
  }
}

export async function deleteEvent(id: string): Promise<Result<true, string>> {
  try {
    await pb.collection("Posts").delete(id);
    return createResult<true, string>(true, null);
  } catch (error) {
    return createResult<true, string>(null, `${error}`);
  }
}

export async function getEvent(id: string): Promise<Result<HydratedEvent, string>> {
  try {
    const result = await pb.collection("Posts").getOne(id, {
      filter: 'type = "event"',
    });
    return createResult<HydratedEvent, string>(hydrateEventRecord(result), null);
  } catch (error) {
    return createResult<HydratedEvent, string>(null, `${error}`);
  }
}

export async function listEvents(): Promise<Result<HydratedEvent[], string>> {
  try {
    const results = await pb.collection("Posts").getFullList({
      filter: 'type = "event"',
    });
    return createResult<HydratedEvent[], string>(results.map(hydrateEventRecord), null);
  } catch (error) {
    return createResult<HydratedEvent[], string>(null, `${error}`);
  }
}

// ============================================================
// HELPERS
// ============================================================

async function processBlocks<T extends (BlogPageBlock | EventBlock)[]>(
  blocks: T
): Promise<T> {
  const processed = await Promise.all(
    blocks.map(async (block) => {
      // Upload file if the block has a `file` property (image, video, media)
      if (block.file && typeof block.file !== 'string') {
        const result = await uploadAsset(block.file);
        if (result.success) {
          const asset = result.value;
          // Replace file with the asset URL, keep asset_id
          const updated = {
            ...block,
            file: asset.url,
            src: block.type === 'media' ? asset.url : block.src, // for media, also set src
            asset_id: asset.id,
          };
          return updated;
        } else {
          throw new Error(`Failed to upload asset: ${result.error}`);
        }
      }
      return block;
    })
  );
  return processed as T;
}

function hydrateBlogRecord(record: Record<string, any>): HydratedBlogPage {
  return {
    id: record.id,
    title: typeof record.title === "string" ? JSON.parse(record.title) : record.title,
    content: typeof record.content === "string" ? JSON.parse(record.content) : (record.content ?? []),
    status: (record.status as PostStatus) ?? "Draft",
    createdAt: new Date(record.created),
    updatedAt: new Date(record.updated),
  };
}

function hydrateEventRecord(record: Record<string, any>): HydratedEvent {
  return {
    id: record.id,
    title: typeof record.title === "string" ? JSON.parse(record.title) : record.title,
    content: typeof record.content === "string" ? JSON.parse(record.content) : (record.content ?? []),
    status: (record.status as PostStatus) ?? "Draft",
    startDate: new Date(record.start_date),
    endDate: new Date(record.end_date),
    createdAt: new Date(record.created),
    updatedAt: new Date(record.updated),
  };
}
