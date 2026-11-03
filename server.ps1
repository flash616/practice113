# Guess or Splash — local server (static files + Word Orb + Gemini)
# Usage: powershell -ExecutionPolicy Bypass -File .\server.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 3000
$EnvFile = Join-Path $Root ".env"

$SeedWords = @(
  "deadline","interview","schedule","customer","budget","contract","employee",
  "invoice","refund","shipment","warranty","brochure","conference","reservation",
  "applicant","negotiate","efficient","postpone","inventory","colleague",
  "passenger","advertise","manufacture","competent","temporary","acknowledge",
  "substantial","accommodate","commodity","courage","ambition","decision",
  "evidence","proposal","benefit","manager","product","service","quality",
  "payment","delivery","purchase","receipt","discount","agreement","strategy"
)

function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $path)) { return $map }
  Get-Content -LiteralPath $path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
    $map[$name] = $value
  }
  return $map
}

function Get-Mime([string]$ext) {
  switch ($ext.ToLower()) {
    ".html" { "text/html; charset=utf-8" }
    ".css"  { "text/css; charset=utf-8" }
    ".js"   { "text/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".png"  { "image/png" }
    ".jpg"  { "image/jpeg" }
    ".svg"  { "image/svg+xml" }
    ".ico"  { "image/x-icon" }
    default { "application/octet-stream" }
  }
}

function Write-JsonResponse($ctx, $obj, [int]$status = 200) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.Headers.Add("Cache-Control", "no-store")
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}

