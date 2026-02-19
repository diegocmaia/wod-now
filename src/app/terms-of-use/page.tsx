import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms governing use of the WOD Now website and API.',
  alternates: {
    canonical: '/terms-of-use'
  }
};

export default function TermsOfUsePage() {
  return (
    <main className="legal">
      <h1>Terms of Use</h1>
      <p className="muted">Last updated: February 19, 2026</p>

      <p>
        By accessing WOD Now, you agree to use the website and API in accordance with these terms.
      </p>

      <h2>Permitted Use</h2>
      <ul>
        <li>Use the service for lawful purposes only.</li>
        <li>Avoid attempts to disrupt, overload, or abuse the platform.</li>
        <li>Comply with published request limits and security controls.</li>
      </ul>

      <h2>Service Availability</h2>
      <p>
        The service is provided on an as-is, as-available basis. We may change or discontinue
        features at any time.
      </p>

      <h2>Content and Liability</h2>
      <p>
        Workout content is provided for general informational purposes and is not medical advice.
        You are responsible for evaluating whether a workout is appropriate for your condition and
        training level.
      </p>

      <h2>Prohibited Actions</h2>
      <ul>
        <li>Attempting unauthorized access to infrastructure or administrative endpoints.</li>
        <li>Automated scraping or probing intended to bypass protections.</li>
        <li>Use that violates applicable law.</li>
      </ul>

      <h2>Updates to Terms</h2>
      <p>
        We may revise these terms by posting an updated version on this page. Continued use after
        changes means you accept the updated terms.
      </p>
    </main>
  );
}
