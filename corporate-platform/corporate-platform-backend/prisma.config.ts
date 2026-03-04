/* eslint-disable prettier/prettier */
import 'dotenv/config';

export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'npx ts-node prisma/seed.ts',
  },
// eslint-disable-next-line prettier/prettier
}