export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export function createIterable(length: number) {
  return new Array(length).fill(1);
}
