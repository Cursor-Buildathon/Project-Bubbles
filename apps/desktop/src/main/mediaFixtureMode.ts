export function shouldUseMiniMaxMediaFixture(env: Record<string, string | undefined>) {
  const value = env.BUBBLES_MINIMAX_MEDIA_FIXTURE?.trim().toLowerCase();

  return value === 'true' || value === '1' || value === 'yes';
}
