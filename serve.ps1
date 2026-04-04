param(
  [int]$Port = 8080,
  [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()

Write-Host "Serving $Root on port $Port"
Write-Host "Press Ctrl+C to stop."

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".jfif" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  $header = @(
    "HTTP/1.1 $StatusCode $StatusText"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while (($line = $reader.ReadLine()) -ne "") {
        if ($null -eq $line) { break }
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }

      if ($method -ne "GET") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
        Send-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -Body $body
        continue
      }

      $requestPath = $rawPath.Split("?")[0].TrimStart("/")
      $requestPath = [System.Uri]::UnescapeDataString($requestPath)
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }

      $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
      $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $Root $requestPath))

      if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Send-Response -Stream $stream -StatusCode 403 -StatusText "Forbidden" -Body $body
        continue
      }

      if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Send-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -Body $body
        continue
      }

      $extension = [System.IO.Path]::GetExtension($resolvedPath).ToLowerInvariant()
      $contentType = $contentTypes[$extension]
      if (-not $contentType) {
        $contentType = "application/octet-stream"
      }

      $body = [System.IO.File]::ReadAllBytes($resolvedPath)
      Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -Body $body -ContentType $contentType
    }
    finally {
      if ($stream) { $stream.Dispose() }
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
