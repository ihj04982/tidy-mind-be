const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const routes = require('./routes/route');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);

const mongoUrl =
  process.env.NODE_ENV === 'production'
    ? process.env.PRODUCTION_DB_ADDRESS
    : process.env.LOCAL_DB_ADDRESS;

mongoose
  .connect(mongoUrl)
  .then(() => console.log('Connected to Database:', mongoUrl))
  .catch((error) => console.log('Error connecting to Database:', error));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});