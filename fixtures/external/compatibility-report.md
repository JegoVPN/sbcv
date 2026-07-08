# External Fixture Compatibility Report

Accepted fixtures: 237
Official binary pass: 42
Official binary warning and treated as display/template-compatible: 2
Official binary failed and treated as display/template-compatible: 49
Official binary not applicable: 144
Official binary missing during report generation: 0

## Accepted By Class

- display: 73
- display-extension: 29
- legacy: 87
- stable: 14
- stable-extension: 1
- testing: 17
- testing-extension: 16

## Accepted By Detected Version

- 1.11: 42
- 1.12: 45
- 1.13: 15
- 1.14: 33
- unknown: 102

## Official Check Failures By Version

- 1.12: 22
- 1.13: 4
- 1.14: 25

## Notes

- Fixtures are deterministic snapshots from public GitHub repositories.
- Secrets and credentials are redacted during ingestion.
- Empty selector/urltest provider pools and `{all}` subscription placeholders are expanded into mock SOCKS outbounds.
- `official_check` is set only when the matching sing-box binary accepts the checked-in fixture with `sing-box check` and emits no warning/deprecation output.
- Versioned fixtures that fail or warn in official checks remain accepted only for UI/import/display gates and carry `official_check_result.status = failed` or `warning` with the reason in `manifest.json`.
- Rejected candidates do not count toward the 200 accepted fixture goal.
