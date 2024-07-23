import type { IResourceHooks, MaybePromise, ResourceHookSharedData } from "./types/Hooks";

type HookHandlerData<T extends keyof IResourceHooks> = ResourceHookSharedData & {
  data: Parameters<IResourceHooks[T]>[0];
};

type HookHandler<T extends keyof IResourceHooks> = (
  data: HookHandlerData<T>
) => MaybePromise<ReturnType<IResourceHooks[T]>>;

export function createHook<E extends keyof IResourceHooks>(
  hookName: E,
  handler: HookHandler<E>
) {
  return async (data: HookHandlerData<E>) => {
    const ctx = { ...data };
    const result = await handler(ctx);

    return {
      ctx: { manifest: ctx.manifest },
      returned: result,
    };
  };
}
