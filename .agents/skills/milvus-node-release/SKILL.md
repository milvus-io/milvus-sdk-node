---
name: milvus-node-release
description: Prepare, stage, verify, or troubleshoot a release of the Milvus Node.js SDK on GitHub and npm, including npm dist-tags and maintainer approval.
---

# Milvus Node.js SDK release

Use the repository root and consult [AGENTS.md](../../../AGENTS.md) for DCO and SDK checks. Read [.github/workflows/release.yml](../../../.github/workflows/release.yml) on the intended release ref, especially for a maintenance branch. Check the current state before changing it when the request concerns an existing release.

## Prepare the candidate

1. Identify the intended branch, SDK version, and npm channel. Inspect the previous release on that channel, existing Git tags and GitHub Releases, and `npm dist-tag ls @zilliz/milvus2-sdk-node --prefer-online`. Check the exact version on npm before attempting to submit it.
2. Set `package.json.version` to the intended SDK version. Keep `milvusVersion` tied to the target Milvus server version. Review the changes since the previous release on that channel and write notes that call out user-visible changes and server compatibility. Refresh affected guides, examples, or release notes when the release includes documentation updates.
3. Run the appropriate SDK checks and verify CI for the candidate. A package-content preflight can run on the candidate ref with the command below. It builds the SDK and runs `npm pack --dry-run`. Its result verifies package contents.

   ```bash
   gh workflow run release.yml --ref "$candidate_ref" -f dry_run=true
   ```

4. Land the signed-off version bump on the target branch. Verify that the release commit is on that branch and that its manifest version matches the intended `v<version>` tag. If the tag already exists, verify its commit before proceeding. Use the reviewed commit as the target when creating a tag.

## Stage and approve

1. Publish the GitHub Release for the verified tag. For a stable release intended to become latest, use the reviewed commit and prepared notes:

   ```bash
   gh release create "$release_tag" --target "$release_commit" \
     --title "Release $release_tag" --notes-file "$notes_file" --latest
   ```

   Use `--prerelease` in place of `--latest` for a prerelease, or `--latest=false` for a stable maintenance release that should stay off `latest`. The `published` event triggers npm staging via Trusted Publishing. The workflow maps prereleases to `next`, the GitHub release designated latest to `latest`, and other stable releases to `release-<major>.<minor>`. Manual submissions with `dry_run=false` use the supplied `npm_tag`.

2. Check the Actions summary for the package version, dist-tag, and Stage ID. A successful run here means **staged for approval**. A package maintainer reviews the submission and approves it through npm's Staged Packages UI or `npm stage approve <stage-id>`, using npm 2FA. [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
3. If the workflow fails or the public registry returns 404, check the workflow summary and look for an existing submission before attempting another write. An `E409` naming a previously staged version means the maintainer should inspect that submission. Stage inspection and approval require interactive maintainer access. If that access is unavailable, report the Stage ID or workflow link and the pending approval. [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)

## Verify the public release

Set `version` and `dist_tag` to the version and channel from the release run:

```bash
package=@zilliz/milvus2-sdk-node
npm view "$package@$version" version --prefer-online
npm view "$package@$dist_tag" version --prefer-online
```

Both commands should return the expected SDK version. Smoke-install the exact public version in a temporary consumer project and load the SDK entry point when verifying an actual release. Report the GitHub Release, Actions run, and public npm status. If the package is still staged, report that status and the outstanding approval.
