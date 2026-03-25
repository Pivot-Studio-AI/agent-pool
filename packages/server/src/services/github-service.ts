const GITHUB_API = 'https://api.github.com';

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  description: string | null;
}

/**
 * Exchange an OAuth code for an access token.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description ?? data.error}`);
  }

  if (!data.access_token) {
    throw new Error('No access_token in GitHub response');
  }

  return data.access_token;
}

/**
 * Fetch the authenticated GitHub user.
 */
export async function getUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub /user failed: ${res.status}`);
  }

  const data = (await res.json()) as GitHubUser;
  return { id: data.id, login: data.login, avatar_url: data.avatar_url };
}

/**
 * List repositories accessible to the authenticated user.
 */
export async function listRepos(
  token: string,
  page = 1,
  perPage = 100,
): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${GITHUB_API}/user/repos?sort=updated&per_page=${perPage}&type=all&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`GitHub /user/repos failed: ${res.status}`);
  }

  const repos = (await res.json()) as GitHubRepo[];
  return repos.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    html_url: r.html_url,
    default_branch: r.default_branch,
    private: r.private,
    description: r.description,
  }));
}

/**
 * Fetch a single repository by full name (e.g. "owner/repo").
 */
export async function getRepo(token: string, fullName: string): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub /repos/${fullName} failed: ${res.status}`);
  }

  const r = (await res.json()) as GitHubRepo;
  return {
    id: r.id,
    full_name: r.full_name,
    html_url: r.html_url,
    default_branch: r.default_branch,
    private: r.private,
    description: r.description,
  };
}
