# Releases and packages

**v0.19.10** is the latest release. You can read the [release notes](/releases/v0.19.10) or get the files from the [GitHub release](https://github.com/AuthorShin/homelab-atlas/releases/tag/v0.19.10). The [v0.19.9 release notes](/releases/v0.19.9) and [v0.19.8 release notes](/releases/v0.19.8) remain available. A release is published only after its tests, docs, image, and downloads pass the release workflow.

Release notes for earlier versions are kept for reference. They describe the upstream releases they were written for, and not every feature mentioned there is part of the current build.

## Release assets

| Asset | Platforms | Purpose |
|---|---|---|
| `ghcr.io/authorshin/homelab-atlas:0.19.10` | Linux AMD64, ARM64 | Published editor and dashboard image |
| `ghcr.io/authorshin/homelab-atlas-vectorizer:0.19.10` | Linux AMD64, ARM64 | Raster-to-SVG tracing service |
| `homelab-atlas-0.19.10.zip` | Go 1.26+, Node 22.19+ and a current browser | App source, vectorizer source, deployment files, README, and notices |
| `compose.release.yaml` | Docker Compose v2 | Runs the released image with the standard safety settings |
| `SHA256SUMS` | Linux/macOS | Integrity checks for the ZIP and Compose file |

Download release files from the [GitHub releases page](https://github.com/AuthorShin/homelab-atlas/releases). The [package page](https://github.com/users/AuthorShin/packages/container/package/homelab-atlas) lists the Docker image versions.

## Verify downloads

Put the ZIP, Compose file, and `SHA256SUMS` in the same directory.

Linux:

```sh
sha256sum -c SHA256SUMS
```

macOS:

```sh
shasum -a 256 -c SHA256SUMS
```

Both covered files must report `OK`.

## Container tags and digests

| Tag | Behavior |
|---|---|
| `0.19.10` | Exact stable release |
| `v0.19.10` | Exact stable release, matching the Git tag |
| `0.19` | Newest stable patch in the 0.19 line |
| `latest` | Newest stable release |

Both published images use the same version tags. The exact version tags keep pointing to the same release. The `0.19` and `latest` tags move when a newer matching release is published. If you need an image reference that cannot move, get the verified manifest digest from the registry or successful release workflow. Replace the colon and tag after the image name with `@` followed by that `sha256:` digest.

## Maintainer checklist

1. Update the version in the root `package.json`, the default image tag in `deploy/compose.release.yaml`, `docs/releases/vVERSION.md`, and `docs/changelog.md`.
2. Run `npm test`, the release-file tests, both Compose checks, and the docs build.
3. Make sure the release notes match the version and only describe behavior that exists. Refresh version-specific ZIP command examples for the new release layout.
4. Commit on `main`, create a strict stable tag in the form `vMAJOR.MINOR.PATCH`, and push it.
5. Watch the whole release workflow: validation, multi-architecture image publishing, anonymous image verification, and GitHub release creation.

The first time each image is published to GHCR, GitHub may make its package private. Make both `homelab-atlas` and `homelab-atlas-vectorizer` public, then rerun only the failed **Publish GitHub release** job. The workflow will not create the release until anyone can pull the versioned image, both architectures are present, and the digest matches the image it built.
