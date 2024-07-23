import gitignore from "@gerhobbelt/gitignore-parser";

const content = `
**/webview/**/*
!**/webview/src/**/*
!**/webview/index.html
`.trim();

const parser = gitignore.compile(content);

console.log(
  parser.denies("/webview/vite.config.ts.timestamp-1721745060176-3a65535535fe9.mjs")
);
