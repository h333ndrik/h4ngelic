import { temporalMoshSettings } from './data/temporalMoshSettings.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Carry actual prior-frame pixels through a bounded image ROI. The history
 * starts as an opaque source capture; it is never replaced by a transparent
 * overlay. Rendering finishes before feedback, so reads use the prior frame.
 * drawSource is supplied by the renderer's existing photo/film mapping.
 */
export function paintTemporalPixels({ context, history, historyContext, width, height, blocks,
  drawSource, frame = 0, settings = temporalMoshSettings }) {
  context.clearRect(0, 0, width, height);
  for (const block of blocks) {
    const sourceWidth = Math.min(block.width, width);
    const sourceHeight = Math.min(block.height, height);
    const offsetX = clamp(block.offsetX * settings.advectionRatio, -settings.maximumAdvectionPx, settings.maximumAdvectionPx);
    const offsetY = clamp(block.offsetY * settings.advectionRatio, -settings.maximumAdvectionPx, settings.maximumAdvectionPx);
    const sx = clamp(block.x - offsetX, 0, width - sourceWidth);
    const sy = clamp(block.y - offsetY, 0, height - sourceHeight);
    context.globalAlpha = block.opacity;
    context.drawImage(history, sx, sy, sourceWidth, sourceHeight, block.x, block.y,
      block.width + block.stretch, block.height);
    if (block.stripe) {
      context.globalAlpha = block.stripe.opacity;
      drawSource(context, block.stripe);
    }
  }
  context.globalAlpha = 1;

  // Advance old image pixels, then reconstruct a rotating fraction of damaged
  // cells. A changed live source cannot erase the captured frame in one paint.
  historyContext.globalCompositeOperation = 'source-over';
  historyContext.globalAlpha = settings.feedbackOpacity;
  historyContext.drawImage(context.canvas, 0, 0);
  const stride = Math.max(1, settings.reconstructionEvery);
  let reconstructed = 0;
  for (let index = frame % stride; index < blocks.length; index += stride) {
    const block = blocks[index];
    historyContext.globalAlpha = settings.minimumReconstruction
      + (settings.maximumReconstruction - settings.minimumReconstruction) * block.progress ** 2;
    drawSource(historyContext, { ...block, offsetX: 0, offsetY: 0, stretch: 0 });
    reconstructed++;
  }
  historyContext.globalAlpha = 1;
  return { drawn: blocks.length, reconstructed };
}
