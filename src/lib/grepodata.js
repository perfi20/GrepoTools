let cachedToken = null;
let tokenExpiresAt = 0;

export async function getGrepoDataToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const mail = process.env.GREPODATA_USERNAME;
  const password = process.env.GREPODATA_PASSWORD;

  if (!mail || !password || mail === 'YOUR_EMAIL') {
    throw new Error('Grepodata credentials not configured in .env');
  }

  const response = await fetch('https://api.grepodata.com/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ mail, password }).toString()
  });

  const data = await response.json();
  if (data.success && data.access_token) {
    cachedToken = data.access_token;
    // Buffer the expiration by 5 minutes to be safe
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken;
  } else {
    throw new Error('Failed to authenticate with Grepodata: ' + JSON.stringify(data));
  }
}

export async function getPlayerIntel(world, playerId) {
  const token = await getGrepoDataToken();
  const url = new URL('https://api.grepodata.com/indexer/v2/player');
  url.searchParams.append('access_token', token);
  url.searchParams.append('world', world);
  url.searchParams.append('player_id', playerId);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

export async function getTownIntel(world, townId) {
  const token = await getGrepoDataToken();
  const url = new URL('https://api.grepodata.com/indexer/v2/town');
  url.searchParams.append('access_token', token);
  url.searchParams.append('world', world);
  url.searchParams.append('town_id', townId);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}
