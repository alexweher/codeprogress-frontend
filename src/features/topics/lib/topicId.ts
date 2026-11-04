export function parseTopicId(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const topicId = Number(value);
  return Number.isSafeInteger(topicId) ? topicId : null;
}
