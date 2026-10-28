/** Injected wherever "now" matters (session/invite expiry, rate limits) so tests can control time. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
