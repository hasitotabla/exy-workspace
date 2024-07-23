import { useServer } from "./_Server";
import { buildServer } from "../code/Build";

if (import.meta && import.meta.main) {
  console.log("Building server...");
  await buildServer();
  console.log("Build finished");

  const server = useServer();
  server.start();
}
