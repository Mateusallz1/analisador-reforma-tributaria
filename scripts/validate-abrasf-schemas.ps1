param(
  [switch]$KeepArtifacts
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$schemaV1Source = Join-Path $repoRoot 'src\data\xml_schema_nfse_v1\nfse.xsd'
$schemaV1DsigSource = Join-Path $repoRoot 'src\data\xml_schema_nfse_v1\xmldsig-core-schema20020212.xsd'
$schemaV204Source = Join-Path $repoRoot 'src\data\schema_nfse_v2.04\schema nfse v2-04.xsd'

foreach ($path in @($schemaV1Source, $schemaV1DsigSource, $schemaV204Source)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Schema ABRASF ausente: $path"
  }
}

$deno = Get-Command deno.exe -ErrorAction SilentlyContinue
if (-not $deno) {
  throw 'Deno nao encontrado no PATH.'
}

$jjsCandidates = @()
$jjsCommand = Get-Command jjs.exe -ErrorAction SilentlyContinue
if ($jjsCommand) {
  $jjsCandidates += $jjsCommand.Source
}
if ($env:JAVA_HOME) {
  $jjsCandidates += Join-Path $env:JAVA_HOME 'bin\jjs.exe'
}
$javaRoot = Join-Path ${env:ProgramFiles} 'Java'
if (Test-Path -LiteralPath $javaRoot) {
  $jjsCandidates += Get-ChildItem -LiteralPath $javaRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'bin\jjs.exe' }
}
$jjs = $jjsCandidates |
  Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
  Select-Object -First 1
if (-not $jjs) {
  throw 'jjs nao encontrado. Instale um JRE 8 com Nashorn ou ajuste JAVA_HOME.'
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "analisador-abrasf-$PID"
$xmlDirectory = Join-Path $temporaryRoot 'fixtures'
$schemaV1RawDirectory = Join-Path $temporaryRoot 'schema-v1-raw'
$schemaV1NormalizedDirectory = Join-Path $temporaryRoot 'schema-v1-normalized'
$schemaV204RawDirectory = Join-Path $temporaryRoot 'schema-v204-raw'
$schemaV204NormalizedDirectory = Join-Path $temporaryRoot 'schema-v204-normalized'
$javaScriptPath = Join-Path $temporaryRoot 'validate.js'
$exitCode = 1

try {
  New-Item -ItemType Directory -Force -Path @(
    $xmlDirectory,
    $schemaV1RawDirectory,
    $schemaV1NormalizedDirectory,
    $schemaV204RawDirectory,
    $schemaV204NormalizedDirectory
  ) | Out-Null

  $fixtureScript = @'
import {
  ABRASF_NFSE_1_00_RESPONSE,
  ABRASF_NFSE_2_04_RESPONSE,
  ABRASF_NFSE_2_04_BY_RPS_RESPONSE,
  ABRASF_NFSE_2_04_LOTE_RESPONSE,
  ABRASF_NFSE_2_04_FAIXA_RESPONSE,
  ABRASF_NFSE_2_04_GERAR_RESPONSE,
  ABRASF_NFSE_2_04_SINCRONO_RESPONSE,
  ABRASF_NFSE_2_04_TOMADO_RESPONSE,
} from "./tests/fixtures/nfseAbrasfFixtures.ts";

const directory = "__XML_DIRECTORY__";
await Deno.mkdir(directory, { recursive: true });
await Deno.writeTextFile(`${directory}/ABRASF_1_00_RESPONSE.xml`, ABRASF_NFSE_1_00_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_RESPONSE.xml`, ABRASF_NFSE_2_04_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_RPS_RESPONSE.xml`, ABRASF_NFSE_2_04_BY_RPS_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_LOTE_RESPONSE.xml`, ABRASF_NFSE_2_04_LOTE_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_FAIXA_RESPONSE.xml`, ABRASF_NFSE_2_04_FAIXA_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_GERAR_RESPONSE.xml`, ABRASF_NFSE_2_04_GERAR_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_SINCRONO_RESPONSE.xml`, ABRASF_NFSE_2_04_SINCRONO_RESPONSE);
await Deno.writeTextFile(`${directory}/ABRASF_2_04_TOMADO_RESPONSE.xml`, ABRASF_NFSE_2_04_TOMADO_RESPONSE);
'@.Replace('__XML_DIRECTORY__', $xmlDirectory.Replace([char]92, [char]47))

  & $deno.Source eval $fixtureScript
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao materializar as fixtures ABRASF.'
  }

  Copy-Item -LiteralPath $schemaV1Source -Destination (Join-Path $schemaV1RawDirectory 'nfse.xsd')
  Copy-Item -LiteralPath $schemaV1DsigSource -Destination (Join-Path $schemaV1RawDirectory 'xmldsig-core-schema20020212.xsd')
  $v1Content = Get-Content -LiteralPath $schemaV1Source -Raw
  $v1Content = $v1Content.Replace(
    'http:/www.abrasf.org.br/nfse.xsd',
    'http://www.abrasf.org.br/nfse.xsd'
  )
  [System.IO.File]::WriteAllText(
    (Join-Path $schemaV1NormalizedDirectory 'nfse.xsd'),
    $v1Content,
    [System.Text.UTF8Encoding]::new($false)
  )
  Copy-Item -LiteralPath $schemaV1DsigSource -Destination (Join-Path $schemaV1NormalizedDirectory 'xmldsig-core-schema20020212.xsd')
  Copy-Item -LiteralPath $schemaV204Source -Destination (Join-Path $schemaV204RawDirectory 'nfse.xsd')
  Copy-Item -LiteralPath $schemaV1DsigSource -Destination (Join-Path $schemaV204RawDirectory 'xmldsig-core-schema20020212.xsd')

  $v204Content = Get-Content -LiteralPath $schemaV204Source -Raw
  $v204Content = $v204Content.Replace(
    '<xsd:sequence minOccurs="1" maxOccurs="1">',
    '<xsd:sequence>'
  )
  $v204Content = $v204Content.Replace(
    '<xsd:choice minOccurs="1" maxOccurs="1">',
    '<xsd:choice>'
  )
  $v204Content = [System.Text.RegularExpressions.Regex]::Replace(
    $v204Content,
    '(<xsd:element name="CompNfse" type="tcCompNfse"\s*)\r?\n\s*minOccurs="1" maxOccurs="1"/>',
    '$1/>'
  )
  [System.IO.File]::WriteAllText(
    (Join-Path $schemaV204NormalizedDirectory 'nfse.xsd'),
    $v204Content,
    [System.Text.UTF8Encoding]::new($false)
  )
  Copy-Item -LiteralPath $schemaV1DsigSource -Destination (Join-Path $schemaV204NormalizedDirectory 'xmldsig-core-schema20020212.xsd')

  $javaScript = @'
var SchemaFactory = Java.type('javax.xml.validation.SchemaFactory');
var XMLConstants = Java.type('javax.xml.XMLConstants');
var StreamSource = Java.type('javax.xml.transform.stream.StreamSource');
var File = Java.type('java.io.File');
var System = Java.type('java.lang.System');
var factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
var args = [];
for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);

