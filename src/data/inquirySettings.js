/** Public form configuration only. Delivery credentials belong on the server. */
export const inquirySettings = Object.freeze({
  endpoint: '/api/inquiry',
  email: 'h4ngelic@gmail.com',
  maximumFiles: 5,
  // Vercel's serverless body ceiling is roughly 4.5 MB. Keep the complete
  // request under 4 MB and reserve 64 KB for multipart headers and fields.
  maximumRequestBytes: 4 * 1024 * 1024,
  maximumFileBytes: 4 * 1024 * 1024 - 64 * 1024,
  maximumTotalBytes: 4 * 1024 * 1024 - 64 * 1024,
  accept: '.jpg,.jpeg,.png,.webp,.avif,.gif,.pdf,image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf',
  supportedTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'application/pdf']),
  maximumNameLength: 120,
  maximumMessageLength: 8000,
});
