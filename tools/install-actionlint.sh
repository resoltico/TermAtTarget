#!/usr/bin/env bash
# Run on the Linux amd64 Actions runner after checking out the repository.
set -euo pipefail

version=1.7.12
sha256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
archive="actionlint_${version}_linux_amd64.tar.gz"
destination=$(mktemp -d "$RUNNER_TEMP/actionlint.XXXXXX")
cd "$destination"
curl --fail --silent --show-error --location --output "$archive" \
  "https://github.com/rhysd/actionlint/releases/download/v$version/$archive"
printf '%s  %s\n' "$sha256" "$archive" | sha256sum --check
tar -xzf "$archive" actionlint
"./actionlint" --version
printf '%s\n' "$destination" >> "$GITHUB_PATH"
