const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const mongoUrl =
  process.env.NODE_ENV === 'production'
    ? process.env.PRODUCTION_DB_ADDRESS
    : process.env.LOCAL_DB_ADDRESS;

mongoose
  .connect(mongoUrl, {
    useNewUrlParser: true,
  })
  .then(() => console.log('Connected to Database:', mongoUrl))
  .catch((error) => console.log('Error connecting to Database:', error));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
