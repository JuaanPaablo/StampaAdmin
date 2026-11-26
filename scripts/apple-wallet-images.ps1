# Genera las imágenes de marca de Stampa para los pases de Apple Wallet (icon.png y logo.png en 1x, 2x y 3x) a partir
# del mismo dibujo que public/favicon.svg, y las incrusta en src/lib/wallet/apple/images.ts (base64) para que viajen
# dentro del código del servidor en Vercel (sin leer archivos del disco en tiempo de ejecución).
#   powershell -ExecutionPolicy Bypass -File scripts/apple-wallet-images.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\wallet\apple'
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-Mark([int]$size, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $k = $size / 100.0
  $navy = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 29, 61))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 195, 1))
  if ($rounded) {
    $r = 22 * $k; $d = 2 * $r; $w = $size
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($w - $d, 0, $d, $d, 270, 90)
    $p.AddArc($w - $d, $w - $d, $d, $d, 0, 90); $p.AddArc(0, $w - $d, $d, $d, 90, 90); $p.CloseFigure()
    $g.FillPath($navy, $p)
  } else {
    $g.FillRectangle($navy, 0, 0, $size, $size)
  }
  # favicon.svg: translate(14 12) scale(.78); círculo (44,56) r38 menos el mordisco (78,22) r22; punto (78,22) r11.
  $T = { param($v) $v * 0.78 }
  $cx = (14 + (& $T 44)) * $k; $cy = (12 + (& $T 56)) * $k; $cr = (& $T 38) * $k
  $bx = (14 + (& $T 78)) * $k; $by = (12 + (& $T 22)) * $k; $br = (& $T 22) * $k; $dr = (& $T 11) * $k
  $big = New-Object System.Drawing.Drawing2D.GraphicsPath; $big.AddEllipse($cx - $cr, $cy - $cr, 2 * $cr, 2 * $cr)
  $bite = New-Object System.Drawing.Drawing2D.GraphicsPath; $bite.AddEllipse($bx - $br, $by - $br, 2 * $br, 2 * $br)
  $region = New-Object System.Drawing.Region $big; $region.Exclude($bite)
  $g.FillRegion($white, $region)
  $g.FillEllipse($gold, $bx - $dr, $by - $dr, 2 * $dr, 2 * $dr)
  $g.Dispose()
  return $bmp
}

$images = [ordered]@{
  'icon.png' = @(29, $false); 'icon@2x.png' = @(58, $false); 'icon@3x.png' = @(87, $false)
  'logo.png' = @(50, $true); 'logo@2x.png' = @(100, $true); 'logo@3x.png' = @(150, $true)
}
$lines = @()
foreach ($name in $images.Keys) {
  $spec = $images[$name]
  $bmp = New-Mark $spec[0] $spec[1]
  $path = Join-Path $outDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
  $lines += "  '$name': '$b64',"
}
$ts = @"
/**
 * GENERADO por scripts/apple-wallet-images.ps1 (no editar a mano). Imágenes de marca de Stampa para los pases de
 * Apple Wallet en base64 (las mismas que public/wallet/apple/). Van dentro del código para no depender de leer
 * archivos del disco en la función de Vercel.
 */
export const APPLE_IMAGES: Record<string, string> = {
$($lines -join "`n")
};
"@
[IO.File]::WriteAllText((Join-Path $root 'src\lib\wallet\apple\images.ts'), $ts.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding $false))
Write-Output "Listo: $outDir y src/lib/wallet/apple/images.ts"
