# ============================================================
#  Borra los instaladores de las versiones viejas de frame-app
#
#  Quita los .exe, .msi, .msix y .apk de todos los releases salvo el de la
#  versión actual de Windows (el release «latest») y el de Android (el que
#  anuncia website/android.json). Las páginas de los releases, sus notas,
#  latest.json y SHA256SUMS.txt se quedan. El actualizador solo usa la última
#  versión, así que no le afecta.
#
#  Por qué: hasta la 1.6.9 (Windows) y la 1.1.5 (Android) los instaladores
#  llevaban dentro el correo personal del responsable.
#
#  Uso:
#    pwsh scripts/borrar-instaladores-viejos.ps1 -Simular   (solo muestra la lista)
#    pwsh scripts/borrar-instaladores-viejos.ps1            (pide escribir BORRAR)
# ============================================================
param([switch]$Simular)

$ErrorActionPreference = 'Stop'
$OWNER = 'GasparRojasDiego'
$REPO  = 'frame-app'
$root = Split-Path -Parent $PSScriptRoot
$api = "https://api.github.com/repos/$OWNER/$REPO"

# --- Token de GitHub (del Administrador de credenciales de Git) ---
$cred = "protocol=https`nhost=github.com`n`n" | git credential fill
$token = ($cred | Select-String '^password=').ToString().Substring(9)
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json' }

# --- Lo que se conserva: lo que hoy descargan la web y los actualizadores ---
$windows = (Invoke-RestMethod -Headers $headers -Uri "$api/releases/latest").tag_name
$androidUrl = (Get-Content "$root/website/android.json" -Raw | ConvertFrom-Json).url
if ($androidUrl -notmatch '/releases/download/(android-v[0-9.]+)/') { throw "No se entiende la URL de android.json: $androidUrl" }
$android = $Matches[1]
if ($windows -notmatch '^v[0-9.]+$') { throw "El release «latest» no es de Windows ($windows): no se borra nada." }
$keep = @($windows, $android)

$releases = @()
$page = 1
do {
    # Sin @(…): Invoke-RestMethod entrega la lista como UN objeto, y envuelta
    # quedaría como un solo «release» con todas las etiquetas a la vez.
    $batch = Invoke-RestMethod -Headers $headers -Uri "$api/releases?per_page=100&page=$page"
    $releases += $batch
    $page++
} while ($batch.Count -eq 100)
if (@($releases | Where-Object { $_.tag_name -isnot [string] }).Count -gt 0) { throw 'Lista de releases ilegible: no se borra nada.' }

foreach ($tag in $keep) {
    $release = $releases | Where-Object { $_.tag_name -eq $tag }
    if (-not ($release.assets | Where-Object { $_.name -match '\.(exe|apk)$' })) {
        throw "El release $tag (el que se conserva) no tiene instalador: no se borra nada."
    }
}

$doomed = @(foreach ($release in $releases) {
    if ($keep -contains $release.tag_name) { continue }
    foreach ($asset in $release.assets) {
        if ($asset.name -match '\.(exe|msi|msix|apk)$') {
            [pscustomobject]@{ Tag = $release.tag_name; Name = $asset.name; Size = $asset.size; Id = $asset.id }
        }
    }
})

# Última barrera: nada de lo que se conserva puede estar en la lista.
if (@($doomed | Where-Object { $_.Tag -isnot [string] -or $keep -contains $_.Tag }).Count -gt 0) {
    throw 'La lista incluye la versión actual: no se borra nada.'
}
$total = ($doomed | Measure-Object Size -Sum).Sum
Write-Host "==> Se conservan: $($keep -join ' y ')" -ForegroundColor Cyan
Write-Host ("==> Instaladores viejos: {0} en {1} releases, {2:N0} MB" -f $doomed.Count, @($doomed.Tag | Sort-Object -Unique).Count, ($total / 1MB)) -ForegroundColor Cyan
$doomed | Format-Table Tag, Name, @{ n = 'MB'; e = { [math]::Round($_.Size / 1MB, 1) } } -AutoSize | Out-String | Write-Host
if ($doomed.Count -eq 0) { Write-Host 'Nada que borrar.'; return }
if ($Simular) { Write-Host 'Simulación: no se borró nada.' -ForegroundColor Yellow; return }

$answer = Read-Host 'Esto no se puede deshacer. Escribe BORRAR para continuar'
if ($answer -cne 'BORRAR') { Write-Host 'Cancelado: no se borró nada.' -ForegroundColor Yellow; return }

$done = 0
foreach ($item in $doomed) {
    Invoke-RestMethod -Method Delete -Headers $headers -Uri "$api/releases/assets/$($item.Id)" | Out-Null
    $done++
    Write-Host "  [$done/$($doomed.Count)] $($item.Tag) · $($item.Name)"
}
Write-Host "✔ Borrados $done instaladores. Se conservan $($keep -join ' y ')." -ForegroundColor Green
