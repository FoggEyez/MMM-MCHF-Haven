# Haven troubleshooting

- The default HTTPS probe checks reachability and response time; it does not measure connection bandwidth.
- Optional snapshots must follow examples/network-snapshot.json. Missing totals or device classifications are shown as unavailable, not invented.
- A stale snapshot cannot establish current router health. Adjust pollSeconds and staleSeconds for your collector and network.

Use the README for settings, dependencies, privacy and sources. For a bug report, include your device, MagicMirror and Node versions, the observed behavior and a minimal configuration with secrets removed. Do not post private feeds, tokens, precise home coordinates or network snapshots.
