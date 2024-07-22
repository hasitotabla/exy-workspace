type CacheKey = string | ((args: any[]) => string);

const store: {
  [key: string]: {
    result: any;
    validUntil: number;
  };
} = {};

export function Cacheable(key: CacheKey, ttl: number = 10000) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const cacheKey = typeof key === "string" ? key : key(args);

      if (store[cacheKey] && store[cacheKey].validUntil > Date.now()) {
        return store[cacheKey].result;
      }

      const result = originalMethod.apply(this, args);
      store[cacheKey] = {
        result,
        validUntil: Date.now() + ttl,
      };

      return result;
    };

    return descriptor;
  };
}
