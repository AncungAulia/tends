import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders an assistant message written in Markdown with Tends-styled elements. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="mb-2 last:mb-0" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          ul: (props) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
          ol: (props) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
          li: (props) => <li {...props} />,
          h1: (props) => <h1 className="mb-2 mt-3 text-base font-bold first:mt-0" {...props} />,
          h2: (props) => <h2 className="mb-2 mt-3 text-base font-bold first:mt-0" {...props} />,
          h3: (props) => <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0" {...props} />,
          a: (props) => (
            <a className="text-[#1591DC] underline" target="_blank" rel="noreferrer" {...props} />
          ),
          code: (props) => (
            <code className="rounded bg-[#0C1A2B]/5 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10" {...props} />
          ),
          pre: (props) => (
            <pre className="mb-2 overflow-x-auto rounded-lg bg-[#0C1A2B]/5 p-3 font-mono text-xs last:mb-0 dark:bg-white/10" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="border-l-2 border-[#DDE8F2] pl-3 text-[#5B7490] dark:border-white/15" {...props} />
          ),
          hr: () => <hr className="my-3 border-[#DDE8F2] dark:border-white/10" />,
          table: (props) => (
            <div className="mb-2 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-left" {...props} />
            </div>
          ),
          th: (props) => (
            <th className="border-b border-[#DDE8F2] py-1 pr-3 font-semibold dark:border-white/10" {...props} />
          ),
          td: (props) => (
            <td className="border-b border-[#DDE8F2]/60 py-1 pr-3 dark:border-white/5" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
