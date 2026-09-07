// ============================================================
// BLOCK TYPES
// ============================================================

import { environmentManager } from "@tanstack/react-query";
import { buildImageUrl, createPB_SSR, createResult, pb, Result, uploadAsset, type Asset } from "./pocketbase";

export type Language = "en" | "af";

export type ExperienceStatus = "Published" | "Draft";

export type Translatable<T = string> = {
  default: T;
  translations?: Partial<Record<Language, T>>;
};

export type HeaderBlock = {
  index: number;
  type: "header";
  level: 1 | 2 | 3;
  text: Translatable;
};

export type ParagraphBlock = {
  index: number;
  type: "paragraph";
  text: Translatable;
};

export type ImageBlock = {
  index: number;
  file: File;
  type: "image";
  alt: Translatable;
  caption?: Translatable;
};

export type VideoBlock = {
  index: number;
  file: File;
  type: "video";
  title?: Translatable;
};

export type TempAsset =
  Asset & {
    src?: string,
    type: "media"
    assetType: "image" | "video" | "svg"
  }

// What gets saved into the PocketBase JSON column
export type StorageMediaBlock = {
  index: number;
  type: "image" | "video";
  asset_id: string;
  asset_collectionId: string;
  asset_file: string;
  alt?: Translatable; // Keeping translatable consistency
  caption?: Translatable;
  title?: Translatable;
};

export type PageBlock =
  | HeaderBlock
  | ParagraphBlock
  | TempAsset
  | Omit<ImageBlock, "id">
  | Omit<VideoBlock, "id">

export type StoragePageBlock = HeaderBlock | ParagraphBlock | StorageMediaBlock;

// What the frontend actually consumes with live working URLs
export type HydratedImageBlock = Omit<StorageMediaBlock, "asset_id" | "asset_collectionId" | "asset_file"> & {
  type: "image";
  url: string;
};

export type HydratedVideoBlock = Omit<StorageMediaBlock, "asset_id" | "asset_collectionId" | "asset_file"> & {
  type: "video";
  url: string;
};


export type HydratedMediaBlock = {
  index: number;
  type: "media";
  src: string;
  assetType: "image" | "video" | "svg";
  alt?: string;
  name?: string;
};

export type HydratedPageBlock = HeaderBlock | ParagraphBlock | HydratedImageBlock | HydratedVideoBlock | HydratedMediaBlock;

// ============================================================
// BOOKING PAGE
// ============================================================

