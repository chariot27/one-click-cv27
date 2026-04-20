import { generatePDF } from '@/lib/generator';
import { ResumeTemplate } from '@/components/ResumeTemplate';
import { fetchFullProfile } from '@/lib/linkedin';
import { optimizeForATS } from '@/lib/ats-optimizer';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch(e) {}

    const { liAtCookie, vanityName, extraContacts } = body;

    // Use cookie from body or env
    let cookie = liAtCookie || process.env.LINKEDIN_SESSION_COOKIE;
    let vName = vanityName;

    if (!cookie || !vName) {
      return new Response(JSON.stringify({ 
        error: 'setup_required',
        message: 'Please provide your LinkedIn cookie and vanity name.' 
      }), { status: 400 });
    }

    // Fetch full profile via Puppeteer
    console.log(`Fetching full profile for: ${vName}`);
    const profileData = await fetchFullProfile(vName, cookie);

    // If profile came back empty, cookie likely expired
    if (profileData.experiences.length === 0 && profileData.certifications.length === 0 && profileData.skills.length === 0) {
      console.log('Profile data empty - likely cookie expired');
      // Don't return error - still generate PDF with whatever we have
    }

    // Merge with session data
    if (!profileData.name || profileData.name === 'User') {
      profileData.name = session.user.name || 'User';
    }
    if (!profileData.email) {
      profileData.email = session.user.email || '';
    }

    // Merge extra contacts (user-supplied overrides from dashboard)
    if (extraContacts) {
      if (extraContacts.phone) profileData.phone = extraContacts.phone;
      if (extraContacts.github) profileData.github = extraContacts.github;
      if (extraContacts.twitter) profileData.twitter = extraContacts.twitter;
      if (extraContacts.website) profileData.website = extraContacts.website;
    }

    console.log('Final CV data:', JSON.stringify({
      name: profileData.name,
      headline: profileData.headline,
      experiencesCount: profileData.experiences.length,
      certificationsCount: profileData.certifications.length,
      educationCount: profileData.education.length,
      skillsCount: profileData.skills.length,
      postsCount: profileData.posts.length,
    }, null, 2));

    // ── ATS Optimization ──────────────────────────────────────────────────────
    const { optimizedData, scoreReport } = optimizeForATS(profileData);
    console.log(`ATS Score: ${scoreReport.totalScore}/100`);

    return new Response(JSON.stringify({ 
      success: true,
      data: optimizedData,
      atsScore: scoreReport.totalScore 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
