Add-Type -AssemblyName System.Drawing

function New-Icon {
    param(
        [int]$Size,
        [bool]$Maskable,
        [string]$OutPath
    )
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $bg = [System.Drawing.Color]::FromArgb(255, 0x2B, 0x4C, 0x8C)
    $g.Clear($bg)

    # Glyph: simple ascending bars (wordless, reads at any size), white on navy.
    $margin = if ($Maskable) { $Size * 0.30 } else { $Size * 0.20 }
    $innerW = $Size - 2 * $margin
    $innerH = $Size - 2 * $margin
    $barCount = 3
    $gap = $innerW * 0.14
    $barW = ($innerW - $gap * ($barCount - 1)) / $barCount
    $heights = @(0.45, 0.72, 1.0)
    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    for ($i = 0; $i -lt $barCount; $i++) {
        $h = $innerH * $heights[$i]
        $x = $margin + $i * ($barW + $gap)
        $y = $margin + ($innerH - $h)
        $rectW = [Math]::Max(1, [int]$barW)
        $rectH = [Math]::Max(1, [int]$h)
        $radius = [Math]::Min(8, $rectW / 2)
        $rect = New-Object System.Drawing.RectangleF $x, $y, $rectW, $rectH
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
        $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
        $path.AddLine($rect.Right, $rect.Y + $radius, $rect.Right, $rect.Bottom)
        $path.AddLine($rect.Right, $rect.Bottom, $rect.X, $rect.Bottom)
        $path.AddLine($rect.X, $rect.Bottom, $rect.X, $rect.Y + $radius)
        $path.CloseFigure()
        $g.FillPath($white, $path)
    }

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$dir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-Icon -Size 192 -Maskable $false -OutPath (Join-Path $dir 'icon-192.png')
New-Icon -Size 512 -Maskable $false -OutPath (Join-Path $dir 'icon-512.png')
New-Icon -Size 192 -Maskable $true -OutPath (Join-Path $dir 'icon-maskable-192.png')
New-Icon -Size 512 -Maskable $true -OutPath (Join-Path $dir 'icon-maskable-512.png')

Write-Output "Icônes générées dans $dir"
