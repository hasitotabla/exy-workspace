export const WorkerWrapper = (instance: Worker) => {
  const events: { [key: string]: Function[] } = {};

  instance.onmessage = (ev) => {
    const { event, data } = ev.data;
    if (!events[event]) return;

    for (const handler of events[event]) {
      handler(data);
    }
  };

  return {
    onEvent(event: string, handler: Function) {
      if (!events[event]) events[event] = [];

      events[event].push(handler);
    },
  };
};
