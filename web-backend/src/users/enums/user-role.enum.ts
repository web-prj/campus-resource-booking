/**
 * Roles from the proposal. Kept as a string enum so the database value stays
 * readable and new roles can be added without renumbering.
 */
export enum UserRole {
  STUDENT = 'student',
  STAFF = 'staff',
  ADMIN = 'admin',
}
