#!/usr/bin/env python3
import sys
import os
import re
from bs4 import BeautifulSoup, Comment

def refactor_html_file(file_path, output_path, is_standard=True):
    print(f"Refactoring {file_path} -> {output_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')

    # Remove all style tags because we will supply our own custom style tag
    # which merges custody styles with the pandoc code highlighting classes
    highlight_styles = ""
    for style_tag in soup.find_all('style'):
        style_text = style_tag.string or ""
        # Preserve code syntax highlighting rules
        if "code span." in style_text or "pre > code" in style_text:
            lines = style_text.split('\n')
            highlight_styles += "\n".join([l for l in lines if "code span." in l or "span.smallcaps" in l or "hanging-indent" in l])
        style_tag.decompose()

    # Define our custom premium stylesheet matching custody_problem.html
    theme_css = """
    :root {
      --bg: #0b1117;
      --panel: rgba(255, 255, 255, 0.04);
      --line: rgba(255, 255, 255, 0.1);
      --line2: rgba(255, 255, 255, 0.18);
      --text: rgba(255, 255, 255, 0.94);
      --muted: rgba(255, 255, 255, 0.68);
      --faint: rgba(255, 255, 255, 0.44);
      --teal: #14b8a6;
      --warn: #e96b4a;
      --serif: Georgia, "Source Serif Pro", serif;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      --mono: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
      --callout-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
      --card-bg: rgba(255, 255, 255, 0.04);
      --timeline-bg: rgba(255, 255, 255, 0.028);
      --contract-bg: linear-gradient(135deg, rgba(20, 184, 166, 0.09), rgba(20, 184, 166, 0.018)), rgba(255, 255, 255, 0.02);
      --thesis-bg: rgba(20, 184, 166, 0.045);
      --topbar-bg: rgba(11, 17, 23, 0.84);
      --hero-bg: radial-gradient(circle at 16% 8%, rgba(20, 184, 166, 0.13), transparent 28%), radial-gradient(circle at 86% 22%, rgba(255, 255, 255, 0.06), transparent 26%), linear-gradient(180deg, #0b1117 0%, var(--bg) 44%, #0a1016 100%);
      --download-text: #06100f;
    }

    [data-theme="light"] {
      --bg: #fbf8f1;
      --panel: #ffffff;
      --line: rgba(24, 34, 42, 0.16);
      --line2: rgba(24, 34, 42, 0.25);
      --text: #172024;
      --muted: #4d5a61;
      --faint: #6b767c;
      --teal: #0d766f;
      --warn: #bf4f35;
      --callout-bg: #fff;
      --card-bg: #fff;
      --timeline-bg: #f9f7f0;
      --contract-bg: linear-gradient(135deg, rgba(13, 118, 111, 0.06), rgba(13, 118, 111, 0.02)), #fffefb;
      --thesis-bg: #eef8f5;
      --topbar-bg: rgba(251, 248, 241, 0.88);
      --hero-bg: #fbf8f1;
      --download-text: #ffffff;
    }

    * { box-sizing: border-box; }
    html {
      scroll-behavior: smooth;
    }
    /* Scrollbar Customization for perfect platform harmony */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg);
    }
    ::-webkit-scrollbar-thumb {
      background: var(--line2);
      border-radius: 999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--teal);
    }
    body {
      margin: 0;
      background: var(--hero-bg);
      color: var(--text);
      font-family: var(--serif);
      font-size: 19px;
      line-height: 1.68;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      transition: background 0.3s ease, color 0.3s ease;
    }
    .wrap {
      width: min(100% - 56px, 800px);
      margin: 0 auto;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 1px solid var(--line);
      background: var(--topbar-bg);
      backdrop-filter: blur(16px);
      transition: background 0.3s ease;
    }
    .topbar-inner {
      width: min(100% - 56px, 1040px);
      min-height: 70px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 22px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      text-decoration: none;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .navlink, .download, .theme-toggle {
      font-family: var(--sans);
      font-size: 13px;
      text-decoration: none;
      border-radius: 999px;
      white-space: nowrap;
    }
    .navlink {
      color: var(--faint);
      padding: 11px 12px;
    }
    .download {
      color: var(--download-text);
      background: var(--teal);
      border: 1px solid rgba(20, 184, 166, 0.9);
      padding: 12px 16px;
      font-weight: 700;
    }
    .theme-toggle {
      background: transparent;
      border: 1px solid var(--line2);
      color: var(--faint);
      padding: 8px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.3s;
    }
    .theme-toggle:hover {
      background: var(--line);
    }
    .hero {
      padding: 86px 0 96px;
      border-bottom: 1px solid var(--line);
      transition: background 0.3s ease;
    }
    .hero .wrap {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--teal);
      margin-bottom: 30px;
    }
    .eyebrow:before {
      content: "";
      width: 36px;
      height: 1px;
      background: var(--teal);
    }
    h1 {
      font-family: var(--serif);
      font-size: clamp(40px, 5.5vw, 68px);
      line-height: 1.08;
      letter-spacing: -0.04em;
      font-weight: 400;
      margin: 0 0 28px;
      max-width: 100%;
    }
    h1 em, h2 em {
      color: var(--teal);
      font-style: italic;
    }
    .subtitle {
      font-family: var(--sans);
      font-size: clamp(19px, 2.15vw, 24px);
      line-height: 1.45;
      color: var(--muted);
      max-width: 100%;
      margin: 0 0 28px;
    }
    .thesis-line {
      margin: 38px 0 0;
      padding: 22px 26px;
      max-width: 100%;
      border: 1px solid rgba(20, 184, 166, 0.32);
      background: var(--thesis-bg);
      border-radius: 18px;
      font-family: var(--sans);
      color: var(--text);
      font-size: 16px;
      line-height: 1.65;
    }
    .thesis-line strong {
      color: var(--teal);
    }
    .byline {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 18px 34px;
      margin-top: 34px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .byline strong {
      display: block;
      margin-top: 4px;
      color: var(--text);
      font-family: var(--sans);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }
    main {
      padding: 40px 0 0;
    }
    section {
      padding: 70px 0;
      border-bottom: 1px solid var(--line);
      transition: border-color 0.3s;
    }
    section:last-of-type {
      border-bottom: none;
    }
    .section-label {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--faint);
      margin-bottom: 18px;
    }
    h2 {
      font-family: var(--serif);
      font-size: clamp(28px, 3.8vw, 42px);
      line-height: 1.15;
      letter-spacing: -0.02em;
      font-weight: 400;
      margin: 30px 0 28px;
      max-width: 100%;
    }
    h3 {
      font-family: var(--sans);
      font-size: 21px;
      font-weight: 700;
      color: var(--text);
      margin: 40px 0 16px;
    }
    h4 {
      font-family: var(--sans);
      font-size: 17px;
      font-weight: 700;
      color: var(--muted);
      margin: 30px 0 12px;
    }
    p {
      max-width: 100%;
      margin: 0 0 24px;
      color: var(--text);
    }
    p.muted {
      color: var(--muted);
    }
    strong {
      font-weight: 700;
    }
    ul, ol {
      max-width: 100%;
      padding-left: 24px;
      margin-bottom: 24px;
    }
    li {
      margin-bottom: 8px;
    }
    .callout {
      margin: 42px 0;
      padding: 34px 36px;
      border-radius: 22px;
      border: 1px solid var(--line2);
      background: var(--callout-bg);
      max-width: 100%;
      transition: background 0.3s;
    }
    .callout h3, .contract h3 {
      margin: 0 0 12px;
      font-family: var(--sans);
      font-size: 15px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--teal);
    }
    .callout p {
      max-width: none;
      margin-bottom: 0;
    }
    .pull {
      margin: 52px 0;
      padding: 42px 0 42px 34px;
      border-left: 2px solid var(--teal);
      font-size: clamp(23px, 3.1vw, 32px);
      line-height: 1.32;
      letter-spacing: -0.02em;
      font-style: italic;
      font-weight: 400;
      max-width: 100%;
    }
    .pull span {
      display: block;
      margin-top: 20px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      font-style: normal;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin: 34px 0 8px;
      max-width: 100%;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--card-bg);
      padding: 26px;
      font-family: var(--sans);
      transition: background 0.3s;
    }
    .card .num {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      color: var(--teal);
      margin-bottom: 10px;
    }
    .card h3 {
      font-size: 18px;
      line-height: 1.35;
      margin: 0 0 10px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .card p {
      font-size: 15px;
      line-height: 1.62;
      color: var(--muted);
      margin: 0;
      max-width: none;
    }
    .signature {
      display: flex;
      align-items: flex-start;
      gap: 18px;
      margin-top: 48px;
      padding-top: 28px;
      max-width: 100%;
      border-top: 1px solid var(--line);
      font-family: var(--sans);
    }
    .sig-name {
      font-family: var(--serif);
      font-size: 21px;
      font-style: italic;
      margin-bottom: 2px;
    }
    .sig-role {
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .footer {
      padding: 42px 0 70px;
      border-top: 1px solid var(--line);
      color: var(--faint);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .footer .wrap {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: wrap;
    }

    /* Premium Code Blocks Overrides */
    pre {
      background: rgba(15, 23, 32, 0.5); /* Slate slate background for dark mode */
      border: 1px solid var(--line);
      border-left: 3px solid var(--teal);
      border-radius: 12px;
      padding: 20px;
      overflow-x: auto;
      margin: 24px 0;
      max-width: 100%;
    }
    [data-theme="light"] pre {
      background: rgba(24, 34, 42, 0.04); /* Soft cool gray for light mode */
    }
    code {
      font-family: var(--mono);
      font-size: 15px;
    }
    :not(pre) > code {
      background: rgba(20, 184, 166, 0.08);
      border: 1px solid rgba(20, 184, 166, 0.15);
      color: var(--teal);
      padding: 3px 6px;
      border-radius: 6px;
      font-size: 14.5px;
    }

    /* Table Design System */
    table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      margin: 32px 0;
      font-family: var(--sans);
      font-size: 15px;
      text-align: left;
    }
    th, td {
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
    }
    th {
      font-weight: 700;
      color: var(--teal);
      border-bottom: 2px solid var(--line2);
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.08em;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.01);
    }
    [data-theme="light"] tr:hover td {
      background: rgba(0, 0, 0, 0.005);
    }

    /* Table of Contents Styling */
    nav#TOC {
      margin: 40px 0;
      padding: 30px;
      background: var(--callout-bg);
      border: 1px solid var(--line2);
      border-radius: 20px;
      max-width: 100%;
    }
    nav#TOC ul {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }
    nav#TOC ul ul {
      padding-left: 20px;
      margin-top: 8px;
    }
    nav#TOC li {
      margin-bottom: 10px;
      font-family: var(--sans);
      font-size: 15px;
    }
    nav#TOC a {
      color: var(--muted);
      text-decoration: none;
      transition: color 0.2s;
    }
    nav#TOC a:hover {
      color: var(--teal);
    }

    figure {
      margin: 40px auto;
      max-width: 100%;
      text-align: center;
    }
    figcaption {
      margin-top: 14px;
      font-family: var(--sans);
      font-size: 14px;
      color: var(--faint);
      line-height: 1.5;
    }

    @media (max-width: 760px) {
      .wrap, .topbar-inner {
        width: min(100% - 36px, 800px);
      }
      body {
        font-size: 17.5px;
      }
      .navlink {
        display: none;
      }
      .brand span {
        display: none;
      }
      .hero {
        padding: 64px 0 76px;
      }
      section {
        padding: 54px 0;
      }
      .grid {
        grid-template-columns: 1fr;
      }
      .callout {
        padding: 28px;
        border-radius: 18px;
      }
      .pull {
        padding-left: 22px;
      }
    }

    @media print {
      :root, [data-theme] {
        --bg: #fbf8f1;
        --panel: #ffffff;
        --line: rgba(24, 34, 42, 0.16);
        --line2: rgba(24, 34, 42, 0.25);
        --text: #172024;
        --muted: #4d5a61;
        --faint: #6b767c;
        --teal: #0d766f;
        --warn: #bf4f35;
        --callout-bg: #fff;
        --card-bg: #fff;
        --timeline-bg: #fff;
        --contract-bg: #fff;
        --thesis-bg: #eef8f5;
        --topbar-bg: transparent;
      }
      body {
        background: #fbf8f1 !important;
        print-color-adjust: exact;
      }
      .topbar {
        position: static;
      }
      .actions {
        display: none;
      }
      section {
        page-break-inside: avoid;
      }
    }
    """

    # Add the CSS and favicon to the head tag
    head_tag = soup.find('head')
    if not head_tag:
        head_tag = soup.new_tag('head')
        soup.insert(0, head_tag)

    # Inject blocking FOUC-prevention script first in head
    fouc_script = soup.new_tag('script')
    fouc_script.string = """
    (function () {
      const saved = localStorage.getItem("hki-theme-preference");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved || (prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
      document.documentElement.setAttribute("data-theme", theme);
    })();
    """
    head_tag.insert(0, fouc_script)

    style_tag = soup.new_tag('style')
    style_tag.string = theme_css + "\n" + highlight_styles
    head_tag.append(style_tag)

    favicon_tag = soup.new_tag('link', rel='icon', type='image/svg+xml', href='favicon.svg')
    head_tag.append(favicon_tag)

    # Set data-theme via client script instead of hardcoded
    body_tag = soup.find('body')

    # Retrieve all children of the body to process
    body_children = list(body_tag.children) if body_tag else []

    # Filter out empty strings or basic formatting spacing elements
    meaningful_children = []
    for c in body_children:
        if isinstance(c, Comment):
            continue
        if str(c).strip():
            meaningful_children.append(c)

    # Locate special nodes
    toc_node = None
    title_node = None
    byline_nodes = []
    blockquote_node = None
    content_nodes = []

    # Analyze the initial portion to build the hero banner
    first_h2_idx = len(meaningful_children)
    for i, c in enumerate(meaningful_children):
        if c.name == 'h2':
            first_h2_idx = i
            break

    header_candidates = meaningful_children[:first_h2_idx]
    remaining_nodes = meaningful_children[first_h2_idx:]

    for c in header_candidates:
        if c.name == 'nav' and c.get('id') == 'TOC':
            toc_node = c
        elif c.name == 'h1':
            title_node = c
        elif c.name == 'blockquote':
            blockquote_node = c
        elif c.name == 'p':
            byline_nodes.append(c)
        else:
            content_nodes.append(c) # Fallback to placing in standard content

    # Structure topbar navigation
    topbar_html = f"""
    <nav class="topbar" aria-label="Article actions">
      <div class="topbar-inner">
        <a class="brand" href="#top" aria-label="Back to top">
          <svg width="26" height="26" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M16 3 L27 9.5 L27 22.5 L16 29 L5 22.5 L5 9.5 Z" fill="none" stroke="#14b8a6" stroke-width="1.6"/>
            <path d="M11.5 11 L11.5 21 M20.5 11 L20.5 21 M9.5 16 L22.5 16" stroke="#14b8a6" stroke-width="1.6" stroke-linecap="round" fill="none"/>
          </svg>
          <span>{"HKI Standard Spec" if is_standard else "HKI Executive Brief"}</span>
        </a>
        <div class="actions">
          <button class="theme-toggle" id="themeToggle" aria-label="Switch between dark and light theme">
            <svg id="themeIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span id="themeLabel">Light</span>
          </button>
          <a class="navlink" href="#main">Introduction</a>
          <a class="navlink" href="#tldr" style="display: inline-block;">{"TL;DR" if is_standard else "Contract"}</a>
          <a class="download" href="./{"HERMETIC-KNOWLEDGE-ISOLATION.pdf" if is_standard else "HKI-EXECUTIVE-BRIEF.pdf"}" download>Download PDF</a>
        </div>
      </div>
    </nav>
    """
    topbar_soup = BeautifulSoup(topbar_html, 'html.parser')

    # Construct the beautiful Hero component
    eyebrow_text = "Normative Standard Spec · HKI-1.0" if is_standard else "Enterprise Strategy Summary"
    title_text = title_node.get_text().strip() if title_node else ("Hermetic Knowledge Isolation (HKI)" if is_standard else "HKI Executive Brief")
    
    # Let's add some elegant italics if possible
    if "Isolation" in title_text:
        title_text = title_text.replace("Isolation", "<em>Isolation</em>")
    elif "Brief" in title_text:
        title_text = title_text.replace("Brief", "<em>Brief</em>")

    subtitle_text = "A Runtime Isolation Model for Enterprise Agentic Knowledge Systems" if is_standard else "Why Hermetic Knowledge Isolation is the foundational security boundary for autonomous enterprise systems."
    
    # We can extract a nice thesis block quote or construct a canonical one
    thesis_text = ""
    if is_standard:
        thesis_text = "<strong>The core thesis:</strong> an enterprise is only as secure as the data and context boundaries around its operational reasoning. Every runtime operation must execute inside exactly one named domain—no global visibility, no wildcard fallbacks, no silent cross-domain reads."
    else:
        thesis_text = "<strong>The executive summary:</strong> Most enterprise agent platforms claim stream-awareness, but isolation exists only as a retrieval filter. As autonomy increases, weak scope becomes a control failure. HKI turns isolation into a mandatory runtime label."

    byline_html = ""
    if is_standard:
        byline_html = """
        <div class="byline">
          <div>Author<strong>Henok Ghebrechristos, PhD</strong></div>
          <div>Perspective<strong>System security · Agentic RAG</strong></div>
          <div>Version<strong>Normative Standard · May 2026</strong></div>
        </div>
        """
    else:
        byline_html = """
        <div class="byline">
          <div>Author<strong>Henok Ghebrechristos, PhD</strong></div>
          <div>Perspective<strong>Enterprise AI Strategy</strong></div>
          <div>Version<strong>Executive Brief · May 2026</strong></div>
        </div>
        """

    hero_html = f"""
    <header id="top" class="hero">
      <div class="wrap">
        <div class="eyebrow">{eyebrow_text}</div>
        <h1>{title_text}</h1>
        <p class="subtitle">{subtitle_text}</p>
        <div class="thesis-line">
          {thesis_text}
        </div>
        {byline_html}
      </div>
    </header>
    """
    hero_soup = BeautifulSoup(hero_html, 'html.parser')

    # Decompose old header nodes from body
    if title_node:
        title_node.decompose()
    if blockquote_node:
        blockquote_node.decompose()
    for n in byline_nodes:
        n.decompose()

    # Create new body containers
    new_body = soup.new_tag('body')
    new_body['data-theme'] = 'dark'
    new_body.append(topbar_soup)
    new_body.append(hero_soup)

    main_tag = soup.new_tag('main', id='main')
    new_body.append(main_tag)

    # Insert Table of Contents right after the hero as Section 00 (highly premium reading layout)
    if toc_node:
        toc_section = soup.new_tag('section', id='table-of-contents')
        toc_wrap = soup.new_tag('div', attrs={'class': 'wrap'})
        toc_label = soup.new_tag('div', attrs={'class': 'section-label'})
        toc_label.string = "00 · Table of Contents"
        toc_wrap.append(toc_label)
        
        toc_heading = soup.new_tag('h2')
        toc_heading.string = "Document Sections"
        toc_wrap.append(toc_heading)
        
        toc_wrap.append(toc_node)
        toc_section.append(toc_wrap)
        main_tag.append(toc_section)

    # Now group all remaining elements into sections divided by h2 headers
    current_section = None
    current_wrap = None
    section_index = 1

    for node in remaining_nodes:
        # Check if we hit a section boundary
        if node.name == 'h2':
            # Close previous section if any
            if current_section:
                current_section.append(current_wrap)
                main_tag.append(current_section)
            
            # Start new section
            h2_id = node.get('id', f'section-{section_index}')
            h2_title = node.get_text().strip()
            
            current_section = soup.new_tag('section', id=h2_id)
            current_wrap = soup.new_tag('div', attrs={'class': 'wrap'})
            
            label_text = f"{section_index:02d} · {h2_title}"
            section_label = soup.new_tag('div', attrs={'class': 'section-label'})
            section_label.string = label_text
            current_wrap.append(section_label)
            
            # Style the section h2 nicely (adding em style if possible)
            new_h2 = soup.new_tag('h2')
            if ":" in h2_title:
                parts = h2_title.split(":", 1)
                new_h2.string = parts[0] + ":"
                em_tag = soup.new_tag('em')
                em_tag.string = parts[1]
                new_h2.append(em_tag)
            elif "and" in h2_title:
                parts = h2_title.split("and", 1)
                new_h2.append(parts[0] + "and ")
                em_tag = soup.new_tag('em')
                em_tag.string = parts[1].strip()
                new_h2.append(em_tag)
            else:
                new_h2.string = h2_title
            
            current_wrap.append(new_h2)
            section_index += 1
        else:
            # If node is not h2, add it to the active section
            if current_wrap:
                # Custom stylistic mappings
                if node.name == 'blockquote':
                    # Map blockquote to a beautiful pull quote style
                    node['class'] = node.get('class', []) + ['pull']
                elif node.name == 'table':
                    # Tables are styled globally, but let's make sure they are in a nice container or directly inside wrap
                    pass
                current_wrap.append(node)

    # Close the final section
    if current_section:
        current_section.append(current_wrap)
        main_tag.append(current_section)

    # Append Henok Ghebrechristos Signature Block at the bottom
    sig_section = soup.new_tag('section', attrs={'class': 'endnote'})
    sig_wrap = soup.new_tag('div', attrs={'class': 'wrap'})
    sig_html = f"""
    <div class="signature">
      <svg width="38" height="38" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M16 3 L27 9.5 L27 22.5 L16 29 L5 22.5 L5 9.5 Z" fill="none" stroke="#14b8a6" stroke-width="1.6"/>
        <path d="M11.5 11 L11.5 21 M20.5 11 L20.5 21 M9.5 16 L22.5 16" stroke="#14b8a6" stroke-width="1.6" stroke-linecap="round" fill="none"/>
      </svg>
      <div>
        <div class="sig-name">Henok Ghebrechristos, PhD</div>
        <div class="sig-role">
          {"Deep learning · industrial AI deployment · agentic systems" if is_standard else "Enterprise AI strategy · HKI isolation standards"}
        </div>
      </div>
    </div>
    """
    sig_wrap.append(BeautifulSoup(sig_html, 'html.parser'))
    sig_section.append(sig_wrap)
    main_tag.append(sig_section)

    # Footer
    footer_html = f"""
    <footer class="footer">
      <div class="wrap">
        <span>{"HKI Standard Spec" if is_standard else "HKI Executive Brief"} · May 2026</span>
        <span>Hermetic Domain Isolation — runtime context sovereignty</span>
      </div>
    </footer>
    """
    new_body.append(BeautifulSoup(footer_html, 'html.parser'))

    # Theme toggler script
    script_html = """
    <script>
      (function () {
        const html = document.documentElement;
        const toggle = document.getElementById("themeToggle");
        const icon = document.getElementById("themeIcon");
        const label = document.getElementById("themeLabel");

        function updateToggleUI(theme) {
          if (theme === "dark") {
            label.textContent = "Light";
            icon.innerHTML =
              '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
          } else {
            label.textContent = "Dark";
            icon.innerHTML =
              '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
          }
        }

        function setTheme(theme) {
          html.classList.toggle("dark", theme === "dark");
          html.classList.toggle("light", theme === "light");
          html.setAttribute("data-theme", theme);
          localStorage.setItem("hki-theme-preference", theme);
          updateToggleUI(theme);
        }

        if (toggle) {
          toggle.addEventListener("click", () => {
            const current = html.getAttribute("data-theme") || "dark";
            const next = current === "dark" ? "light" : "dark";
            setTheme(next);
          });
        }

        // Initialize toggle UI based on current class/attribute set by blocking head script
        const activeTheme = html.getAttribute("data-theme") || "dark";
        updateToggleUI(activeTheme);
      })();
    </script>
    """
    new_body.append(BeautifulSoup(script_html, 'html.parser'))

    # Replace the old body tag
    soup.body.replace_with(new_body)

    # Write out the beautifully styled and wrapped HTML page
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print("Done!")

if __name__ == "__main__":
    hki_pkg_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Standard Reading Spec
    standard_src = os.path.join(hki_pkg_dir, "HERMETIC-KNOWLEDGE-ISOLATION.html")
    standard_dest = standard_src # In-place overwrite as they are the direct sources inside package
    refactor_html_file(standard_src, standard_dest, is_standard=True)
    
    # 2. Executive Brief Spec
    brief_src = os.path.join(hki_pkg_dir, "HKI-EXECUTIVE-BRIEF.html")
    brief_dest = brief_src # In-place overwrite
    refactor_html_file(brief_src, brief_dest, is_standard=False)
