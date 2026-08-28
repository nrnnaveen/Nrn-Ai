import { renderMarkdown } from './markdown.js';

let activeAbortController = null;

export function isStreaming() {
  return activeAbortController !== null;
}

export function cancelStreaming() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

export async function consumeSSEStream({
  url,
  method = 'POST',
  body = null,
  onStart,
  onChunk,
  onComplete,
  onError
}) {
  cancelStreaming(); // Abort any existing stream
  activeAbortController = new AbortController();

  if (onStart) onStart();

  const options = {
    method,
    headers: {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    signal: activeAbortController.signal,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let accumulatedText = '';

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorDetail = 'Failed to connect to AI stream.';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete trailing line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const rawJson = trimmed.substring(6).trim();
        if (rawJson === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(rawJson);
          if (parsed.delta) {
            accumulatedText += parsed.delta;
            if (onChunk) onChunk(accumulatedText, parsed.delta);
          }
          if (parsed.done) {
            if (onComplete) onComplete(accumulatedText, parsed);
            activeAbortController = null;
            return;
          }
        } catch (e) {
          console.warn('Failed to parse SSE chunk:', rawJson, e);
        }
      }
    }

    if (onComplete) {
      onComplete(accumulatedText, { done: true });
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      if (onComplete) {
        onComplete(accumulatedText, { done: true, aborted: true });
      }
    } else {
      if (onError) {
        onError(err);
      }
    }
  } finally {
    activeAbortController = null;
  }
}