function compileSchema(label, schemaPath) {
  try {
    var schema = factory.newSchema(new StreamSource(new File(schemaPath)));
    print(label + ' schema => COMPILE_PASS');
    return schema;
  } catch (error) {
    print(label + ' schema => COMPILE_FAIL: ' + error.getMessage());
    return null;
  }
}

function validate(schema, label, xmlPath) {
  try {
    schema.newValidator().validate(new StreamSource(new File(xmlPath)));
    print(label + ' => PASS');
    return true;
  } catch (error) {
    print(label + ' => FAIL: ' + error.getMessage());
    return false;
  }
}

  compileSchema('ABRASF v1 original', args[0]);
  var normalizedV1Schema = compileSchema('ABRASF v1 copia diagnostica', args[1]);
  compileSchema('ABRASF v2.04 original', args[2]);
  var normalizedV204Schema = compileSchema('ABRASF v2.04 copia diagnostica', args[3]);
  var directory = args[4];
  var passed = normalizedV1Schema !== null && normalizedV204Schema !== null;
  if (normalizedV1Schema !== null) {
   passed = validate(normalizedV1Schema, '1.00 resposta ABRASF', directory + '/ABRASF_1_00_RESPONSE.xml') && passed;
  }
  if (normalizedV204Schema !== null) {
   passed = validate(normalizedV204Schema, '2.04 resposta por servico', directory + '/ABRASF_2_04_RESPONSE.xml') && passed;
   passed = validate(normalizedV204Schema, '2.04 resposta por RPS', directory + '/ABRASF_2_04_RPS_RESPONSE.xml') && passed;
   passed = validate(normalizedV204Schema, '2.04 resposta de lote', directory + '/ABRASF_2_04_LOTE_RESPONSE.xml') && passed;
   passed = validate(normalizedV204Schema, '2.04 resposta por faixa', directory + '/ABRASF_2_04_FAIXA_RESPONSE.xml') && passed;
   passed = validate(normalizedV204Schema, '2.04 resposta GerarNfse', directory + '/ABRASF_2_04_GERAR_RESPONSE.xml') && passed;
   passed = validate(normalizedV204Schema, '2.04 resposta sincrona', directory + '/ABRASF_2_04_SINCRONO_RESPONSE.xml') && passed;
   passed = validate(normalizedV204Schema, '2.04 resposta servico tomado', directory + '/ABRASF_2_04_TOMADO_RESPONSE.xml') && passed;
  }
System.exit(passed ? 0 : 1);
'@
  [System.IO.File]::WriteAllText(
    $javaScriptPath,
    $javaScript,
    [System.Text.UTF8Encoding]::new($false)
  )

  $jjsArguments = @(
    '-scripting',
    $javaScriptPath,
    '--',
    (Join-Path $schemaV1RawDirectory 'nfse.xsd').Replace([char]92, [char]47),
    (Join-Path $schemaV1NormalizedDirectory 'nfse.xsd').Replace([char]92, [char]47),
    (Join-Path $schemaV204RawDirectory 'nfse.xsd').Replace([char]92, [char]47),
    (Join-Path $schemaV204NormalizedDirectory 'nfse.xsd').Replace([char]92, [char]47),
    $xmlDirectory.Replace([char]92, [char]47)
  )
  & $jjs @jjsArguments
  $exitCode = $LASTEXITCODE
} catch {
  Write-Error $_
  $exitCode = 1
} finally {
  if ($KeepArtifacts) {
    Write-Output "Artefatos temporarios preservados em: $temporaryRoot"
  } elseif (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

exit $exitCode
