export type Required<T> = T extends Partial<infer R> ? R : T;
