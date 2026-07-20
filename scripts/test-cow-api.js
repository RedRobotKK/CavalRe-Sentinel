#!/usr/bin/env node

/**
 * Test CoW Protocol API endpoints
 * Find which endpoints are working
 */

import axios from 'axios';

const endpoints = [
  'https://api.cow.fi/mainnet/api/v1/orders',
  'https://api.cow.fi/mainnet/api/v1/settlements',
  'https://api.cow.fi/mainnet/api/orders',
  'https://api.cow.fi/mainnet/orders',
  'https://api.cow.fi/v1/orders',
  'https://barn.api.cow.fi/mainnet/api/v1/orders',
];

async function testEndpoint(url) {
  try {
    console.log(`Testing: ${url}`);
    const response = await axios.get(url, {
      params: { limit: 1 },
      timeout: 5000,
    });
    console.log(`✅ SUCCESS (${response.status})`);
    console.log(`   Response keys: ${Object.keys(response.data).slice(0, 3).join(', ')}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed (${error.response?.status || error.code}): ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Testing CoW Protocol API endpoints...\n');

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    console.log();
  }
}

await main();
