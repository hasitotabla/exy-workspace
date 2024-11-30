export function deferredPromise(): {
    promise: Promise<any>;
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
} {
    let resolve: (value?: unknown) => void = () => {};
    let reject: (reason?: unknown) => void = () => {};

    const promise = new Promise<unknown>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}
