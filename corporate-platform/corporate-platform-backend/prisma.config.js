// Prisma 7 configuration file
// See: https://pris.ly/d/prisma7-client-config

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
