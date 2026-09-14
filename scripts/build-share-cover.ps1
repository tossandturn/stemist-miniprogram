param([string]$OutputPath = (Join-Path $PSScriptRoot '../design-system/share-card.png'))
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $OutputPath) { throw 'Share cover already exists; inspect it before replacing.' }
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 320,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$brushes = @{}
$fonts = @()
try {
  foreach ($entry in @{background='#F5F6FB';text='#18213D';brand='#6848D7';muted='#66708A';white='#FFFFFF'}.GetEnumerator()) {
    $brushes[$entry.Key] = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($entry.Value))
  }
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F5F6FB'))
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.FillRectangle($brushes.brand,0,0,8,256)
  $large = New-Object System.Drawing.Font 'Segoe UI',27,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
  $small = New-Object System.Drawing.Font 'Segoe UI',14,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
  $tiny = New-Object System.Drawing.Font 'Segoe UI',12,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
  $fonts = @($large,$small,$tiny)
  $graphics.DrawString('STEMist',$large,$brushes.text,25,26)
  $graphics.DrawString('A-Level + IELTS',$small,$brushes.muted,27,67)
  $labels = @('A-Level','IELTS','Past papers','Calculator')
  for ($i=0; $i -lt 4; $i++) {
    $x = 27 + ($i % 2) * 136
    $y = 108 + [Math]::Floor($i / 2) * 50
    $graphics.FillRectangle($brushes.white,$x,$y,124,40)
    $graphics.DrawString($labels[$i],$small,$brushes.brand,$x+10,$y+11)
  }
  $graphics.DrawString('Learn. Practise. Improve.',$tiny,$brushes.muted,27,223)
  $bitmap.Save([IO.Path]::GetFullPath($OutputPath),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose();$bitmap.Dispose()
  foreach ($font in $fonts) {$font.Dispose()}
  foreach ($brush in $brushes.Values) {$brush.Dispose()}
}
Get-Item -LiteralPath $OutputPath | Select-Object FullName,Length
