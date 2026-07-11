export const targetBinaries = {
  "1.12-stable": "sing-box-1.12",
  "1.13-stable": "sing-box-stable",
  "1.14-testing": "sing-box-testing",
};

export const versionBinaries = {
  "1.12": "sing-box-1.12",
  "1.13": "sing-box-stable",
  "1.14": "sing-box-testing",
};

export function binaryForDetectedVersion(version) {
  return versionBinaries[version] ?? null;
}

export function binaryForFixturePath(file, channel) {
  if (channel === "testing") return targetBinaries["1.14-testing"];
  if (/\b1\.12\b|legacy/i.test(file)) return targetBinaries["1.12-stable"];
  return targetBinaries["1.13-stable"];
}

// Platform-specific fixtures carry an explicit suffix so local validation never pretends a Linux-only
// config is portable. The Ubuntu release gate still checks every `.linux.json` fixture with the real
// matched binary; other hosts report the skip instead of weakening official validation silently.
export function requiredFixturePlatform(file) {
  if (/\.linux\.json$/i.test(file)) return "linux";
  return null;
}
