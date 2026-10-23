import data from './globins.json';

// Globin family data (built from UniProt + PDB 4HHB by a small script):
// a 9-sequence alignment (center-star, BLOSUM62) and the superposition of the human
// haemoglobin β chain onto the α chain.

export interface GlobinRow {
  key: string;
  label: string;
  entry: string;
  accession: string;
  seq: string;
  aligned: string;
}

export const GLOBINS = data as unknown as {
  rows: GlobinRow[];
  conserved: number[];
  proximalHis: { column: number; residues: string };
  distalHis: { column: number; residues: string };
  alphaBeta: {
    aligned: number;
    identical: number;
    identity: number;
    rmsd: number;
    matrix: number[];
    rmsdRefit: number;
    matrixRefit: number[];
    refitPairs: number;
    pairs: [number, number][];
  };
};

/** Row-major 4×4 that carries β-chain coordinates (PDB 4HHB chain B) onto the α chain (chain A). */
export const betaOntoAlpha = () => GLOBINS.alphaBeta.matrixRefit;
