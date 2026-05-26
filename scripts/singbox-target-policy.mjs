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
