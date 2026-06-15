export function splitMessage(text: string, maxLength = 2000): string[] {
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new Error('maxLength must be a positive integer');
  }

  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const splitAt = findSplitIndex(remaining, maxLength);
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();

    // Guard against a zero-length advance that would loop forever.
    if (splitAt === 0) {
      chunks.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength).trimStart();
    }
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function findSplitIndex(text: string, maxLength: number): number {
  // Prefer paragraph boundaries.
  const paragraphBoundary = text.lastIndexOf('\n\n', maxLength);
  if (paragraphBoundary > 0) {
    return paragraphBoundary;
  }

  // Fall back to sentence boundaries.
  const sentenceBoundary = findLastSentenceBoundary(text, maxLength);
  if (sentenceBoundary > 0) {
    return sentenceBoundary;
  }

  // Fall back to word boundaries.
  const wordBoundary = text.lastIndexOf(' ', maxLength);
  if (wordBoundary > 0) {
    return wordBoundary;
  }

  // Hard split as a last resort.
  return maxLength;
}

function findLastSentenceBoundary(text: string, maxLength: number): number {
  for (let i = maxLength; i > 0; i--) {
    if (
      (text[i] === ' ' || text[i] === '\n') &&
      (text[i - 1] === '.' || text[i - 1] === '!' || text[i - 1] === '?')
    ) {
      return i;
    }
  }
  return -1;
}
