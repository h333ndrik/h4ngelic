import test from 'node:test';
import assert from 'node:assert/strict';
import { isReplyAddress } from '../server/inquiry.mjs';

// MAIL-02: the contact field is free text ("email, instagram, phone number…").
// Only a bare address may become Reply-To; everything else must simply produce
// no header, never an error and never an injected header line.
test('a plain address becomes the reply target', () => {
  for (const value of ['visitor@example.com', 'max@example.com', 'first.last+tag@sub.example.co.uk']) {
    assert.equal(isReplyAddress(value), true, value);
  }
});

test('handles, phone numbers and other free text are not addresses', () => {
  for (const value of ['@h4ndrik', '+49 176 1234', 'instagram: h4ngelic', 'Max <max@example.com>', 'max@example', 'example.com']) {
    assert.equal(isReplyAddress(value), false, value);
  }
});

test('header injection through CR, LF or control characters is rejected', () => {
  for (const value of ['visitor@example.com\r\nBcc: evil@example.com', 'visitor@example.com\nBcc: evil@example.com',
    'visitor@example.com\r', 'visitor@example.com\x00', 'visitor@example.com\x1f', 'visitor@example.com\x7f']) {
    assert.equal(isReplyAddress(value), false, JSON.stringify(value));
  }
});

test('leading or trailing whitespace, empty values and over-long values are not addresses', () => {
  for (const value of ['', ' ', ' visitor@example.com', 'visitor@example.com ', null, undefined, 42]) {
    assert.equal(isReplyAddress(value), false, String(value));
  }
  assert.equal(isReplyAddress(`${'a'.repeat(245)}@example.com`), false, 'over the 254-character limit');
  assert.equal(isReplyAddress(`${'a'.repeat(65)}@example.com`), false, 'local part over 64 characters');
});

test('malformed local and domain parts are rejected', () => {
  for (const value of ['.visitor@example.com', 'visitor.@example.com', 'visi..tor@example.com',
    'visitor@-example.com', 'visitor@example-.com', 'visitor@example..com', 'visitor@example.c', 'visitor@@example.com']) {
    assert.equal(isReplyAddress(value), false, value);
  }
});
