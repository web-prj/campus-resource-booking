import { isStudentEmail } from './is-student-email.validator';

describe('isStudentEmail', () => {
  it('accepts a valid @usth.edu.vn address', () => {
    expect(isStudentEmail('student@usth.edu.vn')).toBe(true);
  });

  it('accepts dotted local parts', () => {
    expect(isStudentEmail('nam.tran@usth.edu.vn')).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isStudentEmail('Student@USTH.EDU.VN')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isStudentEmail('  student@usth.edu.vn  ')).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isStudentEmail('student@gmail.com')).toBe(false);
    expect(isStudentEmail('student@usth.edu')).toBe(false);
    expect(isStudentEmail('student@edu.vn')).toBe(false);
  });

  it('rejects subdomains of usth.edu.vn (strict match)', () => {
    expect(isStudentEmail('student@mail.usth.edu.vn')).toBe(false);
  });

  it('rejects look-alike domains', () => {
    expect(isStudentEmail('student@notusth.edu.vn')).toBe(false);
    expect(isStudentEmail('student@usth.edu.vn.evil.com')).toBe(false);
  });

  it('rejects an empty local part', () => {
    expect(isStudentEmail('@usth.edu.vn')).toBe(false);
  });

  it('rejects multiple @ signs', () => {
    expect(isStudentEmail('a@b@usth.edu.vn')).toBe(false);
  });

  it('rejects whitespace inside the address', () => {
    expect(isStudentEmail('student name@usth.edu.vn')).toBe(false);
    expect(isStudentEmail('student@ usth.edu.vn')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isStudentEmail(undefined)).toBe(false);
    expect(isStudentEmail(null)).toBe(false);
    expect(isStudentEmail(42)).toBe(false);
  });
});
