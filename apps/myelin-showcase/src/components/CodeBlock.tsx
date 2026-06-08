import React, { useState } from "react";

interface Line {
  tokens: Array<{ text: string; color: string }>;
}

// Minimal hand-coded syntax highlighting — no external dep
function parseCode(code: string): Line[] {
  const KEYWORD = "#1fa9a5"; // iris — keywords, imports
  const STRING = "#ea5c38"; // coral — strings
  const COMMENT = "#52525b"; // muted — comments
  const ATTR = "#8b36d6"; // violet — attributes/types
  const PLAIN = "#d4d4d8"; // neutral — default

  return code.split("\n").map(raw => {
    const tokens: Array<{ text: string; color: string }> = [];
    let rest = raw;

    // Comment
    if (rest.trimStart().startsWith("//")) {
      return { tokens: [{ text: raw, color: COMMENT }] };
    }

    // Very simple tokeniser: match patterns greedily
    while (rest.length > 0) {
      // import / from / export / const / return / default
      const kw = rest.match(
        /^(import|from|export|const|return|default|function|type|interface|as)\b/
      );
      if (kw) {
        tokens.push({ text: kw[0], color: KEYWORD });
        rest = rest.slice(kw[0].length);
        continue;
      }

      // String literals
      const str = rest.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (str) {
        tokens.push({ text: str[0], color: STRING });
        rest = rest.slice(str[0].length);
        continue;
      }

      // Type names (PascalCase identifiers)
      const type = rest.match(/^[A-Z][A-Za-z0-9]*/);
      if (type) {
        tokens.push({ text: type[0], color: ATTR });
        rest = rest.slice(type[0].length);
        continue;
      }

      // JSX tag <Component (iris)
      const jsx = rest.match(/^<\/?[A-Z][A-Za-z0-9]*/);
      if (jsx) {
        tokens.push({ text: jsx[0], color: KEYWORD });
        rest = rest.slice(jsx[0].length);
        continue;
      }

      // Default — consume one character
      tokens.push({ text: rest[0]!, color: PLAIN });
      rest = rest.slice(1);
    }
    return { tokens };
  });
}

interface CodeBlockProps {
  code: string;
  language?: string;
  label?: string;
}

export function CodeBlock({ code, language = "tsx", label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = parseCode(code.trim());

  const copy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      style={{
        position: "relative",
        background: "#080810",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Traffic lights */}
          <div style={{ display: "flex", gap: 6 }}>
            {["#ff5f57", "#ffbd2e", "#28c940"].map((c, i) => (
              <span
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: c,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
          {label && (
            <span
              style={{
                fontSize: 11,
                fontFamily: '"JetBrains Mono", monospace',
                color: "rgba(255,255,255,0.3)",
                letterSpacing: ".04em",
              }}
            >
              {label}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              color: "rgba(255,255,255,0.2)",
              letterSpacing: ".08em",
            }}
          >
            {language}
          </span>
          <button
            onClick={copy}
            style={{
              height: 24,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)",
              background: copied
                ? "rgba(34,197,94,0.12)"
                : "rgba(255,255,255,0.04)",
              color: copied ? "#22c55e" : "rgba(255,255,255,0.4)",
              fontSize: 10,
              cursor: "pointer",
              letterSpacing: ".04em",
              fontWeight: 500,
              transition: "all 150ms",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre
        style={{
          padding: "18px 0",
          overflowX: "auto",
          lineHeight: 1.75,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 13,
          tabSize: 2,
        }}
      >
        {lines.map((line, li) => (
          <div key={li} style={{ display: "flex" }}>
            <span
              style={{
                width: 44,
                textAlign: "right",
                paddingRight: 16,
                paddingLeft: 16,
                color: "rgba(255,255,255,0.12)",
                flexShrink: 0,
                userSelect: "none",
                fontSize: 11,
              }}
            >
              {li + 1}
            </span>
            <span style={{ paddingRight: 24 }}>
              {line.tokens.map((tok, ti) => (
                <span key={ti} style={{ color: tok.color }}>
                  {tok.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
