import { sortAndDedupeMessages } from '../utils/messageOrder';

type QueueMessage = {
  id?: string | number;
  date?: string | number | Date;
  text?: unknown;
  sent?: boolean;
};

export const mergeMessageBatches = <T extends QueueMessage>(...batches: T[][]): T[] => {
  return sortAndDedupeMessages(batches.flat());
};

export const appendIncomingMessage = <T extends QueueMessage>(
  current: T[],
  incoming: T,
  options?: { limit?: number }
): T[] => {
  const merged = mergeMessageBatches(current, [incoming]);
  const limit = options?.limit;
  if (!limit || limit <= 0) return merged;
  return merged.slice(-limit);
};
