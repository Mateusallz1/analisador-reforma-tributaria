import { GroupedAnalysis, ItemClassificationStatus, NFeAnalysis } from '../types';

export interface ItemStats {
  totalItems: number;
  applicableItems: number;
  compliantItems: number;
  pendingItems: number;
  nonCompliantItems: number;
  outOfScopeItems: number;
  entradaItems: number;
  saidaItems: number;
  complianceRate: number;
}

export function getNoteItemCount(note: NFeAnalysis): number {
  return note.itens && note.itens.length > 0 ? note.itens.length : 1;
}

function getFallbackItemStatus(note: NFeAnalysis): ItemClassificationStatus {
  return note.status === 'CONFORME' ? 'conforme' : 'N/A';
}

export function calculateItemStats(notes: NFeAnalysis[]): ItemStats {
  const stats: Omit<ItemStats, 'applicableItems' | 'complianceRate'> = {
    totalItems: 0,
    compliantItems: 0,
    pendingItems: 0,
    nonCompliantItems: 0,
    outOfScopeItems: 0,
    entradaItems: 0,
    saidaItems: 0,
  };

  notes.forEach((note) => {
    const noteItems = note.itens && note.itens.length > 0
      ? note.itens
      : [{ itemStatus: getFallbackItemStatus(note) }];

    noteItems.forEach((item) => {
      stats.totalItems += 1;

      if (note.tipoNota === 'SAÍDA') {
        stats.saidaItems += 1;
      } else {
        stats.entradaItems += 1;
      }

      if (item.itemStatus === 'conforme') {
        stats.compliantItems += 1;
      } else if (item.itemStatus === 'N/A' || !item.itemStatus) {
        stats.outOfScopeItems += 1;
      } else if (note.status === 'AUTORIZADA_COM_PENDENCIAS') {
        stats.pendingItems += 1;
      } else {
        stats.nonCompliantItems += 1;
      }
    });
  });

  const applicableItems = stats.totalItems - stats.outOfScopeItems;

  return {
    ...stats,
    applicableItems,
    complianceRate: applicableItems > 0
      ? Math.round((stats.compliantItems / applicableItems) * 100)
      : 0,
  };
}

export function groupAnalysesByEmpresaFoco(results: NFeAnalysis[]): GroupedAnalysis[] {
  const groupedByCnpj: Record<string, NFeAnalysis[]> = {};

  results
    .filter((result) => result.empresaFoco.cnpj && result.empresaFoco.cnpj.trim() !== '')
    .forEach((result) => {
      const cnpj = result.empresaFoco.cnpj;
      groupedByCnpj[cnpj] = groupedByCnpj[cnpj] || [];
      groupedByCnpj[cnpj].push(result);
    });

  return Object.keys(groupedByCnpj).map((cnpj) => {
    const notas = groupedByCnpj[cnpj];
    const stats = calculateItemStats(notas);
    const namedNote = notas.find(
      (note) =>
        note.empresaFoco.nome &&
        note.empresaFoco.nome !== 'Emitente sem nome' &&
        note.empresaFoco.nome !== 'Destinatário sem nome',
    );

    return {
      empresaFoco: {
        cnpj,
        nome: namedNote?.empresaFoco.nome || notas[0]?.empresaFoco.nome || 'Empresa não identificada',
      },
      notas,
      totalNotas: stats.totalItems,
      conformeNotas: stats.compliantItems,
      naoConformeNotas: stats.pendingItems + stats.nonCompliantItems,
      porcentagemEmConformidade: stats.complianceRate,
    };
  });
}
