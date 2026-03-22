import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type RichTextItem = {
  plain_text: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
  href?: string | null;
};

/**
 * Extract plain text from a rich_text array, preserving inline formatting.
 */
function richTextToMarkdown(richTexts: RichTextItem[]): string {
  return richTexts
    .map((rt) => {
      let text = rt.plain_text;
      if (!text) return "";

      const ann = rt.annotations;
      if (ann?.code) text = `\`${text}\``;
      if (ann?.bold) text = `**${text}**`;
      if (ann?.italic) text = `*${text}*`;
      if (ann?.strikethrough) text = `~~${text}~~`;
      if (rt.href) text = `[${text}](${rt.href})`;

      return text;
    })
    .join("");
}

/**
 * Get rich_text array from a block safely.
 */
function getBlockRichText(block: BlockObjectResponse): RichTextItem[] {
  const b = block as Record<string, unknown>;
  const content = b[block.type] as Record<string, unknown> | undefined;
  if (!content) return [];
  return (content.rich_text as RichTextItem[] | undefined) ?? [];
}

/**
 * Convert an array of Notion blocks to a markdown string.
 */
export function blocksToMarkdown(blocks: BlockObjectResponse[]): string {
  const lines: string[] = [];
  let numberedIndex = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const type = block.type;

    // Reset numbered list index when leaving numbered_list_item
    if (type !== "numbered_list_item") {
      numberedIndex = 0;
    }

    switch (type) {
      case "paragraph": {
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push(text);
        lines.push("");
        break;
      }

      case "heading_1": {
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push(`# ${text}`);
        lines.push("");
        break;
      }

      case "heading_2": {
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push(`## ${text}`);
        lines.push("");
        break;
      }

      case "heading_3": {
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push(`### ${text}`);
        lines.push("");
        break;
      }

      case "bulleted_list_item": {
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push(`- ${text}`);
        break;
      }

      case "numbered_list_item": {
        numberedIndex++;
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push(`${numberedIndex}. ${text}`);
        break;
      }

      case "to_do": {
        const b = block as Record<string, unknown>;
        const todo = b.to_do as { checked?: boolean; rich_text?: RichTextItem[] } | undefined;
        const checked = todo?.checked ? "x" : " ";
        const text = richTextToMarkdown(todo?.rich_text ?? []);
        lines.push(`- [${checked}] ${text}`);
        break;
      }

      case "code": {
        const b = block as Record<string, unknown>;
        const code = b.code as { language?: string; rich_text?: RichTextItem[] } | undefined;
        const language = code?.language ?? "";
        const text = richTextToMarkdown(code?.rich_text ?? []);
        lines.push(`\`\`\`${language}`);
        lines.push(text);
        lines.push("```");
        lines.push("");
        break;
      }

      case "quote": {
        const text = richTextToMarkdown(getBlockRichText(block));
        const quotedLines = text.split("\n").map((line) => `> ${line}`);
        lines.push(...quotedLines);
        lines.push("");
        break;
      }

      case "callout": {
        const b = block as Record<string, unknown>;
        const callout = b.callout as { icon?: { emoji?: string }; rich_text?: RichTextItem[] } | undefined;
        const icon = callout?.icon?.emoji ?? "";
        const text = richTextToMarkdown(callout?.rich_text ?? []);
        lines.push(`> ${icon} ${text}`.trim());
        lines.push("");
        break;
      }

      case "divider": {
        lines.push("---");
        lines.push("");
        break;
      }

      case "toggle": {
        const text = richTextToMarkdown(getBlockRichText(block));
        lines.push("<details>");
        lines.push(`<summary>${text}</summary>`);
        lines.push("</details>");
        lines.push("");
        break;
      }

      case "image": {
        const b = block as Record<string, unknown>;
        const image = b.image as {
          type?: string;
          file?: { url?: string };
          external?: { url?: string };
          caption?: RichTextItem[];
        } | undefined;
        const url =
          image?.type === "file"
            ? image.file?.url ?? ""
            : image?.external?.url ?? "";
        const caption = richTextToMarkdown(image?.caption ?? []);
        lines.push(`![${caption}](${url})`);
        lines.push("");
        break;
      }

      case "table": {
        // Table blocks require children to be fetched separately.
        // We output a placeholder here; full table rendering needs child blocks.
        lines.push("<!-- table: requires child block fetching -->");
        lines.push("");
        break;
      }

      case "table_row": {
        const b = block as Record<string, unknown>;
        const row = b.table_row as { cells?: RichTextItem[][] } | undefined;
        const cells = row?.cells ?? [];
        const cellTexts = cells.map((cell) => richTextToMarkdown(cell));
        lines.push(`| ${cellTexts.join(" | ")} |`);
        break;
      }

      case "bookmark": {
        const b = block as Record<string, unknown>;
        const bookmark = b.bookmark as { url?: string; caption?: RichTextItem[] } | undefined;
        const url = bookmark?.url ?? "";
        const caption = richTextToMarkdown(bookmark?.caption ?? []);
        lines.push(`[${caption || url}](${url})`);
        lines.push("");
        break;
      }

      case "child_page": {
        const b = block as Record<string, unknown>;
        const childPage = b.child_page as { title?: string } | undefined;
        lines.push(`> **Page**: ${childPage?.title ?? "Untitled"}`);
        lines.push("");
        break;
      }

      case "child_database": {
        const b = block as Record<string, unknown>;
        const childDb = b.child_database as { title?: string } | undefined;
        lines.push(`> **Database**: ${childDb?.title ?? "Untitled"}`);
        lines.push("");
        break;
      }

      default: {
        lines.push(`<!-- unsupported: ${type} -->`);
        lines.push("");
        break;
      }
    }
  }

  return lines.join("\n").trim();
}
