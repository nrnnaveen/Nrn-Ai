import { icons } from './ui.js';

/**
 * Robust, secure markdown parser with syntax highlighting and Copy button.
 * Fully sanitizes HTML and enforces protocol allowlists on links to prevent XSS.
 */

function escapeRawHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(rawUrl) {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  // Strictly allow http, https, mailto, and relative paths. Block javascript:, data:, vbscript:
  if (/^(https?:\/\/|\/|mailto:)/i.test(trimmed)) {
    return escapeRawHtml(trimmed);
  }
  return '#';
}

function highlightSyntax(code, lang) {
  let safe = escapeRawHtml(code);
  
  if (!lang) return safe;
  lang = lang.toLowerCase().trim();

  if (['js', 'javascript', 'ts', 'typescript', 'json'].includes(lang)) {
    // Strings
    safe = safe.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '<span class="hl-string">$&</span>');
    // Keywords
    safe = safe.replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|new|try|catch|switch|case|break|default|typeof|instanceof)\b/g, '<span class="hl-keyword">$1</span>');
    // Numbers
    safe = safe.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="hl-number">$1</span>');
    // Comments
    safe = safe.replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>');
  } else if (['py', 'python'].includes(lang)) {
    // Strings
    safe = safe.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="hl-string">$&</span>');
    // Keywords
    safe = safe.replace(/\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|with|async|await|lambda|pass|yield|in|is|not|and|or)\b/g, '<span class="hl-keyword">$1</span>');
    // Builtins
    safe = safe.replace(/\b(print|len|range|str|int|float|list|dict|set|tuple|enumerate|zip|open)\b/g, '<span class="hl-builtin">$1</span>');
    // Numbers
    safe = safe.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="hl-number">$1</span>');
    // Comments
    safe = safe.replace(/(#[^\n]*)/g, '<span class="hl-comment">$1</span>');
  }

  return safe;
}

export function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  const codeBlocks = [];

  // 1. Extract fenced code blocks first to protect them from inline parsing
  let processed = markdownText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `%%CODE_BLOCK_${codeBlocks.length}%%`;
    codeBlocks.push({ lang: lang || 'code', code: code.replace(/\n$/, '') });
    return placeholder;
  });

  // 2. Escape raw HTML everywhere else
  processed = escapeRawHtml(processed);

  // 3. Extract tables
  processed = processed.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableMatch) => {
    const lines = tableMatch.trim().split('\n').map(l => l.trim());
    if (lines.length < 2) return tableMatch;

    const parseRow = (rowStr) => {
      const cells = rowStr.split('|').slice(1, -1);
      return cells.map(c => c.trim());
    };

    const headerCells = parseRow(lines[0]);
    const bodyRows = lines.slice(2).map(parseRow);

    let html = '<table><thead><tr>';
    headerCells.forEach(cell => {
      html += `<th>${cell}</th>`;
    });
    html += '</tr></thead><tbody>';
    bodyRows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  });

  // 4. Headers
  processed = processed.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  processed = processed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  processed = processed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  processed = processed.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 5. Blockquotes
  processed = processed.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 6. Bold & Italic
  processed = processed.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  processed = processed.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  processed = processed.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // 7. Inline code
  processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 8. Markdown Links (Secure URL validation)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    const safeHref = sanitizeUrl(url);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="markdown-link">${linkText}</a>`;
  });

  // 9. Unordered Lists
  processed = processed.replace(/(?:^[ \t]*[\*\-][ \t]+(.*?)(?:\r?\n|$))+/gm, (listMatch) => {
    const items = listMatch.trim().split('\n').map(item => {
      return `<li>${item.replace(/^[ \t]*[\*\-][ \t]+/, '')}</li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  });

  // 10. Ordered Lists
  processed = processed.replace(/(?:^[ \t]*\d+\.[ \t]+(.*?)(?:\r?\n|$))+/gm, (listMatch) => {
    const items = listMatch.trim().split('\n').map(item => {
      return `<li>${item.replace(/^[ \t]*\d+\.[ \t]+/, '')}</li>`;
    }).join('');
    return `<ol>${items}</ol>`;
  });

  // 11. Paragraphs & Line Breaks
  const paragraphs = processed.split(/\n{2,}/);
  processed = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h1>') || p.startsWith('<h2>') || p.startsWith('<h3>') || p.startsWith('<h4>') ||
        p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<blockquote>') ||
        p.startsWith('<table>') || p.startsWith('%%CODE_BLOCK_')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  // 12. Reinsert Code Blocks with Copy button and syntax highlighting
  codeBlocks.forEach((block, idx) => {
    const placeholder = `%%CODE_BLOCK_${idx}%%`;
    const highlighted = highlightSyntax(block.code, block.lang);
    const rawEncoded = encodeURIComponent(block.code);
    
    const blockHtml = `
      <div class="code-block-container">
        <div class="code-block-header">
          <span>${escapeRawHtml(block.lang)}</span>
          <button class="code-copy-btn" data-code="${rawEncoded}" aria-label="Copy code">
            ${icons.copy}
            <span>Copy</span>
          </button>
        </div>
        <pre><code class="language-${escapeRawHtml(block.lang)}">${highlighted}</code></pre>
      </div>
    `;
    processed = processed.replace(placeholder, blockHtml);
  });

  return processed;
}

// Global event delegation for copy buttons
document.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('.code-copy-btn');
  if (!copyBtn) return;

  const rawEncoded = copyBtn.getAttribute('data-code');
  if (!rawEncoded) return;

  try {
    const textToCopy = decodeURIComponent(rawEncoded);
    await navigator.clipboard.writeText(textToCopy);
    
    const labelSpan = copyBtn.querySelector('span');
    const originalText = labelSpan ? labelSpan.textContent : 'Copy';
    
    copyBtn.innerHTML = `${icons.check} <span>Copied</span>`;
    
    setTimeout(() => {
      copyBtn.innerHTML = `${icons.copy} <span>${originalText}</span>`;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
});
