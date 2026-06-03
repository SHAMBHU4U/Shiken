import app from "./app";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? "3000");

app.listen(port, "0.0.0.0", () => {
  console.log(`API server listening on port ${port}`);
});
