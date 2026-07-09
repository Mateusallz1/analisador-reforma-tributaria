const generatedPaths = ["dist", "server.js"];

for (const path of generatedPaths) {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}
