export interface Expression {
  pattern: RegExp;
  handler: (
    match: RegExpMatchArray,
    input: string,
    values: {
      write: (key: string, value: string) => void;
      read: (key: string) => string | null;
      exists: (key: string) => boolean;
    }
  ) => string;
}

const EXPRESSIONS: { [key: string]: Expression } = {
  define: {
    pattern: /\/\* #define ([a-zA-Z0-9_]+) (.*?) ?\*\//ms,
    handler(match, input, values) {
      const key = match[1];
      const value = match[2];

      values.write(key, value !== "" ? value : "null");

      return input.replace(match[0], "");
    },
  },
  read: {
    pattern: /\/\* #read ([a-zA-Z0-9_]+) \*\//ms,
    handler(match, input, values) {
      const key = match[1];
      const value = values.read(key);

      return input.replace(match[0], value || "");
    },
  },
  ifdef: {
    pattern: /\/\* #ifdef ([a-zA-Z0-9_]+) \*\/(.*?)\/\* #endif \*\//ms,
    handler(match, input, values) {
      const key = match[1];
      const content = match[2];

      if (!values.read(key)) {
        return input.replace(match[0], "");
      }

      return input.replace(match[0], content);
    },
  },
  if: {
    pattern: /\/\* #if ([a-zA-Z0-9_]+)(\s?)==(\s?)(.*?) \*\/(.*?)\/\* #endif \*\//ms,
    handler(match, input, values) {
      const key = match[1];
      const value = match[4];
      const content = match[5];

      const definedValue = values.read(key);
      if (!definedValue) {
        return input.replace(match[0], "");
      }

      const evaluated = eval(`${definedValue} == ${value}`);
      if (!evaluated) {
        return input.replace(match[0], "");
      }

      return input.replace(match[0], content);
    },
  },
};

export default class Preprocessor {
  constructor() {}

  process(input: string): string {
    let match;

    const definedValues: { [key: string]: string } = {};
    const definedActions = {
      write: (key: string, value: string) => (definedValues[key] = value),
      read: (key: string) =>
        definedValues[key] !== undefined ? definedValues[key] : null,
      exists: (key: string) => definedValues[key] !== undefined,
    };

    while ((match = input.match(/\/\* #([a-zA-Z0-9_]+)/ms)) !== null) {
      const statement = match[1];
      const expression = EXPRESSIONS[statement];

      if (!expression) {
        input = input.replace(match[0], "");
        continue;
      }

      const expMatch = expression.pattern.exec(input);
      if (!expMatch) {
        console.log(expression.pattern, match);
        input = input.replace(match[0], "");
        continue;
      }

      input = expression.handler(expMatch, input, definedActions);
    }

    return input;
  }
}
