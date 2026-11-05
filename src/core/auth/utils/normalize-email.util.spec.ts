import { normalizeEmail } from './normalize-email.util';

describe('normalizeEmail', () => {
  it('removes spaces at the beginning and end', () => {
    expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
  });

  it('converts the email to lowercase', () => {
    expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
  });

  it('trims spaces and converts to lowercase together', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
  });
});
