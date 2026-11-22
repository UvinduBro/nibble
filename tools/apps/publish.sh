#!/usr/bin/env bash
# Publishes finished app files to one place, used by the store/phone workflows:
#   - the files → GitHub release "app-files" (stable links: .../releases/download/app-files/<file>; never marked "latest",
#     because the website's Mac download reads the latest release)
#   - an index → branch "apps" (README.md + data/<platform>.json): what's there, version, build, signed or not.
# usage: tools/apps/publish.sh <windows|mac|android|ios> <version> <build> <signed: yes|no> [files...]
set -euo pipefail
export PYTHONUTF8=1  # Windows runners default to cp1252
PLATFORM="$1"; VERSION="$2"; BUILD="$3"; SIGNED="$4"; shift 4
REPO="${GITHUB_REPOSITORY:-UvinduBro/nibble}"
TAG="app-files"   # release tag (must differ from the branch name, or git confuses the two)
BRANCH_OUT="apps" # index branch
PY="$(command -v python3 || command -v python)"
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMIT="${GITHUB_SHA:-$(git rev-parse HEAD)}"
BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${REPO}/actions/runs/${GITHUB_RUN_ID:-0}"

# the first version used a release tag called "apps", the same name as the index branch (git mixed them up)
if gh release view apps -R "$REPO" >/dev/null 2>&1; then gh release delete apps -R "$REPO" --cleanup-tag -y || true; fi

# 1. files → release
if ! gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  gh release create "$TAG" -R "$REPO" --title "Nibble app files" --notes "Store and phone app files. See the apps branch for the index." --latest=false
fi
FILES_JSON="[]"
if [ "$#" -gt 0 ]; then
  gh release upload "$TAG" -R "$REPO" "$@" --clobber
  FILES_JSON="$("$PY" - "$REPO" "$TAG" "$@" <<'PYEOF'
import hashlib, json, os, sys
repo, tag, files = sys.argv[1], sys.argv[2], sys.argv[3:]
out = []
for f in files:
    h = hashlib.sha256()
    with open(f, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    name = os.path.basename(f)
    out.append({'name': name, 'size': os.path.getsize(f), 'sha256': h.hexdigest(),
                'url': f'https://github.com/{repo}/releases/download/{tag}/{name}'})
print(json.dumps(out))
PYEOF
)"
fi

# 2. index → branch "apps" (retries: the four workflows can finish at the same moment)
WORK="$(mktemp -d)"
git init --quiet "$WORK"
git -C "$WORK" remote add origin "${PUBLISH_REMOTE:-https://x-access-token:${GH_TOKEN:-}@github.com/${REPO}.git}"
git -C "$WORK" config user.name "github-actions[bot]"
git -C "$WORK" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
# always the branch (refs/heads/...), never a tag of the same name
if git -C "$WORK" fetch --quiet --depth 1 origin "refs/heads/$BRANCH_OUT" 2>/dev/null; then
  git -C "$WORK" checkout --quiet -B "$BRANCH_OUT" FETCH_HEAD
else
  git -C "$WORK" checkout --quiet --orphan "$BRANCH_OUT"  # first run: a branch with only the index
fi
for attempt in 1 2 3 4 5 6; do
  mkdir -p "$WORK/data"
  "$PY" - "$WORK/data/$PLATFORM.json" "$PLATFORM" "$VERSION" "$BUILD" "$SIGNED" "$COMMIT" "$BRANCH" "$RUN_URL" "$FILES_JSON" <<'PYEOF'
import json, sys, datetime
path, platform, version, build, signed, commit, branch, run, files = sys.argv[1:]
json.dump({'platform': platform, 'version': version, 'build': build, 'signed': signed == 'yes', 'commit': commit,
           'branch': branch, 'run': run, 'date': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
           'files': json.loads(files)}, open(path, 'w', encoding='utf-8'), indent=2)
PYEOF
  "$PY" "$HERE/index.py" "$WORK"
  # this branch is only an index: tell Vercel not to try to build it as the website
  printf '{\n  "git": { "deploymentEnabled": false }\n}\n' > "$WORK/vercel.json"
  git -C "$WORK" add -A
  git -C "$WORK" commit --quiet -m "apps: $PLATFORM $VERSION (build $BUILD)" || { echo "index unchanged"; break; }
  if git -C "$WORK" push --quiet origin "HEAD:refs/heads/$BRANCH_OUT"; then echo "index updated"; break; fi
  # someone else pushed first: take theirs, then write ours again
  sleep $((attempt * 3))
  git -C "$WORK" fetch --quiet --depth 1 origin "refs/heads/$BRANCH_OUT"
  git -C "$WORK" reset --quiet --hard FETCH_HEAD
done
gh release edit "$TAG" -R "$REPO" --notes-file "$WORK/README.md" --latest=false >/dev/null || true
rm -rf "$WORK"
