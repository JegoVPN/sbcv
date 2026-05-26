const warningLinePattern =
  /\b(warn|warning|deprecated|deprecation|will be removed|will be deprecated|legacy|obsolete)\b|弃用|废弃|移除/i;

export function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

export function normalizeSingBoxOutput(stdout = "", stderr = "") {
  return stripAnsi([stdout, stderr].filter(Boolean).join("\n")).trim();
}

export function findSingBoxWarningLines(output) {
  return stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && warningLinePattern.test(line));
}

export function sanitizeSingBoxMessage(value, limit = 720) {
  return stripAnsi(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function evaluateSingBoxCheck({ status, stdout = "", stderr = "" }) {
  const output = normalizeSingBoxOutput(stdout, stderr);
  const warningLines = findSingBoxWarningLines(output);

  if (status !== 0) {
    return {
      ok: false,
      status: "failed",
      reason: sanitizeSingBoxMessage(output || `sing-box exited with status ${status}`),
    };
  }

  if (warningLines.length > 0) {
    return {
      ok: false,
      status: "warning",
      reason: sanitizeSingBoxMessage(warningLines.join("\n")),
    };
  }

  return {
    ok: true,
    status: "pass",
    reason: "",
  };
}

export function assertCleanSingBoxCheck({ binary, file, status, stdout = "", stderr = "" }) {
  const result = evaluateSingBoxCheck({ status, stdout, stderr });
  if (!result.ok) {
    throw new Error(`${binary} check ${result.status} for ${file}\n${result.reason}`);
  }
}
