import dotenv from 'dotenv';

dotenv.config({ path: '../.env.e2e' });

async function globalTeardown() {
}

export default globalTeardown;
