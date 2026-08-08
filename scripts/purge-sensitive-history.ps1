param(
  [Parameter(Mandatory = $true)]
  [string]$BackupBundlePath
)

$ErrorActionPreference = 'Stop'

if (git status --porcelain) {
  throw 'Working tree is not clean. Commit or safely preserve every change before rewriting history.'
}

git filter-repo --version *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'git-filter-repo is required. Install it from its official project before continuing.'
}

$resolvedRepository = (Resolve-Path '.').Path
$resolvedBackup = [System.IO.Path]::GetFullPath($BackupBundlePath)
if ($resolvedBackup.StartsWith($resolvedRepository, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Backup bundle must be outside the repository being rewritten.'
}

git bundle create $resolvedBackup --all
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $resolvedBackup)) {
  throw 'Verified backup bundle could not be created. History was not changed.'
}

git filter-repo --force --path api/db.json --invert-paths
if ($LASTEXITCODE -ne 0) {
  throw 'History rewrite failed. Keep the backup bundle and inspect the repository before continuing.'
}

$remaining = git rev-list --all --objects | Select-String -SimpleMatch 'api/db.json'
if ($remaining) {
  throw 'Sensitive path still exists in Git objects. Do not push this repository.'
}

Write-Host 'Local history is clean and the backup bundle is:' $resolvedBackup
Write-Host 'Review branches/tags, then coordinate a force-push and require every collaborator to clone again.'
