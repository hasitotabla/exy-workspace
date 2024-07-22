import * as bun from "bun";

export const useArguments = () => {
  const get = <T = any>(key: string, defaultValue: T, aliases: string[] = []): T => {
    const index = process.argv.indexOf(key);
    if (index !== -1) return process.argv[index + 1] as T;

    for (const alias of aliases)
      if (process.argv.includes(alias)) return process.argv[index + 1] as T;

    return defaultValue;
  };

  return {
    get,
  };
};
