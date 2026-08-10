param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$ComparePath,

    [Parameter(Mandatory = $true)]
    [string]$Version,

    [Parameter(Mandatory = $true)]
    [datetime]$ReferenceDate,

    [Parameter(Mandatory = $true)]
    [datetime]$PublicationDate,

    [Parameter(Mandatory = $true)]
    [string]$TechnicalVersion,

    [Parameter(Mandatory = $true)]
    [string]$TechnicalSource
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryText {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$EntryName
    )

    $entry = $Archive.GetEntry($EntryName)
    if (-not $entry) {
        throw "Entrada '$EntryName' nao encontrada no arquivo XLSX."
    }

    $reader = [System.IO.StreamReader]::new($entry.Open())
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }
}

function Get-CellValue {
    param(
        [System.Xml.XmlElement]$Cell,
        [string[]]$SharedStrings
    )

    $type = $Cell.GetAttribute('t')
    $valueNode = $Cell.SelectSingleNode('./*[local-name()="v"]')

    if ($type -eq 's' -and $valueNode) {
        return $SharedStrings[[int]$valueNode.InnerText]
    }

    if ($type -eq 'inlineStr') {
        return (($Cell.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '')
    }

    if ($valueNode) {
        return $valueNode.InnerText
    }

    return ''
}

function Get-XlsxData {
    param([string]$Path)

    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    $archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedPath)

    try {
        [xml]$workbook = Read-ZipEntryText -Archive $archive -EntryName 'xl/workbook.xml'
        [xml]$relationships = Read-ZipEntryText -Archive $archive -EntryName 'xl/_rels/workbook.xml.rels'

        $relationshipTargets = @{}
        foreach ($relationship in $relationships.Relationships.Relationship) {
            $relationshipTargets[$relationship.Id] = $relationship.Target
        }

        $sharedStrings = @()
        $sharedEntry = $archive.GetEntry('xl/sharedStrings.xml')
        if ($sharedEntry) {
            [xml]$sharedXml = Read-ZipEntryText -Archive $archive -EntryName 'xl/sharedStrings.xml'
            foreach ($item in $sharedXml.SelectNodes('//*[local-name()="sst"]/*[local-name()="si"]')) {
                $sharedStrings += (($item.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '')
            }
        }

        $sheets = [ordered]@{}
        foreach ($sheet in $workbook.SelectNodes('//*[local-name()="sheets"]/*[local-name()="sheet"]')) {
            $relationshipId = $sheet.GetAttribute(
                'id',
                'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            )
            $target = $relationshipTargets[$relationshipId]
            $entryName = if ($target.StartsWith('/')) {
                $target.TrimStart('/')
            }
            elseif ($target.StartsWith('xl/')) {
                $target
            }
            else {
                'xl/' + $target.TrimStart('./')
            }

            [xml]$worksheet = Read-ZipEntryText -Archive $archive -EntryName $entryName
            $xmlRows = @($worksheet.SelectNodes('//*[local-name()="sheetData"]/*[local-name()="row"]'))
            if ($xmlRows.Count -eq 0) {
                $sheets[$sheet.name] = @()
                continue
            }

            $headers = @{}
            foreach ($cell in $xmlRows[0].SelectNodes('./*[local-name()="c"]')) {
                $column = ([regex]::Match($cell.GetAttribute('r'), '^[A-Z]+')).Value
                $header = (Get-CellValue -Cell $cell -SharedStrings $sharedStrings).Trim()
                if ($header) {
                    $headers[$column] = $header
                }
            }

            $dataRows = [System.Collections.Generic.List[object]]::new()
            foreach ($xmlRow in $xmlRows | Select-Object -Skip 1) {
                $row = [ordered]@{}
                foreach ($cell in $xmlRow.SelectNodes('./*[local-name()="c"]')) {
                    $column = ([regex]::Match($cell.GetAttribute('r'), '^[A-Z]+')).Value
                    if ($headers.ContainsKey($column)) {
                        $row[$headers[$column]] = Get-CellValue -Cell $cell -SharedStrings $sharedStrings
                    }
                }

                if ($row.Count -gt 0 -and @($row.Values | Where-Object { $_ -ne '' }).Count -gt 0) {
                    $dataRows.Add($row)
                }
            }

            $sheets[$sheet.name] = $dataRows.ToArray()
        }

        return $sheets
    }
    finally {
        $archive.Dispose()
    }
}

function Get-FirstSheet {
    param(
        [System.Collections.IDictionary]$Sheets,
        [string]$NamePrefix
    )

    $name = @($Sheets.Keys | Where-Object { $_ -like "$NamePrefix*" })[0]
    if (-not $name) {
        throw "Aba iniciada por '$NamePrefix' nao encontrada."
    }

    return @($Sheets[$name])
}

function Get-RowValue {
    param(
        [System.Collections.IDictionary]$Row,
        [string[]]$Names
    )

    foreach ($name in $Names) {
        if ($Row.Contains($name)) {
            return $Row[$name]
        }
    }

    return ''
}

function Convert-ToBoolean {
    param($Value)
    return "$Value".Trim() -eq '1'
}

function Convert-ToNumber {
    param($Value)
    if ([string]::IsNullOrWhiteSpace("$Value")) {
        return 0.0
    }
    return [double]::Parse("$Value", [Globalization.CultureInfo]::InvariantCulture)
}

function Convert-ToNullableString {
    param($Value)
    $text = "$Value".Trim()
    if (-not $text) {
        return $null
    }
    return $text
}

function Convert-ExcelDate {
    param($Value)

    $text = "$Value".Trim()
    if (-not $text) {
        return $null
    }

    $serial = 0.0
    if ([double]::TryParse($text, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$serial)) {
        return ([datetime]'1899-12-30').AddDays($serial).ToString('yyyy-MM-dd')
    }

    return ([datetime]::Parse($text, [Globalization.CultureInfo]::InvariantCulture)).ToString('yyyy-MM-dd')
}

function Get-ChangedFields {
    param(
        $OldValue,
        $NewValue,
        [string[]]$IgnoredFields = @()
    )

    $oldNames = if ($OldValue -is [System.Collections.IDictionary]) {
        @($OldValue.Keys)
    }
    else {
        @($OldValue.PSObject.Properties.Name)
    }
    $newNames = if ($NewValue -is [System.Collections.IDictionary]) {
        @($NewValue.Keys)
    }
    else {
        @($NewValue.PSObject.Properties.Name)
    }

    $names = @($oldNames + $newNames) |
        Sort-Object -Unique |
        Where-Object { $_ -notin $IgnoredFields }

    return @($names | Where-Object {
        $name = $_
        $oldFieldValue = if ($OldValue -is [System.Collections.IDictionary]) { $OldValue[$name] } else { $OldValue.$name }
        $newFieldValue = if ($NewValue -is [System.Collections.IDictionary]) { $NewValue[$name] } else { $NewValue.$name }
        $oldJson = $oldFieldValue | ConvertTo-Json -Depth 20 -Compress
        $newJson = $newFieldValue | ConvertTo-Json -Depth 20 -Compress
        $oldJson -cne $newJson
    })
}

function Write-Comparison {
    param(
        $OldBase,
        $NewBase
    )

    $oldCsts = @{}
    $newCsts = @{}
    $oldClasses = @{}
    $newClasses = @{}

    foreach ($cst in $OldBase.csts) {
        $oldCsts[$cst.codigo] = $cst
        foreach ($class in $cst.classificacoes) {
            $oldClasses[$class.codigo] = $class
        }
    }
    foreach ($cst in $NewBase.csts) {
        $newCsts[$cst.codigo] = $cst
        foreach ($class in $cst.classificacoes) {
            $newClasses[$class.codigo] = $class
        }
    }

    $addedCsts = @($newCsts.Keys | Where-Object { -not $oldCsts.ContainsKey($_) } | Sort-Object)
    $removedCsts = @($oldCsts.Keys | Where-Object { -not $newCsts.ContainsKey($_) } | Sort-Object)
    $changedCsts = @($newCsts.Keys | Where-Object {
        $oldCsts.ContainsKey($_) -and (Get-ChangedFields -OldValue $oldCsts[$_] -NewValue $newCsts[$_] -IgnoredFields @('classificacoes')).Count -gt 0
    } | Sort-Object)

    $addedClasses = @($newClasses.Keys | Where-Object { -not $oldClasses.ContainsKey($_) } | Sort-Object)
    $removedClasses = @($oldClasses.Keys | Where-Object { -not $newClasses.ContainsKey($_) } | Sort-Object)
    $changedClasses = @($newClasses.Keys | Where-Object {
        $oldClasses.ContainsKey($_) -and (Get-ChangedFields -OldValue $oldClasses[$_] -NewValue $newClasses[$_]).Count -gt 0
    } | Sort-Object)

    Write-Output "Comparacao com: $ComparePath"
    Write-Output "CSTs: $($oldCsts.Count) -> $($newCsts.Count); adicionados=$($addedCsts.Count); removidos=$($removedCsts.Count); alterados=$($changedCsts.Count)"
    Write-Output "Classificacoes: $($oldClasses.Count) -> $($newClasses.Count); adicionadas=$($addedClasses.Count); removidas=$($removedClasses.Count); alteradas=$($changedClasses.Count)"

    if ($addedCsts.Count) { Write-Output "CST adicionados: $($addedCsts -join ', ')" }
    if ($removedCsts.Count) { Write-Output "CST removidos: $($removedCsts -join ', ')" }
    if ($changedCsts.Count) {
        Write-Output 'CST alterados:'
        foreach ($code in $changedCsts) {
            $fields = Get-ChangedFields -OldValue $oldCsts[$code] -NewValue $newCsts[$code] -IgnoredFields @('classificacoes')
            Write-Output "  $code [$($fields -join ', ')]"
        }
    }
    if ($addedClasses.Count) { Write-Output "Classificacoes adicionadas: $($addedClasses -join ', ')" }
    if ($removedClasses.Count) { Write-Output "Classificacoes removidas: $($removedClasses -join ', ')" }
    if ($changedClasses.Count) {
        Write-Output 'Classificacoes alteradas:'
        foreach ($code in $changedClasses) {
            $fields = Get-ChangedFields -OldValue $oldClasses[$code] -NewValue $newClasses[$code]
            Write-Output "  $code [$($fields -join ', ')]"
        }
    }
}

$sheets = Get-XlsxData -Path $InputPath
$cstRows = Get-FirstSheet -Sheets $sheets -NamePrefix 'CST '
$classRows = Get-FirstSheet -Sheets $sheets -NamePrefix 'cClass '

$csts = [System.Collections.Generic.List[object]]::new()
$cstByCode = @{}

foreach ($row in $cstRows) {
    $rawCode = "$(Get-RowValue -Row $row -Names @('CST-IBS/CBS'))".Trim()
    if (-not $rawCode) {
        continue
    }
    $code = $rawCode.PadLeft(3, '0')
    if ($code -notmatch '^\d{3}$') {
        throw "CST invalido na planilha: '$rawCode'."
    }

    $cst = [ordered]@{
        codigo = $code
        descricao = "$(Get-RowValue -Row $row -Names @('Descricao CST-IBS/CBS', 'Descrição CST-IBS/CBS'))".Trim()
        exigeTributacao = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gIBSCBS'))
        monofasica = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gIBSCBSMono'))
        reducaoAliquota = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gRed'))
        diferimento = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gDif'))
        transferenciaCredito = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gTransfCred'))
        creditoPresumidoIbsZfm = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_ gCredPresIBSZFM', 'ind_gCredPresIBSZFM'))
        ajusteCompetencia = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gAjusteCompet'))
        reducaoBC = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_RedutorBC'))
        classificacoes = [System.Collections.Generic.List[object]]::new()
    }

    $csts.Add($cst)
    $cstByCode[$code] = $cst
}

$dfeColumns = [ordered]@{
    indNFeABI = 'NFeABI'
    indNFe = 'NFE'
    indNFCe = 'NFCE'
    indCTe = 'CTE'
    indCTeOS = 'CTEOS'
    indBPe = 'BPE'
    indBPeTA = 'BPETA'
    indBPeTM = 'BPETM'
    indNF3e = 'NF3E'
    indNFSe = 'NFSE'
    'indNFSe Via' = 'NFSVIA'
    indNFCom = 'NFCOM'
    indNFAg = 'NFAG'
    indNFGas = 'NFGAS'
    indDERE = 'DERE'
    indDIR = 'DIR'
    indDUIMP = 'DUIMP'
}

foreach ($row in $classRows) {
    $rawCstCode = "$(Get-RowValue -Row $row -Names @('CST-IBS/CBS'))".Trim()
    $rawClassCode = "$(Get-RowValue -Row $row -Names @('cClassTrib'))".Trim()
    if (-not $rawCstCode -and -not $rawClassCode) {
        continue
    }
    $cstCode = $rawCstCode.PadLeft(3, '0')
    $classCode = $rawClassCode.PadLeft(6, '0')
    if ($cstCode -notmatch '^\d{3}$' -or $classCode -notmatch '^\d{6}$') {
        throw "Linha de classificacao invalida: CST='$rawCstCode'; cClassTrib='$rawClassCode'."
    }
    if (-not $cstByCode.ContainsKey($cstCode)) {
        throw "cClassTrib $classCode referencia CST inexistente $cstCode."
    }

    $relatedDfes = [System.Collections.Generic.List[string]]::new()
    foreach ($column in $dfeColumns.Keys) {
        if (Convert-ToBoolean (Get-RowValue -Row $row -Names @($column))) {
            $relatedDfes.Add($dfeColumns[$column])
        }
    }

    $classification = [ordered]@{
        codigo = $classCode
        descricaoReduzida = "$(Get-RowValue -Row $row -Names @('Nome cClassTrib'))".Trim()
        descricaoCompleta = "$(Get-RowValue -Row $row -Names @('Descricao cClassTrib', 'Descrição cClassTrib'))".Trim()
        reducaoPercentualIBS = Convert-ToNumber (Get-RowValue -Row $row -Names @('pRedIBS'))
        reducaoPercentualCBS = Convert-ToNumber (Get-RowValue -Row $row -Names @('pRedCBS'))
        tipoAliquota = "$(Get-RowValue -Row $row -Names @('Tipo de Aliquota', 'Tipo de Alíquota'))".Trim()
        tributacaoRegular = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gTribRegular'))
        creditoPresumido = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gCredPresOper'))
        monoPadrao = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gMonoPadrao'))
        monoRetencao = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gMonoReten'))
        monoRetido = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gMonoRet'))
        monoDiferimento = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gMonoDif'))
        estornoCredito = Convert-ToBoolean (Get-RowValue -Row $row -Names @('ind_gEstornoCred'))
        dataInicioVigencia = Convert-ExcelDate (Get-RowValue -Row $row -Names @('dIniVig'))
        dataFimVigencia = Convert-ExcelDate (Get-RowValue -Row $row -Names @('dFimVig'))
        dfesRelacionados = $relatedDfes.ToArray()
        anexo = Convert-ToNullableString (Get-RowValue -Row $row -Names @('ANEXO'))
        fonteLegal = Convert-ToNullableString (Get-RowValue -Row $row -Names @('Link'))
    }

    $cstByCode[$cstCode].classificacoes.Add($classification)
}

$newBase = [ordered]@{
    versao = $Version
    descricao = 'Base de verdade - Codigos de Classificacao Tributaria (cClassTrib) por CST - Reforma Tributaria do Consumo (LC 214/2025)'
    fonteOriginal = "$(Split-Path -Leaf $InputPath) (planilha oficial, dados de $($ReferenceDate.ToString('dd-MM-yyyy')), publicada em $($PublicationDate.ToString('dd-MM-yyyy')), $TechnicalVersion)"
    dataReferencia = $ReferenceDate.ToString('yyyy-MM-dd')
    fonteOficialTabela = 'https://dfe-portal.svrs.rs.gov.br/DFE/TabelaClassificacaoTributaria'
    fonteTecnica = $TechnicalSource
    fonteLegalBase = 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm'
    csts = $csts.ToArray()
}

if ($ComparePath) {
    $oldBase = Get-Content -LiteralPath $ComparePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Comparison -OldBase $oldBase -NewBase ([pscustomobject]$newBase)
}

Write-Output "Linhas convertidas: CSTs=$($csts.Count); classificacoes=$(($csts | ForEach-Object { $_.classificacoes.Count } | Measure-Object -Sum).Sum)"

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$json = $newBase | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText(
    [System.IO.Path]::GetFullPath($OutputPath),
    $json + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Output "Base gerada em: $OutputPath"
