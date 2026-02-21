/** Shared auto-incrementing ID counter for all entity types. */

let nextId = 1;

export function generateId(): number {
  return nextId++;
}
