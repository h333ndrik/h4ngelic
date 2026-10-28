import { createInquiryHandler } from '../server/inquiry.mjs';

/** Vercel Serverless wrapper: Vercel's Node runtime passes compatible
 * IncomingMessage/ServerResponse objects, so the hardened inquiry
 * handler runs unchanged. One warm instance per deployment. */
const handler = createInquiryHandler();

export default async function inquiryEndpoint(req, res) {
  await handler(req, res);
}
