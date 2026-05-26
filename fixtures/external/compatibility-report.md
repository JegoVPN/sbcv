# External Fixture Compatibility Report

Accepted fixtures: 240
Rejected/quarantined candidates: 192

## Accepted By Class

- display: 80
- display-extension: 33
- legacy: 95
- stable: 13
- stable-extension: 2
- testing: 1
- testing-extension: 16

## Notes

- Fixtures are deterministic snapshots from public GitHub repositories.
- Secrets and credentials are redacted during ingestion.
- Empty selector/urltest provider pools and `{all}` subscription placeholders are expanded into mock SOCKS outbounds.
- Fixture generation is capped at 240 accepted fixtures and 30 accepted fixtures per source repository to keep CI bounded.
- `official_check` is `null` until a fixture is classified as version-matched official-compatible.
- Rejected candidates do not count toward the 200 accepted fixture goal.
