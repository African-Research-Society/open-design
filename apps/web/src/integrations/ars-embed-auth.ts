export function planArsEmbedAuth(input: {
  announced: boolean;
  status: number;
}): 'ready' | 'expire' | 'wait' {
  if (input.status >= 200 && input.status < 300) {
    return input.announced ? 'wait' : 'ready';
  }
  if (input.announced && (input.status === 401 || input.status === 403)) {
    return 'expire';
  }
  return 'wait';
}
