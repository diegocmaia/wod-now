import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How WOD Now handles operational data, cookies, and usage information.',
  alternates: {
    canonical: '/privacy-policy'
  }
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: February 19, 2026</p>

      <p>
        WOD Now provides a random workout generator and related API endpoints. This policy explains
        what information we process to run the service.
      </p>

      <h2>Information We Process</h2>
      <ul>
        <li>Request metadata such as IP address and user agent for abuse protection and rate limiting.</li>
        <li>Request URLs and headers required to deliver the requested page or API response.</li>
      </ul>

      <h2>Cookies and Analytics</h2>
      <p>
        WOD Now does not use advertising cookies, analytics cookies, or third-party tracking scripts
        at this time.
      </p>

      <h2>How Data Is Used</h2>
      <ul>
        <li>To serve pages and API responses.</li>
        <li>To apply security controls such as bot blocking, rate limits, and temporary lockouts.</li>
      </ul>

      <h2>Data Sharing</h2>
      <p>
        We do not sell personal information. Data is processed by our hosting and infrastructure
        providers only as needed to operate the service.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this policy as the product evolves. Updates will be posted on this page with
        a revised date.
      </p>
    </main>
  );
}
