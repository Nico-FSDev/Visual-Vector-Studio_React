# Implementation Plan: Fix GitHub Actions Artifact Storage Quota Failure

## 1. Problem Analysis & Root Cause

The GitHub Actions CI/CD workflow (`.github/workflows/build-apk.yml`) was failing at the `Cache Web Build Output` step with:
```
Error: Failed to CreateArtifact: Artifact storage quota has been hit. Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

### Why this happened:
1. **Unnecessary Inter-Job Artifact Upload**: The workflow was split into separate runner jobs (`build-web` and `build-android`). To pass the compiled `dist/` folder from Job 2 to Job 3, the workflow used `actions/upload-artifact@v4` (`name: web-dist-assets`).
2. **Account Artifact Quota Limit**: Free GitHub accounts share a 500 MB artifact storage limit across all repositories. Once exceeded, any call to `actions/upload-artifact` threw an unhandled fatal error and immediately aborted the pipeline.
3. **Double Execution Overhead**: Running `build-web` and `build-android` on separate VMs incurred redundant checkouts, redundant `npm install` steps (consuming runner minutes), and introduced a fragile network dependency on GitHub's artifact storage.

---

## 2. Implemented Architectural Solution

1. **Consolidated Web & Android Builds into a Single Job**:
   - Merged `build-web` and `build-android` into a unified `build-android` job running on a single Ubuntu runner.
   - Sequence:
     1. Checkout repository & setup Node.js 22
     2. Install dependencies once (`npm ci --legacy-peer-deps`)
     3. Run Web production build (`npm run build`), generating `dist/` directly on disk
     4. Setup Java JDK 21 (Temurin) & Android SDK
     5. Sync Capacitor natively (`npx cap sync android`) taking `dist/` directly from disk with zero artifact downloads
     6. Assemble & Sign Debug and Release APKs & AAB
     7. Calculate SHA-256 Checksums
   - **Result**: Completely removed `actions/upload-artifact@v4` for `web-dist-assets` and `actions/download-artifact@v4`.

2. **Non-Blocking Fallback on Final Binary Uploads (`continue-on-error: true`)**:
   - Added `continue-on-error: true` to all remaining `actions/upload-artifact@v4` steps:
     - `Upload Debug Artifacts` (`continue-on-error: true`)
     - `Upload Release Artifacts & SHA-256 Checksums` (`continue-on-error: true`)
     - `Upload Build Diagnostics on Failure` (`continue-on-error: true`)
   - **Result**: If GitHub's artifact storage quota is full, a warning is logged, but the workflow **succeeds** instead of failing.

3. **Direct GitHub Releases Publication on Tags**:
   - Added direct release publishing using `softprops/action-gh-release@v2` inside the build job when triggered by a tag (`v*`).
   - GitHub Releases storage is separate from Actions artifact storage, ensuring release tags always get binary downloads even when artifact storage is full.

---

## 3. Verification

- [x] Consolidate `build-web` and `build-android` in `.github/workflows/build-apk.yml`.
- [x] Remove intermediate `web-dist-assets` upload and download steps.
- [x] Add `continue-on-error: true` to debug, release, and diagnostic artifact uploads.
- [x] Configure direct release publishing on tags.
- [x] Verify YAML syntax and indentation.
- [x] Run applet lint (`npm run lint`) and compilation (`npm run build`).
