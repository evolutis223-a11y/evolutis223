export interface CompositionCout {
  matieres: { nom: string; qte: number; cout: number }[];
  mo: { nom: string; heures: number; taux: number; forfait: number }[];
  frais: { nom: string; montant: number }[];
  margePct: number;
}

export function calculerPrixRevient(c: CompositionCout): number {
  const matieresTotal = c.matieres.reduce((s, m) => s + m.qte * m.cout, 0);
  const moTotal = c.mo.reduce((s, m) => s + m.heures * m.taux + m.forfait, 0);
  const fraisTotal = c.frais.reduce((s, f) => s + f.montant, 0);
  const coutTotal = matieresTotal + moTotal + fraisTotal;
  return coutTotal * (1 + c.margePct / 100);
}
