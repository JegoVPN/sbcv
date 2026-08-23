import type { RuleSetConfig } from "./types";

export function ruleSetTags(value: RuleSetConfig["tag"] | unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of values) {
    if (typeof candidate !== "string" || candidate.trim() === "" || seen.has(candidate)) continue;
    seen.add(candidate);
    tags.push(candidate);
  }
  return tags;
}

export function ruleSetHasTag(value: RuleSetConfig["tag"] | unknown, tag: string): boolean {
  return ruleSetTags(value).includes(tag);
}

export function primaryRuleSetTag(value: RuleSetConfig["tag"] | unknown): string | undefined {
  return ruleSetTags(value)[0];
}

export function ruleSetTagLabel(value: RuleSetConfig["tag"] | unknown): string | undefined {
  const tags = ruleSetTags(value);
  return tags.length ? tags.join(", ") : undefined;
}

export function renameRuleSetTagValue(
  value: RuleSetConfig["tag"] | unknown,
  oldTag: string,
  newTag: string,
): RuleSetConfig["tag"] | unknown {
  if (Array.isArray(value)) {
    return value.map((tag) => (tag === oldTag ? newTag : tag));
  }
  return value === oldTag ? newTag : value;
}
