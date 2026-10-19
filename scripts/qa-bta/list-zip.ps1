param(
  [Parameter(Mandatory = $true)][string]$ZipPath
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$resolved = [System.IO.Path]::GetFullPath($ZipPath)
$archive = [System.IO.Compression.ZipFile]::OpenRead($resolved)
try {
  $entries = @($archive.Entries | ForEach-Object {
    [ordered]@{
      name = $_.FullName
      size = $_.Length
      compressedSize = $_.CompressedLength
      externalAttributes = $_.ExternalAttributes
      isDirectory = [string]::IsNullOrEmpty($_.Name)
    }
  })
  [ordered]@{ entries = $entries } | ConvertTo-Json -Depth 5 -Compress
} finally {
  $archive.Dispose()
}
