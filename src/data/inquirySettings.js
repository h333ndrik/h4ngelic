/** Public form configuration only. Delivery credentials belong on the server. */
export const inquirySettings = Object.freeze({
  endpoint: '/api/inquiry',
  email: 'h4ngelic@gmail.com',
  maximumFiles: 5,
  maximumFileBytes: 5 * 1024 * 1024,
  maximumTotalBytes: 12 * 1024 * 1024,
  accept: '.jpg,.jpeg,.png,.webp,.avif,.gif,.pdf,image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf',
  supportedTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'application/pdf']),
  maximumNameLength: 120,
  maximumMessageLength: 8000,
});
