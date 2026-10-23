import ubq from './1ubq.json';
import hew from './1hew.json';
import hhb from './4hhb.json';
import cll from './1cll.json';
import iep from './1iep.json';
import znf from './1znf.json';
import afP53 from './af_p53.json';
import afCam from './af_cam.json';

// Real structures from the RCSB Protein Data Bank, converted by a small script:
// coordinates in Ångström, centred on the Cα centroid, hydrogens and water removed.

export interface Chain {
  id: string;
  seq: string;
  /** Per residue: H helix, E strand, C coil (from the PDB HELIX/SHEET records). */
  ss: string;
  /** Flat xyz triples per residue. */
  ca: number[];
  c: number[];
  o: number[];
}

export interface Ligand {
  name: string;
  /** [element, x, y, z] */
  atoms: [string, number, number, number][];
  bonds: [number, number][];
}

export interface Molecule {
  id: string;
  chains: Chain[];
  /** [element, chainIndex, residueIndex, x, y, z] */
  atoms: [string, number, number, number, number, number][];
  ligands: Ligand[];
}

export const MOL = {
  /** Ubiquitin — the chain that runs through the talk. */
  ubiquitin: ubq as unknown as Molecule,
  /** Hen egg-white lysozyme with a bound sugar chain (an enzyme and its substrate analogue). */
  lysozyme: hew as unknown as Molecule,
  /** Human deoxyhaemoglobin: four chains, four haem groups. */
  haemoglobin: hhb as unknown as Molecule,
  /** Calmodulin with four calcium ions. */
  calmodulin: cll as unknown as Molecule,
  /** ABL kinase domain with the cancer drug imatinib (STI-571). */
  abl: iep as unknown as Molecule,
  /** A single zinc finger (Xfin-31, NMR model 1): two Cys and two His hold one zinc ion. */
  zincFinger: znf as unknown as Molecule,
};

/** AlphaFold DB predictions (model v4, via the AlphaFill mirror), with per-residue pLDDT. */
export interface Predicted extends Molecule {
  plddt: number[];
  version: string;
}

export const AF = {
  /** Human p53 (AF-P04637-F1): folded DNA-binding domain, long disordered tails. */
  p53: afP53 as unknown as Predicted,
  /** Human calmodulin-1 (AF-P0DP23-F1): two lobes joined by a linker. */
  calmodulin: afCam as unknown as Predicted,
};

export const aminoAcidFa: Record<string, string> = {
  A: 'آلانین',
  R: 'آرژینین',
  N: 'آسپاراژین',
  D: 'آسپارتات',
  C: 'سیستئین',
  Q: 'گلوتامین',
  E: 'گلوتامات',
  G: 'گلیسین',
  H: 'هیستیدین',
  I: 'ایزولوسین',
  L: 'لوسین',
  K: 'لیزین',
  M: 'متیونین',
  F: 'فنیل‌آلانین',
  P: 'پرولین',
  S: 'سرین',
  T: 'ترئونین',
  W: 'تریپتوفان',
  Y: 'تیروزین',
  V: 'والین',
};

/** All heavy-atom coordinates of a molecule as one flat array. */
export function atomXYZ(m: Molecule) {
  const out = new Float32Array(m.atoms.length * 3);
  m.atoms.forEach((a, i) => {
    out[i * 3] = a[3];
    out[i * 3 + 1] = a[4];
    out[i * 3 + 2] = a[5];
  });
  return out;
}
