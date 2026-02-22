# MatBot - Skripta za pokretanje servera
# Kako koristiti: Desni klik na ovaj fajl -> 'Run with PowerShell'

$port = 8081
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "   MATBOT SERVER JE POKRENUT! " -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tvoja aplikacija je dostupna na:"
    Write-Host "http://localhost:$port/preview.html" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pritisni CTRL+C da ugasis server."
    Write-Host "Mozes umanjiti ovaj prozor, ali ga nemoj gasiti."
    Write-Host "=========================================="

    # Automatski otvori u browseru
    Start-Process "http://localhost:$port/preview.html"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/preview.html" }
        
        # Putanja fajla (radi u folderu gde je skripta)
        $filePath = Join-Path $PSScriptRoot $path.Replace('/', '\')

        if (Test-Path $filePath) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            # Postavljanje ispravnog tipa sadržaja
            if ($path.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($path.EndsWith(".js")) { $response.ContentType = "application/javascript" }
            elseif ($path.EndsWith(".css")) { $response.ContentType = "text/css" }

            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        }
        else {
            $response.StatusCode = 404
            if (-not $path.EndsWith("favicon.ico")) {
                Write-Host "Greska: Fajl nije pronadjen -> $path" -ForegroundColor Red
            }
        }
        $response.Close()
    }
}
catch {
    Write-Host "GREŠKA PRI POKRETANJU:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Pokušaj da pokreneš PowerShell kao Administrator."
    Read-Host "Pritisni Enter za izlaz..."
}
