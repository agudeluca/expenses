import { useEffect, useState } from "react";

interface Codec<T> {
  serialize: (v: T) => string;
  deserialize: (raw: string) => T;
}

const jsonCodec = <T>(): Codec<T> => ({
  serialize: (v) => JSON.stringify(v),
  deserialize: (raw) => JSON.parse(raw) as T,
});

export function usePersistedState<T>(
  key: string,
  initial: T,
  codec: Codec<T> = jsonCodec<T>()
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return codec.deserialize(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, codec.serialize(value));
    } catch {
      // localStorage may be disabled — silent fail
    }
  }, [key, value]);

  return [value, setValue];
}

export function setCodec<T>(): Codec<Set<T>> {
  return {
    serialize: (s) => JSON.stringify([...s]),
    deserialize: (raw) => new Set(JSON.parse(raw) as T[]),
  };
}
