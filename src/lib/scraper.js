import { sanitizeData } from './security';

// Puppeteer scraper disabled for Vercel compatibility.
// Profile data is fetched via the Voyager API (linkedin.js) instead.
export const scrapeLinkedInProfile = async (profileUrl, overrideCookie) => {
  console.warn('scrapeLinkedInProfile is disabled. Use fetchFullProfile from linkedin.js instead.');
  return {
    name: 'User',
    headline: 'Professional',
    summary: '',
    experiences: [],
    skills: [],
    posts: []
  };
};
