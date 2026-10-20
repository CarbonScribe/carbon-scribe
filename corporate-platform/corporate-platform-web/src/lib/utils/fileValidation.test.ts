import { validateFile, validateCertificateFile, MAX_UPLOAD_BYTES } from './fileValidation';

function fakeFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 8))], { type });
  const file = new File([blob], name, { type });
  // Report the requested size without allocating it.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateFile (#718)', () => {
  it('rejects disallowed types', () => {
    const r = validateFile(fakeFile('malware.exe', 100, 'application/x-msdownload'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not allowed/i);
  });

  it('rejects oversized files', () => {
    const r = validateFile(fakeFile('big.pdf', MAX_UPLOAD_BYTES + 1, 'application/pdf'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/maximum size/i);
  });

  it('accepts allowed PDF', () => {
    const r = validateFile(fakeFile('doc.pdf', 1024, 'application/pdf'));
    expect(r.ok).toBe(true);
  });

  it('certificate path only allows PDF', () => {
    expect(validateCertificateFile(fakeFile('x.png', 10, 'image/png')).ok).toBe(false);
    expect(validateCertificateFile(fakeFile('c.pdf', 10, 'application/pdf')).ok).toBe(true);
  });
});
