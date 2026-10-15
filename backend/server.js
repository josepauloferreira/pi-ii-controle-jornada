const express = require("express");
require("./database"); // Cria o arquivo SQLite e as tabelas ao iniciar.

const app = express();
const porta = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(porta, "127.0.0.1", () => {
  console.log(`Backend iniciado em http://localhost:${porta}`);
});