export type BookingPage = {
  id: string;
  slug: string;
  title: Translatable;
  description?: Translatable;
  coverImage: File;
  category: string;
  defaultLanguage: Language;
  enabledLanguages: Language[];
  blocks: PageBlock[];
  status: ExperienceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type FlatBookingPage = {
  id: string;
  slug: string;
  title: Translatable;
  description?: Translatable;
  coverImage: File;
  category: string;
  defaultLanguage: Language;
  enabledLanguages: Language[];
  blocks: StoragePageBlock[];
  createdAt: Date;
  updatedAt: Date;
};

export type HydratedBookingPage = {
  id: string;
  slug: string;
  title: Translatable;
  description?: Translatable;
  coverImage: string;
  category: string;
  defaultLanguage: Language;
  enabledLanguages: Language[];
  blocks: HydratedPageBlock[];
  status: ExperienceStatus;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================
// HELPER: HYDRATE BLOCKS
// ============================================================
export function hydrateBlocks(blocks: StoragePageBlock[]): HydratedPageBlock[] {
  if (!blocks || !Array.isArray(blocks)) return [];

  return blocks.map((block) => {
    if (block.type === "image" || block.type === "video") {
      const { asset_collectionId, asset_id, asset_file, ...rest } = block as StorageMediaBlock;
      return {
        ...rest,
        url: buildImageUrl(asset_collectionId, asset_id, asset_file),
      } as HydratedPageBlock;
    }
    return block as HydratedPageBlock;
  });
}

// ============================================================
// CRUD FUNCTION SIGNATURES
// ============================================================
export type CreateBookingPageInput = Omit<BookingPage, "id" | "createdAt" | "updatedAt">;
export type UpdateBookingPageInput = Omit<BookingPage, "id" | "createdAt" | "updatedAt">;

export async function createBookingPage(input: CreateBookingPageInput): Promise<Result<HydratedBookingPage, string>> {
  try {
    const coverUploadResult = await uploadAsset(input.coverImage, {
      name: `${input.title.default}-cover`,
      type: "image"
    });

    if (!coverUploadResult.success) {
      return createResult(null, "Failed to upload cover image");
    }

    const blockUploadPromises = input.blocks.map(async (block, index) => {
      if (["image", "video"].includes(block.type)) {
        // @ts-ignore
        if (!block.file) throw new Error(`Block at index ${index} has no file`);
        // @ts-ignore
        return [await uploadAsset(block.file), index, block];
      } else {
        return [block, index, null];
      }
    });

    const blockUploadResults = await Promise.all(blockUploadPromises);

    const storageBlocks: StoragePageBlock[] = blockUploadResults.map((blockUploadResult) => {
      const [uploadResultOrBlock, index, originalBlock] = blockUploadResult;
      if (uploadResultOrBlock instanceof Result) {
        if (uploadResultOrBlock.success) {
          const uploadedAsset = uploadResultOrBlock.value as Asset;
          return {
            type: originalBlock.type,
            asset_id: uploadedAsset.id,
            asset_collectionId: uploadedAsset.collectionId,
            asset_file: uploadedAsset.file,
            index: index,
            alt: originalBlock.type === "image" ? (originalBlock as ImageBlock).alt : undefined,
            caption: originalBlock.type === "image" ? (originalBlock as ImageBlock).caption : undefined,
            title: originalBlock.type === "video" ? (originalBlock as VideoBlock).title : undefined,
          } as StorageMediaBlock;
        } else {
          throw new Error("Failed to upload asset based block");
        }
      } else {
        return uploadResultOrBlock as StoragePageBlock;
      }
    });

    const result = await pb.collection("Experiences").create({
      title: JSON.stringify(input.title),
      description: input.description ? JSON.stringify(input.description) : undefined,
      category: input.category,
      enabledLanguages: input.enabledLanguages,
      coverImage: coverUploadResult.value!.id,
      blocks: storageBlocks,
      status: input.status,
    });

    return createResult<HydratedBookingPage, string>({
      id: result.id,
      slug: input.slug,
      title: input.title,
      description: input.description,
      coverImage: coverUploadResult.value!.id,
      category: input.category,
      defaultLanguage: input.defaultLanguage,
      enabledLanguages: input.enabledLanguages,
      blocks: hydrateBlocks(storageBlocks),
      status: input.status,
      createdAt: new Date(result.created),
      updatedAt: new Date(result.updated),
    }, null);
  } catch (error) {
    return createResult<HydratedBookingPage, string>(null, `${error}`);
  }
}

export type FeatureCard = Omit<FlatBookingPage, "expand" | "blocks" | "slug" | "coverImage"> & {
  coverImage: string;
  lang: Language;
}

export async function fetchFeaturedExperienceCard(lang: Language = "en", cookieHeader?: string): Promise<Result<FeatureCard[], string>> {
  let client;

  if (environmentManager.isServer()) {
    client = createPB_SSR(cookieHeader);
  } else {
    const { pb } = await import("@/lib/pocketbase");
    client = pb;
  }

  try {
    const records: FlatBookingPage[] = await client.collection("Experiences").getFullList({
      filter: `(category = "featured" || category ~ "featured," || category ~ ",featured") && status = "Published"`,
      expand: 'coverImage'
    })

    const t: FeatureCard[] = records.map((obj) => {
      // @ts-ignore
      const image = obj.expand["coverImage"];
      return {
        id: obj.id,
        category: obj.category,
        defaultLanguage: obj.defaultLanguage,
        enabledLanguages: obj.enabledLanguages,
        title: typeof obj.title === "string" ? JSON.parse(obj.title) : obj.title,
        description: obj.description
          ? (typeof obj.description === "string" ? JSON.parse(obj.description) : obj.description)
          : undefined,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        coverImage: buildImageUrl(image.collectionId, image.id, image.file),
        lang,
      }
    })

    return createResult(t, null);
  } catch (error) {
    console.error(error);
    return createResult(null, "failed to retrieve data")
  }
}


export async function fetchAllExperiencesCard(lang: Language = "en", cookieHeader?: string): Promise<Result<FeatureCard[], string>> {
  let client;

  if (environmentManager.isServer()) {
    client = createPB_SSR(cookieHeader);
  } else {
    const { pb } = await import("@/lib/pocketbase");
    client = pb;
  }

  try {
    const records: FlatBookingPage[] = await client.collection("Experiences").getFullList({
      filter: `status = "Published"`,
      expand: 'coverImage'
    })

    const t: FeatureCard[] = records.map((obj) => {
      // @ts-ignore
      const image = obj.expand["coverImage"];
      return {
        id: obj.id,
        category: obj.category,
        defaultLanguage: obj.defaultLanguage,
        enabledLanguages: obj.enabledLanguages,
        title: typeof obj.title === "string" ? JSON.parse(obj.title) : obj.title,
        description: obj.description
          ? (typeof obj.description === "string" ? JSON.parse(obj.description) : obj.description)
          : undefined,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        coverImage: buildImageUrl(image.collectionId, image.id, image.file),
        lang,
      }
    })

    return createResult(t, null);
  } catch (error) {
    console.error(error);
    return createResult(null, "failed to retrieve data")
  }
}
// ============================================================
// ASYNC HELPER: HYDRATE BLOCKS WITH DATABASE LOOKUP
// ============================================================
export async function hydrateBlocksAsync(
  client: any,
  blocks: any[],
  fallbackCollectionId: string
): Promise<HydratedPageBlock[]> {
  if (!blocks || !Array.isArray(blocks)) return [];

  // 1. Gather all unique asset IDs from the blocks that need hydration
  const mediaBlocks = blocks.filter(b => (b.type === "image" || b.type === "video") && b.asset_id);
  const assetIds = [...new Set(mediaBlocks.map(b => b.asset_id))];

  const assetFileMap = new Map<string, string>();

  // 2. Batch fetch the missing file names from your assets collection
  if (assetIds.length > 0) {
    try {
      const filterString = assetIds.map(id => `id = "${id}"`).join(" || ");
      // Using fallbackCollectionId dynamically from your expanded coverImage relationship
      const assetRecords = await client.collection(fallbackCollectionId).getFullList({
        filter: filterString,
      });

      assetRecords.forEach((asset: any) => {
        assetFileMap.set(asset.id, asset.file);
      });
    } catch (err) {
      console.error("Failed to batch fetch block assets:", err);
    }
  }

  // 3. Map the blocks to their final hydrated state with working URLs
  return blocks.map((block) => {
    if (block.type === "image" || block.type === "video") {
      const collectionId = block.asset_collectionId || fallbackCollectionId;
      const fileName = block.asset_file || assetFileMap.get(block.asset_id);

      const { asset_collectionId, asset_id, asset_file, ...rest } = block;

      return {
        ...rest,
        url: fileName ? buildImageUrl(collectionId, block.asset_id, fileName) : "",
      } as HydratedPageBlock;
    }
    return block as HydratedPageBlock;
  });
}

// ============================================================
// UPDATED FETCH FUNCTIONS
// ============================================================

export async function fetchExperiences(cookieHeader?: string): Promise<Result<HydratedBookingPage[], string>> {
  let client;

  if (environmentManager.isServer()) {
    client = createPB_SSR(cookieHeader);
  } else {
    const { pb } = await import("@/lib/pocketbase");
    client = pb;
  }

  try {
    const records: FlatBookingPage[] = await client.collection("Experiences").getFullList({
      filter: `status = "Published"`,
      expand: 'coverImage'
    });

    // Use Promise.all since block hydration now requires an async database lookup
    const hydratedRecords = await Promise.all(
      records.map(async (obj) => {
        // @ts-ignore
        const image = obj.expand["coverImage"];
        const rawBlocks = typeof obj.blocks === "string" ? JSON.parse(obj.blocks) : obj.blocks;

        // Dynamically extract the assets collection ID from the coverImage relation metadata
        const assetCollectionId = image?.collectionId || "assets";

        return {
          ...obj,
          title: typeof obj.title === "string" ? JSON.parse(obj.title) : obj.title,
          description: obj.description
            ? (typeof obj.description === "string" ? JSON.parse(obj.description) : obj.description)
            : undefined,
          coverImage: image ? buildImageUrl(image.collectionId, image.id, image.file) : "",
          blocks: await hydrateBlocksAsync(client, rawBlocks, assetCollectionId)
        };
      })
    );

    return createResult(hydratedRecords, null);
  } catch (error) {
    console.error(error);
    return createResult(null, "failed to get experiences");
  }
}

export async function fetchExperienceById(id: string, cookieHeader?: string) {
  let client;

  if (environmentManager.isServer()) {
    client = createPB_SSR(cookieHeader);
  } else {
    const { pb } = await import("@/lib/pocketbase");
    client = pb;
  }

  try {
    const record: FlatBookingPage | null = await client.collection("Experiences").getOne(id, {
      expand: "coverImage"
    });
    if (!record) return createResult(null, "Failed to get experiences");

    // @ts-ignore
    const image = record.expand["coverImage"];
    const rawBlocks = typeof record.blocks === "string" ? JSON.parse(record.blocks) : record.blocks;

    // Dynamically extract the assets collection ID from the coverImage relation metadata
    const assetCollectionId = image?.collectionId || "assets";

    return createResult<HydratedBookingPage, string>({
      ...record,
      title: typeof record.title === "string" ? JSON.parse(record.title) : record.title,
      description: record.description
        ? (typeof record.description === "string" ? JSON.parse(record.description) : record.description)
        : undefined,
      coverImage: image ? buildImageUrl(image.collectionId, image.id, image.file) : "",
      blocks: await hydrateBlocksAsync(client, rawBlocks, assetCollectionId)
    }, null);
  } catch (error) {
    console.error(error);
    return createResult(null, "Failed to get experiences");
  }
}

export async function deleteExperienceById(id: string, cookieHeader?: string) {
  let client;

  if (environmentManager.isServer()) {
    client = createPB_SSR(cookieHeader);
  } else {
    const { pb } = await import("@/lib/pocketbase");
    client = pb;
  }

  try {
    const res: boolean = await client.collection("Experiences").delete(id);
    return createResult(res, null)
  } catch (error) {
    console.error(error);
    return createResult(null, "Failed to delete record: " + id)
  }
}

// ============================================================
// UTILITIES
// ============================================================
export function resolveTranslatable<T>(field: Translatable<T>, lang: Language): T {
  return field.translations?.[lang] ?? field.default;
}

export function parseCategories(category: string): string[] {
  return category
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function serializeCategories(categories: string[]): string {
  return categories
    .map((c) => c.trim())
    .filter(Boolean)
    .join(",");
}

const HIDDEN_CATEGORIES = new Set(["featured"]);

export function deriveCategories(experiences: { category: string }[]): string[] {
  const seen = new Map<string, string>();
  for (const exp of experiences) {
    for (const cat of parseCategories(exp.category)) {
      const key = cat.toLowerCase();
      if (HIDDEN_CATEGORIES.has(key)) continue;
      if (!seen.has(key)) seen.set(key, cat);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export function experienceHasCategory(experience: { category: string }, category: string): boolean {
  const target = category.toLowerCase();
  return parseCategories(experience.category).some((c) => c.toLowerCase() === target);
}

export function createEmptyBlock(type: PageBlock["type"], index: number): PageBlock {
  const base = { index };
  switch (type) {
    case "header":
      return { ...base, type, level: 1, text: { default: "" } };
    case "paragraph":
      return { ...base, type, text: { default: "" } };
    case "image":
      return { ...base, type, file: null as unknown as File, alt: { default: "" } };
    case "video":
      return { ...base, type, file: null as unknown as File };
    case "media":
      return { ...base, type, alt: "", collectionId: "", collectionName: "", file: "", id: "", name: "", assetType: "image" }
  }
}
