import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { blocksToMarkdown } from "./block-to-markdown";

// Types
export interface NotionPageItem {
  id: string;
  title: string;
  icon: string | null;
  last_edited: string;
  has_children: boolean;
}

export interface NotionPageContent {
  id: string;
  title: string;
  content: string; // markdown
  last_edited: string;
  word_count: number;
}

// Singleton client — initialized lazily to avoid errors when NOTION_TOKEN is missing
let _client: Client | null = null;

export function getNotionClient(): Client {
  if (!_client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is not set");
    }
    _client = new Client({ auth: token });
  }
  return _client;
}

// Re-export for convenience (lazy; throws if token missing)
export const notion = new Proxy({} as Client, {
  get(_target, prop) {
    return (getNotionClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Extract page title from a Notion page object's properties.
 */
function extractPageTitle(page: PageObjectResponse): string {
  const properties = page.properties;
  for (const key of Object.keys(properties)) {
    const prop = properties[key];
    if (prop.type === "title" && prop.title.length > 0) {
      return prop.title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

/**
 * Extract icon emoji or external URL from a page's icon field.
 */
function extractIcon(page: PageObjectResponse): string | null {
  const icon = page.icon;
  if (!icon) return null;
  if (icon.type === "emoji") return icon.emoji;
  if (icon.type === "external") return icon.external.url;
  if (icon.type === "file") return icon.file.url;
  return null;
}

/**
 * List child pages of a given parent page/block.
 * Uses blocks.children.list to find child_page blocks.
 */
export async function listChildPages(
  parentId: string
): Promise<NotionPageItem[]> {
  const client = getNotionClient();
  const pages: NotionPageItem[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: parentId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      // Only process full block objects (not partial)
      if (!("type" in block)) continue;
      const b = block as BlockObjectResponse;

      if (b.type === "child_page") {
        const childPage = (b as unknown as Record<string, unknown>).child_page as {
          title?: string;
        } | undefined;

        // Retrieve the page to get icon and has_children info
        let icon: string | null = null;
        let hasChildren = false;

        try {
          const pageDetail = await client.pages.retrieve({ page_id: b.id });
          if ("properties" in pageDetail) {
            icon = extractIcon(pageDetail);
          }
          // Check if the page has children blocks
          const childCheck = await client.blocks.children.list({
            block_id: b.id,
            page_size: 1,
          });
          hasChildren = childCheck.results.length > 0;
        } catch {
          // If we can't retrieve details, use defaults
        }

        pages.push({
          id: b.id,
          title: childPage?.title ?? "Untitled",
          icon,
          last_edited: b.last_edited_time,
          has_children: hasChildren,
        });
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

/**
 * Get full content of a page as markdown.
 * Retrieves all blocks and converts them to markdown.
 */
export async function getPageContent(
  pageId: string
): Promise<NotionPageContent> {
  const client = getNotionClient();

  // Fetch page metadata and blocks in parallel
  const [page, blocks] = await Promise.all([
    client.pages.retrieve({ page_id: pageId }),
    getAllBlocks(client, pageId),
  ]);

  const pageObj = page as PageObjectResponse;
  const title = extractPageTitle(pageObj);
  const content = blocksToMarkdown(blocks);

  // Count words (split by whitespace, filter empty)
  const wordCount = content
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return {
    id: pageId,
    title,
    content,
    last_edited: pageObj.last_edited_time,
    word_count: wordCount,
  };
}

/**
 * Fetch all blocks from a page, handling pagination.
 */
async function getAllBlocks(
  client: Client,
  blockId: string
): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if ("type" in block) {
        blocks.push(block as BlockObjectResponse);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}
