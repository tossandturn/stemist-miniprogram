param(
  [Parameter(Mandatory)][string]$Version,
  [Parameter(Mandatory)][string]$Description,
  [switch]$PrepareOnly,
  [string]$DeveloperToolsCli='D:\微信web开发者工具\cli.bat'
)
$ErrorActionPreference='Stop'
$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$repo=Split-Path -Parent $PSScriptRoot
$workspace=Split-Path -Parent $repo
$ledgerPath=Join-Path $repo 'releases\development.json'
$ledger=Get-Content -LiteralPath $ledgerPath -Raw -Encoding utf8 | ConvertFrom-Json
if($Version -notmatch '^\d+\.\d+\.\d+$'){throw 'Expected a three-part version.'}
$previous=[version]$ledger.highestAssignedVersion
$requested=[version]$Version
if($requested -le $previous){throw "Refusing version $Version; the highest assigned version is $previous."}
$commit=(& git -C $repo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0){throw 'Cannot resolve the maintained commit.'}
$frozen=Join-Path $workspace "stemist-miniprogram-review-$Version-$($commit.Substring(0,7))"
$sourceConfigHash=(Get-FileHash -LiteralPath (Join-Path $repo 'project.config.json')).Hash
if(-not(Test-Path -LiteralPath $frozen)){
  & node (Join-Path $PSScriptRoot 'build-native-package.mjs') --out $frozen
  if($LASTEXITCODE -ne 0){throw 'Package freeze failed.'}
}
$manifest=Get-Content -LiteralPath ($frozen+'-manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
if($manifest.commit -ne $commit){throw 'The frozen package changed commits.'}
foreach($file in $manifest.files){
  $hash=(Get-FileHash -LiteralPath (Join-Path $frozen $file.path)).Hash.ToLowerInvariant()
  if($hash -ne $file.sha256){throw "Frozen runtime drift: $($file.path)"}
  $sourceHash=(Get-FileHash -LiteralPath (Join-Path $repo $file.path)).Hash.ToLowerInvariant()
  if($sourceHash -ne $file.sha256){throw "Maintained source drift: $($file.path)"}
}
if($PrepareOnly){Write-Output ('DEVELOPMENT_PREPARE=PASS|version:'+ $Version +'|commit:'+ $commit +'|project:'+ $frozen);exit 0}
$receiptDir=Join-Path $workspace ('stemist-release-coordination\release-'+$Version+'-'+(Get-Date -Format 'yyyyMMdd'))
New-Item -ItemType Directory -Path $receiptDir -Force | Out-Null
$info=Join-Path $receiptDir ('wechat-upload-'+$Version+'-info.json')
& $DeveloperToolsCli upload --project $frozen --version $Version --desc $Description --info-output $info
if($LASTEXITCODE -ne 0){throw 'WeChat development upload failed; version was not recorded as uploaded.'}
if(-not(Test-Path -LiteralPath $info -PathType Leaf)){throw 'The official upload receipt is missing.'}
$official=Get-Content -LiteralPath $info -Raw -Encoding utf8 | ConvertFrom-Json
if([int64]$official.size.total -le 0){throw 'The official upload receipt has no package sizes.'}
if((Get-FileHash -LiteralPath (Join-Path $repo 'project.config.json')).Hash -ne $sourceConfigHash){throw 'The original IDE configuration changed.'}
$entry=[ordered]@{
  version=$Version; uploadedAt=(Get-Date -Format o); commit=$commit; project=$frozen
  success=$true; officialInfo=$info; size=$official.size; originalProjectConfigChanged=$false
  reviewSubmitted=$false; publicReleasePerformed=$false
}
$receipt=Join-Path $receiptDir 'upload-receipt.json'
[IO.File]::WriteAllText($receipt,($entry|ConvertTo-Json -Depth 8)+"`n",[Text.UTF8Encoding]::new($false))
$ledger.highestAssignedVersion=$Version
$ledger.uploads=@($ledger.uploads)+[pscustomobject]$entry
[IO.File]::WriteAllText($ledgerPath,($ledger|ConvertTo-Json -Depth 10)+"`n",[Text.UTF8Encoding]::new($false))
Write-Output ('DEVELOPMENT_UPLOAD=PASS|version:'+ $Version +'|commit:'+ $commit +'|receipt:'+ $receipt)
