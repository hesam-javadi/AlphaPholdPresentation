import type { Scene } from '../../deck';
import type { Ctx } from '../ctx';
import { makeNet } from './common';
import { netIntroScenes } from './intro';
import { netEvoScenes } from './evoformer';

/** Chapter 2: the AlphaFold network, told on one board — the Evoformer figure from the paper. */
export function networkScenes(ctx: Ctx): Scene[] {
  const net = makeNet(ctx);
  return [...netIntroScenes(ctx, net), ...netEvoScenes(ctx, net)];
}
