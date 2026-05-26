# External Fixture Compatibility Report

Accepted fixtures: 240
Official binary pass: 61
Official binary failed and treated as display/template-compatible: 66
Official binary not applicable: 113
Official binary missing during report generation: 0

## Accepted By Class

- display: 80
- display-extension: 33
- legacy: 95
- stable: 13
- stable-extension: 2
- testing: 1
- testing-extension: 16

## Accepted By Detected Version

- 1.11: 47
- 1.12: 48
- 1.13: 15
- 1.14: 17
- unknown: 113

## Official Check Failures By Version

- 1.11: 24
- 1.12: 24
- 1.13: 4
- 1.14: 14

## Notes

- Fixtures are deterministic snapshots from public GitHub repositories.
- Secrets and credentials are redacted during ingestion.
- Empty selector/urltest provider pools and `{all}` subscription placeholders are expanded into mock SOCKS outbounds.
- `official_check` is set only when the matching sing-box binary accepts the checked-in fixture with `sing-box check`.
- Versioned fixtures that fail official checks remain accepted only for UI/import/display gates and carry `official_check_result.status = failed` with the failure reason in `manifest.json`.
- Rejected candidates do not count toward the 200 accepted fixture goal.
