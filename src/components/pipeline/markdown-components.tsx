import type { Components } from "react-markdown";

// Shared markdown rendering components for log viewer and execution summary
export const mdComponents: Partial<Components> = {
  h1: ({ children }) => <h1 className="text-sm font-bold mt-2 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xs font-bold mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-semibold mt-1 mb-0.5">{children}</h3>,
  h4: ({ children }) => <h4 className="text-xs font-semibold mt-1">{children}</h4>,
  h5: ({ children }) => <h5 className="text-xs font-medium mt-1">{children}</h5>,
  h6: ({ children }) => <h6 className="text-xs font-medium mt-1">{children}</h6>,
  p: ({ children }) => <p className="text-xs my-0.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="text-xs list-disc pl-4 my-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="text-xs list-decimal pl-4 my-0.5">{children}</ol>,
  li: ({ children }) => <li className="my-0">{children}</li>,
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <pre className="bg-muted rounded px-2 py-1 my-1 overflow-x-auto text-[11px]">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="bg-muted rounded px-1 py-0.5 text-[11px]">{children}</code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <table className="text-[11px] border-collapse my-1 w-full">{children}</table>
  ),
  th: ({ children }) => (
    <th className="border border-border px-1.5 py-0.5 bg-muted font-semibold text-left">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-1.5 py-0.5">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-2 my-1 text-muted-foreground italic">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="underline text-blue-500 hover:text-blue-400" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};