function Read-Utf8ResponseText($raw) {
  $ms = New-Object System.IO.MemoryStream
  $raw.RawContentStream.Position = 0
  $raw.RawContentStream.CopyTo($ms)
  return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Get-WordOrbWordList([string]$apiKey, [int]$count) {
  # Word Orb is used ONLY to confirm/select headwords. No descriptions.
  $picked = $SeedWords | Get-Random -Count ([Math]::Min($count + 20, $SeedWords.Count))
  $words = @()
  $headers = @{ Authorization = "Bearer $apiKey" }

  foreach ($candidate in $picked) {
    if ($words.Count -ge $count) { break }
    $url = "https://wordorb.ai/api/word/$candidate"
    try {
      $raw = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -TimeoutSec 20 -UseBasicParsing
      $data = (Read-Utf8ResponseText $raw) | ConvertFrom-Json
    } catch {
      continue
    }
    $word = ([string]$data.word).Trim().ToLower() -replace "[^a-z]", ""
    if ($word.Length -ge 4 -and ($words -notcontains $word)) {
      $words += $word
    }
  }

  if ($words.Count -lt 1) { throw "Word Orb returned no usable words" }
  return $words
}

function Invoke-GeminiJson([string]$apiKey, [string]$prompt) {
  $bodyObj = @{
    contents = @(
      @{
        parts = @(
          @{ text = $prompt }
        )
      }
    )
    generationConfig = @{
      temperature = 0.9
      responseMimeType = "application/json"
    }
  }
  $body = $bodyObj | ConvertTo-Json -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $models = @("gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash")
  $lastError = $null

  foreach ($model in $models) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$apiKey"
    for ($attempt = 1; $attempt -le 2; $attempt++) {
      try {
        $raw = Invoke-WebRequest -Uri $url -Method Post -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec 90
        $resp = (Read-Utf8ResponseText $raw) | ConvertFrom-Json
        $text = $resp.candidates[0].content.parts[0].text
        if (-not $text) { throw "Empty Gemini response" }
        return ($text | ConvertFrom-Json)
      } catch {
        $detail = $_.Exception.Message
        if ($_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
        $safe = $detail -replace [regex]::Escape($apiKey), "***"
        if ($safe.Length -gt 300) { $safe = $safe.Substring(0, 300) }
        $lastError = "Gemini($model) failed: $safe"
        Start-Sleep -Seconds (2 * $attempt)
      }
    }
  }
  throw $lastError
}

function Convert-GeminiItems($parsed, [string[]]$expectedWords) {
  $items = @()
  foreach ($item in $parsed) {
    $word = ([string]$item.word).Trim().ToLower() -replace "[^a-z]", ""
    $c1 = ([string]$item.clues[0]).Trim()
    $c2 = ([string]$item.clues[1]).Trim()
    $meaning = ([string]$item.meaning).Trim()
    if ($word.Length -ge 4 -and $c1 -and $c2 -and $meaning) {
      if ($expectedWords -and ($expectedWords -notcontains $word)) { continue }
      $items += @{
        word = $word
        clues = @($c1, $c2)
        meaning = $meaning
      }
    }
  }
  if ($items.Count -lt 1) { throw "No valid words parsed from Gemini" }
  return $items
}

function Get-GeminiWords([string]$apiKey, [int]$count, [string[]]$seedWords) {
  if ($seedWords -and $seedWords.Count -gt 0) {
    $list = ($seedWords | Select-Object -First $count) -join ", "
    $prompt = @"
You are writing TOEIC-level English vocabulary quiz items for a guessing game.
Use EXACTLY these words (do not replace them): $list
Return ONLY valid JSON (no markdown) as an array with one object per word.
Each object must have:
- "word": the given English word (lowercase letters only)
- "clues": array of exactly 2 short English sentences that describe the word WITHOUT using the word itself
- "meaning": Korean meaning of the word (short)
"@
    $parsed = Invoke-GeminiJson -apiKey $apiKey -prompt $prompt
    return (Convert-GeminiItems $parsed $seedWords)
  }

  $prompt = @"
You are generating TOEIC-level English vocabulary quiz items for a guessing game.
Return ONLY valid JSON (no markdown) as an array of exactly $count objects.
Each object must have:
- "word": one English word (letters only, lowercase, 5 to 12 letters)
- "clues": array of exactly 2 short English sentences that describe the word WITHOUT using the word itself
- "meaning": Korean meaning of the word (short)

Make words useful for university students preparing for TOEIC.
Avoid duplicates. Avoid proper nouns.
"@
  $parsed = Invoke-GeminiJson -apiKey $apiKey -prompt $prompt
  return (Convert-GeminiItems $parsed $null)
}

$envMap = Read-DotEnv $EnvFile
$geminiKey = $envMap["GEMINI_API_KEY"]
if (-not $geminiKey) { $geminiKey = $envMap["GOOGLE_API_KEY"] }
if (-not $geminiKey) { $geminiKey = $envMap["API_KEY"] }
$wordOrbKey = $envMap["WORD_ORB_KEY"]
if (-not $wordOrbKey) { $wordOrbKey = $envMap["WORDORB_API_KEY"] }

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Failed to start server on $prefix"
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host ""
Write-Host "Guess or Splash server running at $prefix"
if ($wordOrbKey) { Write-Host "Word Orb API key: loaded from .env" } else { Write-Host "Word Orb API key: NOT FOUND" }
if ($geminiKey) { Write-Host "Gemini API key: loaded from .env" } else { Write-Host "Gemini API key: NOT FOUND" }
Write-Host "Press Ctrl+C to stop."
Write-Host ""

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)

    try {
      if ($path -eq "/api/health") {
        Write-JsonResponse $ctx @{
          ok = $true
          wordorb = [bool]$wordOrbKey
          gemini = [bool]$geminiKey
        }
        continue
      }

      if ($path -eq "/api/words") {
        $count = 8
        if ($req.QueryString["count"]) {
          $count = [Math]::Max(3, [Math]::Min(12, [int]$req.QueryString["count"]))
        }

        if (-not $geminiKey) {
          Write-JsonResponse $ctx @{ error = "GEMINI_API_KEY missing in .env (required for clues/meanings)" } 503
          continue
        }

        $errors = @()
        $seedWords = @()
        $source = "gemini"

        if ($wordOrbKey) {
          try {
            $seedWords = @(Get-WordOrbWordList -apiKey $wordOrbKey -count $count)
          } catch {
            $errors += $_.Exception.Message
          }
        }

        try {
          if ($seedWords.Count -gt 0) {
            $words = Get-GeminiWords -apiKey $geminiKey -count $count -seedWords $seedWords
            $source = "gemini+wordorb"
          } else {
            $words = Get-GeminiWords -apiKey $geminiKey -count $count -seedWords @()
            $source = "gemini"
          }
          Write-JsonResponse $ctx @{ source = $source; words = $words }
        } catch {
          $errors += $_.Exception.Message
          $msg = ($errors -join " | ")
          Write-JsonResponse $ctx @{ error = $msg } 502
        }
        continue
      }

      $rel = $path
      if ($rel -eq "/") { $rel = "/index.html" }
      $rel = $rel.TrimStart("/").Replace("/", "\")
      $file = Join-Path $Root $rel
      $fullRoot = [System.IO.Path]::GetFullPath($Root)
      $fullFile = [System.IO.Path]::GetFullPath($file)
      if (-not $fullFile.StartsWith($fullRoot)) {
        $ctx.Response.StatusCode = 403
        $ctx.Response.Close()
        continue
      }
      if (-not (Test-Path -LiteralPath $fullFile -PathType Leaf)) {
        $ctx.Response.StatusCode = 404
        $ctx.Response.Close()
        continue
      }
      $bytes = [System.IO.File]::ReadAllBytes($fullFile)
      $ctx.Response.StatusCode = 200
      $ctx.Response.ContentType = Get-Mime ([IO.Path]::GetExtension($fullFile))
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $ctx.Response.Close()
    } catch {
      try {
        Write-JsonResponse $ctx @{ error = $_.Exception.Message } 500
      } catch {
        $ctx.Response.Abort()
      }
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
