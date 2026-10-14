import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Bookmark } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onCitationClick?: (filename: string, pageNumber: number) => void;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
        <span className="font-mono text-[11px] uppercase tracking-wider text-sky-400 font-semibold">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px] cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed selection:bg-sky-500/30">
        <pre className="whitespace-pre">{code}</pre>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onCitationClick }) => {
  if (!content) return null;

  // Inline formatting helper
  const renderInline = (text: string): React.ReactNode[] => {
    // Regex for bold, code, link, citation
    // Regex matches:
    // 1. `code`
    // 2. **bold**
    // 3. *italic*
    // 4. [text](url)
    // 5. citation e.g. [Document.pdf, page 5] or [Document.pdf, p. 5]
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[(?:[^\]]+?\.pdf[^\]]*?)\]|\[([^\]]+)\]\(([^)]+)\))/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const token = match[0];

      // Inline Code: `code`
      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800/90 text-sky-300 font-mono text-xs border border-slate-700/70"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      // Bold: **bold**
      else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      }
      // Italic: *italic*
      else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={match.index} className="italic text-slate-200">
            {token.slice(1, -1)}
          </em>
        );
      }
      // Markdown link: [label](url)
      else if (match[2] && match[3]) {
        const label = match[2];
        const url = match[3];
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2 inline-flex items-center gap-0.5 font-medium transition-colors"
          >
            <span>{label}</span>
            <ExternalLink className="w-3 h-3 inline opacity-70" />
          </a>
        );
      }
      // Citation token e.g. [Filename.pdf, page 4]
      else if (token.startsWith('[') && token.endsWith(']')) {
        const inner = token.slice(1, -1);
        const citeMatch = inner.match(/([a-zA-Z0-9_\-.\s]+\.pdf)[\s,:]+(?:page|p\.?)?\s*(\d+)/i);
        if (citeMatch && onCitationClick) {
          const filename = citeMatch[1].trim();
          const page = parseInt(citeMatch[2], 10);
          parts.push(
            <button
              key={match.index}
              type="button"
              onClick={() => onCitationClick(filename, page)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-medium cursor-pointer transition-colors"
              title={`Inspect citation from ${filename} on page ${page}`}
            >
              <Bookmark className="w-3 h-3 text-sky-400" />
              <span>{filename} (p. {page})</span>
            </button>
          );
        } else {
          parts.push(token);
        }
      } else {
        parts.push(token);
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  // Block parser
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```(\w*)/);
      const language = langMatch ? langMatch[1] : '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      elements.push(
        <CodeBlock
          key={`code_${elements.length}`}
          language={language}
          code={codeLines.join('\n')}
        />
      );
      continue;
    }

    // Markdown Table: lines starting with |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // First line is header
        const headerCols = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((col) => col.trim());

        // Check if second line is separator (| --- | --- |)
        const isSep = tableLines[1].replace(/[-|:\s]/g, '').length === 0;
        const rowStartIdx = isSep ? 2 : 1;

        const bodyRows = tableLines.slice(rowStartIdx).map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((col) => col.trim())
        );

        elements.push(
          <div key={`table_${elements.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-800 shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  {headerCols.map((h, colIdx) => (
                    <th key={colIdx} className="px-3.5 py-2.5 border-r border-slate-800 last:border-r-0">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/60">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 border-r border-slate-800/80 last:border-r-0 text-slate-200">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1_${elements.length}`} className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-slate-800">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2_${elements.length}`} className="text-base font-bold text-sky-300 mt-3.5 mb-1.5">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3_${elements.length}`} className="text-sm font-semibold text-slate-100 mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4_${elements.length}`} className="text-xs font-semibold text-slate-300 mt-2 mb-1 uppercase tracking-wider">
          {renderInline(line.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={`quote_${elements.length}`}
          className="border-l-4 border-sky-500/50 bg-sky-950/20 px-3.5 py-2 my-2.5 rounded-r-lg text-xs italic text-slate-300 leading-relaxed"
        >
          {renderInline(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Unordered List (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul_${elements.length}`} className="my-2 space-y-1.5 pl-4 list-disc marker:text-sky-400 text-xs text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered List (1. , 2. )
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol_${elements.length}`} className="my-2 space-y-1.5 pl-5 list-decimal marker:text-sky-400 font-medium text-xs text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed font-normal">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty lines (spacing)
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Normal paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      elements.push(
        <p key={`p_${elements.length}`} className="text-xs sm:text-sm leading-relaxed text-slate-200 my-1.5">
          {renderInline(paragraphLines.join('\n'))}
        </p>
      );
    }
  }

  return <div className="space-y-1 text-slate-200">{elements}</div>;
};
