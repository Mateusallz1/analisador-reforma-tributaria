param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputPath = '',

  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$inputRoot = (Resolve-Path -LiteralPath $InputPath).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $PSScriptRoot '..\tests\fixtures\real-nfe'
}
$outputRoot = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  [System.IO.Path]::GetFullPath($OutputPath)
} else {
  [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $OutputPath))
}
$files = @(Get-ChildItem -LiteralPath $inputRoot -Recurse -File -Filter '*.xml' | Sort-Object FullName)

if ($files.Count -eq 0) {
  throw "Nenhum XML encontrado em $inputRoot."
}

if ($inputRoot.TrimEnd('\') -eq $outputRoot.TrimEnd('\')) {
  throw 'InputPath e OutputPath não podem apontar para a mesma pasta.'
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$existingGeneratedFiles = @(Get-ChildItem -LiteralPath $outputRoot -File -Filter 'sample-*.xml' -ErrorAction SilentlyContinue)
$existingOtherXmlFiles = @(Get-ChildItem -LiteralPath $outputRoot -File -Filter '*.xml' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch '^sample-\d+\.xml$' })

if ($existingOtherXmlFiles.Count -gt 0) {
  throw 'OutputPath contém XMLs que não foram gerados por este script. Escolha uma pasta de fixtures dedicada.'
}

if ($existingGeneratedFiles.Count -gt 0 -and -not $Force) {
  throw 'OutputPath já contém fixtures geradas. Use -Force para substituí-las explicitamente.'
}

if ($Force) {
  $existingGeneratedFiles | Remove-Item -Force
}

$readerSettings = [System.Xml.XmlReaderSettings]::new()
$readerSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$readerSettings.XmlResolver = $null

$removedElementNames = @('X509Certificate')

$redactedNames = @{
  CNPJ = '00000000000000'
  CPF = '00000000000'
  xNome = 'Empresa de homologacao'
  xFant = 'Empresa de homologacao'
  RazaoSocial = 'Empresa de homologacao'
  xProd = 'Produto de homologacao'
  cProd = 'PROD-HOMO'
  IE = '000000000'
  IM = '000000000'
  xLgr = 'Rua de homologacao'
  xEnder = 'Endereco de homologacao'
  nro = '100'
  xBairro = 'Centro'
  xCpl = 'Sala de homologacao'
  xMun = 'Municipio de homologacao'
  CEP = '00000000'
  fone = '0000000000'
  email = 'homologacao@example.invalid'
  infCpl = 'Conteudo removido para homologacao.'
  xTexto = 'Conteudo removido para homologacao.'
  xObs = 'Conteudo removido para homologacao.'
  obsCont = 'Conteudo removido para homologacao.'
  obsFisco = 'Conteudo removido para homologacao.'
  xContato = 'Contato de homologacao'
  infAdProd = 'Informacao adicional de produto removida para homologacao.'
  CodigoVerificacao = 'CODIGO-HOMO'
  Discriminacao = 'Servico de homologacao'
  Contato = 'Contato de homologacao'
  InscricaoMunicipal = 'IM-HOMO'
  NomeFantasia = 'Empresa de homologacao'
  Endereco = 'Endereco de homologacao'
  Bairro = 'Bairro de homologacao'
  Numero = 'Numero de homologacao'
  Serie = 'Serie de homologacao'
  cEAN = 'EAN-HOMO'
  cEANTrib = 'EANTRIB-HOMO'
  urlChave = 'https://example.invalid/chave-homologacao'
  xMotivo = 'Motivo de homologacao'
  chNFe = '00000000000000000000000000000000000000000000'
  refNFe = 'REFNFE-HOMO'
  chaveAcesso = 'CHAVE-HOMO'
  nProt = '000000000000000'
  digVal = 'SANITIZED'
  SignatureValue = 'SANITIZED'
  DigestValue = 'SANITIZED'
}

function Set-ElementText([System.Xml.XmlElement]$element, [string]$value) {
  while ($element.HasChildNodes) {
    $element.RemoveChild($element.FirstChild) | Out-Null
  }
  $element.AppendChild($element.OwnerDocument.CreateTextNode($value)) | Out-Null
}

function Get-CheckDigit([string]$digits, [int[]]$weights) {
  $sum = 0
  for ($index = 0; $index -lt $weights.Count; $index++) {
    $sum += ([int][string]$digits[$index]) * $weights[$index]
  }

  $remainder = $sum % 11
  return $(if ($remainder -lt 2) { 0 } else { 11 - $remainder })
}

function New-ValidCnpj([int]$seed) {
  $base = '12345' + ('{0:D3}' -f ($seed % 1000)) + '0001'
  $first = Get-CheckDigit $base @(5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
  $second = Get-CheckDigit ($base + $first) @(6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
  return $base + $first + $second
}

function New-ValidCpf([int]$seed) {
  $base = '12345' + ('{0:D4}' -f ($seed % 10000))
  $first = Get-CheckDigit $base @(10, 9, 8, 7, 6, 5, 4, 3, 2)
  $second = Get-CheckDigit ($base + $first) @(11, 10, 9, 8, 7, 6, 5, 4, 3, 2)
  return $base + $first + $second
}

function Get-NodeValues([System.Xml.XmlDocument]$document) {
  $values = [System.Collections.Generic.List[object]]::new()

  foreach ($element in @($document.SelectNodes('//*'))) {
    if ($redactedNames.ContainsKey($element.LocalName) -and $element.InnerText.Length -ge 8) {
      $values.Add([pscustomobject]@{ Name = $element.LocalName; Value = $element.InnerText })
    }

    if ($element.HasAttribute('Id') -and $element.GetAttribute('Id').Length -ge 8) {
      $values.Add([pscustomobject]@{ Name = "$($element.LocalName).@Id"; Value = $element.GetAttribute('Id') })
    }

    if ($element.HasAttribute('URI') -and $element.GetAttribute('URI').Length -ge 8) {
      $values.Add([pscustomobject]@{ Name = "$($element.LocalName).@URI"; Value = $element.GetAttribute('URI') })
    }
  }

  return $values.ToArray()
}

function Sanitize-Document(
  [System.Xml.XmlDocument]$document,
  [int]$sequence,
  [hashtable]$replacements
) {
  foreach ($element in @($document.SelectNodes('//*'))) {
    if ($removedElementNames -contains $element.LocalName) {
      if ($null -ne $element.ParentNode) {
        $element.ParentNode.RemoveChild($element) | Out-Null
      }
      continue
    }

    if ($replacements.ContainsKey($element.LocalName)) {
      Set-ElementText $element $replacements[$element.LocalName]
    }

    if ($element.LocalName -in @('nNF', 'nNota', 'nCT')) {
      Set-ElementText $element (100000 + $sequence)
    }

    if ($element.LocalName -eq 'serie') {
      Set-ElementText $element '1'
    }

    if ($element.LocalName -eq 'cNF') {
      Set-ElementText $element ('{0:D8}' -f (10000000 + $sequence))
    }

    if ($element.LocalName -in @('dhEmi', 'dEmi', 'dhProc', 'dhSaiEnt', 'DataEmissao', 'DataEmissaoRps', 'Competencia')) {
      Set-ElementText $element '2026-06-01T12:00:00-03:00'
    }

    if ($element.HasAttribute('Id')) {
      $element.SetAttribute('Id', ('NFeHOMO{0:D6}' -f $sequence))
    }

    if ($element.HasAttribute('URI')) {
      $element.SetAttribute('URI', ('#NFeHOMO{0:D6}' -f $sequence))
    }
  }
}

$totalItems = 0
$documentsWithIbsCbs = 0

for ($index = 0; $index -lt $files.Count; $index++) {
  $sequence = $index + 1
  $source = $files[$index]
  $document = [System.Xml.XmlDocument]::new()
  $document.XmlResolver = $null
  $reader = [System.Xml.XmlReader]::Create($source.FullName, $readerSettings)

  try {
    $document.Load($reader)
  } finally {
    $reader.Dispose()
  }

  $sensitiveValues = @(Get-NodeValues $document)
  $totalItems += @($document.SelectNodes("//*[local-name()='det']")).Count
  if ($null -ne $document.SelectSingleNode("//*[local-name()='IBSCBS']")) {
    $documentsWithIbsCbs++
  }

  $replacements = @{} + $redactedNames
  $replacementSeed = 100 + $sequence
  $replacements['CNPJ'] = New-ValidCnpj $replacementSeed
  $replacements['CPF'] = New-ValidCpf $replacementSeed
  $token = '__HOMO_SAMPLE_{0:D3}__' -f $sequence
  $replacements['xNome'] = "Empresa $token"
  $replacements['xFant'] = "Empresa $token"
  $replacements['RazaoSocial'] = "Empresa $token"
  $replacements['xProd'] = "Produto $token"
  $replacements['cProd'] = "PROD-$token"
  $replacements['xLgr'] = "Rua $token"
  $replacements['xBairro'] = "Bairro $token"
  $replacements['xCpl'] = "Complemento $token"
  $replacements['xMun'] = "Municipio $token"
  $replacements['infCpl'] = "Conteudo $token"
  $replacements['xTexto'] = "Conteudo $token"
  $replacements['xObs'] = "Conteudo $token"
  $replacements['obsCont'] = "Conteudo $token"
  $replacements['obsFisco'] = "Conteudo $token"
  $replacements['xContato'] = "Contato $token"
  $replacements['infAdProd'] = "Informacao adicional $token"
  $replacements['CodigoVerificacao'] = "CODIGO-$token"
  $replacements['Discriminacao'] = "Servico $token"
  $replacements['Contato'] = "Contato $token"
  $replacements['InscricaoMunicipal'] = "IM-$token"
  $replacements['NomeFantasia'] = "Empresa $token"
  $replacements['Endereco'] = "Endereco $token"
  $replacements['Bairro'] = "Bairro $token"
  $replacements['Numero'] = "NUMERO-$token"
  $replacements['Serie'] = "SERIE-$token"
  $replacements['cEAN'] = "EAN-$token"
  $replacements['cEANTrib'] = "EANTRIB-$token"
  $replacements['urlChave'] = "https://example.invalid/$token"
  $replacements['xMotivo'] = "Motivo $token"
  $replacements['chNFe'] = "CHAVE-$token"
  $replacements['refNFe'] = "REFNFE-$token"
  $replacements['chaveAcesso'] = "CHAVE-$token"
  $replacements['nProt'] = "PROTO-$token"
  $replacements['digVal'] = "DIGEST-$token"
  $replacements['SignatureValue'] = "SIGNATURE-$token"
  $replacements['DigestValue'] = "DIGEST-$token"
  while (@($sensitiveValues | Where-Object { $_.Value -eq $replacements['CNPJ'] }).Count -gt 0) {
    $replacementSeed++
    $replacements['CNPJ'] = New-ValidCnpj $replacementSeed
  }
  while (@($sensitiveValues | Where-Object { $_.Value -eq $replacements['CPF'] }).Count -gt 0) {
    $replacementSeed++
    $replacements['CPF'] = New-ValidCpf $replacementSeed
  }
  foreach ($key in @($replacements.Keys)) {
    $value = [string]$replacements[$key]
    while (@($sensitiveValues | Where-Object { [string]$_.Value -eq $value }).Count -gt 0) {
      $value += '-X'
    }
    $replacements[$key] = $value
  }

  Sanitize-Document $document $sequence $replacements

  $serializedDocument = $document.OuterXml
  $replacementValue = "REDACTED-$token"
  foreach ($sensitiveValue in $sensitiveValues) {
    foreach ($candidateValue in @(
        [string]$sensitiveValue.Value,
        [System.Security.SecurityElement]::Escape([string]$sensitiveValue.Value)
      )) {
      if (-not [string]::IsNullOrEmpty($candidateValue)) {
        $serializedDocument = $serializedDocument.Replace($candidateValue, $replacementValue)
      }
    }
  }

  $sanitizedDocument = [System.Xml.XmlDocument]::new()
  $sanitizedDocument.XmlResolver = $null
  $sanitizedDocument.LoadXml($serializedDocument)

  $outputFile = Join-Path $outputRoot ('sample-{0:D3}.xml' -f $sequence)
  $writerSettings = [System.Xml.XmlWriterSettings]::new()
  $writerSettings.Encoding = [System.Text.UTF8Encoding]::new($false)
  $writerSettings.Indent = $true
  $writer = [System.Xml.XmlWriter]::Create($outputFile, $writerSettings)
  try {
    $sanitizedDocument.Save($writer)
  } finally {
    $writer.Dispose()
  }

  $sanitizedText = Get-Content -LiteralPath $outputFile -Raw
  foreach ($sensitiveValue in $sensitiveValues) {
    if ($sanitizedText.Contains($sensitiveValue.Value)) {
      throw "Valor sensível da origem permaneceu na tag $($sensitiveValue.Name) da fixture $outputFile."
    }
  }
}

Write-Output ("Fixtures geradas: {0}; itens: {1}; documentos com IBSCBS: {2}; destino: {3}" -f $files.Count, $totalItems, $documentsWithIbsCbs, $outputRoot)
