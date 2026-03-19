'use client';

import { useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderChart = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        fontFamily: 'inherit',
      });
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(id, chart);
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    } catch {
      if (containerRef.current) {
        containerRef.current.textContent = chart;
      }
    }
  }, [chart]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border bg-card p-4"
    />
  );
}

function getChildClassName(children: unknown): string | undefined {
  if (children && typeof children === 'object' && 'props' in children) {
    return (children as React.ReactElement<{ className?: string }>).props?.className;
  }
  return undefined;
}

function getChildText(children: unknown): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getChildText).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    const el = children as React.ReactElement<{ children?: unknown }>;
    return getChildText(el.props.children);
  }
  return String(children ?? '');
}

const components: Components = {
  pre({ children }) {
    const childClass = getChildClassName(children);

    if (childClass?.includes('language-mermaid')) {
      return <MermaidBlock chart={getChildText(children)} />;
    }

    return (
      <pre className="help-code-block rounded-lg border bg-[hsl(var(--code-bg))] text-[hsl(var(--code-fg))] p-4 overflow-x-auto text-sm leading-relaxed">
        {children}
      </pre>
    );
  },
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="help-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
