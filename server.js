const cors = require("cors");
const express = require("express");

const app = express();

//Connect to database
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/users", require("./routes/users.js"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Open Times API running...");
});
