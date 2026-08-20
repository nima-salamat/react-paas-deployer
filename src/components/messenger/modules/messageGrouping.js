/**
 * Consecutive same-sender grouping (Telegram-style).
 * Only the last message in a run shows the avatar + bubble tail.
 */
export function getSenderGroupFlags(messagesWithDays, index) {
  const m = messagesWithDays[index];
  let isLastInSenderGroup = true;
  let isFirstInSenderGroup = true;
  if (!m || m.type !== "msg" || m.is_system) {
    return { isFirstInSenderGroup, isLastInSenderGroup };
  }
  const sid = String(m.sender?.id ?? "");
  const prev = messagesWithDays[index - 1];
  const next = messagesWithDays[index + 1];
  if (prev && prev.type === "msg" && !prev.is_system && String(prev.sender?.id ?? "") === sid) {
    isFirstInSenderGroup = false;
  }
  if (next && next.type === "msg" && !next.is_system && String(next.sender?.id ?? "") === sid) {
    isLastInSenderGroup = false;
  }
  return { isFirstInSenderGroup, isLastInSenderGroup };
}
