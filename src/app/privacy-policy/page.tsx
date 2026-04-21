import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

export const metadata = {
  title: 'Privacy Notice — Basey Fare Check',
  description:
    'How Basey Fare Check collects, uses, and protects your personal data in accordance with the Data Privacy Act of 2012 (RA 10173).',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900">Privacy Notice</h1>
          <p className="mt-2 text-sm text-gray-500">
            Version: {CURRENT_PRIVACY_NOTICE_VERSION} &mdash; Basey Fare Check
          </p>
          <p className="mt-4 text-base text-gray-700">
            This Privacy Notice explains how Basey Fare Check collects, uses, and handles your
            personal data when you register for and use this service. It is issued in accordance
            with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> of the
            Philippines and its implementing rules and regulations.
          </p>
        </div>

        <div className="space-y-10">
          {/* 1. Who We Are */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Who We Are</h2>
            <div className="mt-3 space-y-2 text-gray-700">
              <p>
                <strong>Basey Fare Check</strong> is a Transportation Fare Reference System
                operated to help the public verify official transportation fare schedules in
                Basey, Samar.
              </p>
              <p>
                For questions or concerns regarding your personal data, you may contact the
                responsible office or system administrator through the official communication
                channels made available within the application.
              </p>
            </div>
          </section>

          {/* 2. What Data We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. What Data We Collect</h2>
            <p className="mt-3 text-gray-700">
              When you register for an account, we collect the following personal data that you
              provide directly through the registration form:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-700">
              <li>Full name (first name and last name)</li>
              <li>Email address</li>
              <li>Mobile phone number</li>
              <li>Date of birth (optional, for age verification)</li>
              <li>Government-issued identification type and identification number</li>
              <li>Barangay of residence</li>
              <li>Account credentials (username; password stored in hashed form only)</li>
            </ul>
            <p className="mt-3 text-gray-700">
              We also automatically record the following operational data when you use the
              service:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-700">
              <li>Date and time of account creation and last login</li>
              <li>IP address at registration and last login (for security purposes)</li>
              <li>Privacy Notice acknowledgment timestamp and version</li>
            </ul>
          </section>

          {/* 3. Why We Collect It */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Why We Collect This Data</h2>
            <p className="mt-3 text-gray-700">
              Your personal data is collected and used for the following purposes:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-700">
              <li>
                <strong>Account creation and management</strong> — to create and maintain your
                user account in the system
              </li>
              <li>
                <strong>Authentication and access control</strong> — to verify your identity
                when you log in and to restrict access to authorized users only
              </li>
              <li>
                <strong>Service delivery</strong> — to provide you with access to fare reference
                information and related features
              </li>
              <li>
                <strong>Identity verification</strong> — to verify your identity through
                government-issued identification where applicable
              </li>
              <li>
                <strong>Security and fraud prevention</strong> — to detect, investigate, and
                prevent unauthorized access and other security incidents
              </li>
              <li>
                <strong>Legal and regulatory compliance</strong> — to comply with applicable
                laws and regulations
              </li>
            </ul>
          </section>

          {/* 4. Processing Basis */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Basis for Processing</h2>
            <div className="mt-3 space-y-3 text-gray-700">
              <p>
                The personal data you provide during registration is processed because it is{' '}
                <strong>necessary to create and operate your account</strong> and to provide you
                with access to the service you have requested. Without this data, we cannot
                create an account for you.
              </p>
              <p>
                For operational security data (such as login timestamps and IP addresses), processing
                is based on our <strong>legitimate interest</strong> in maintaining the security
                and integrity of the system.
              </p>
              <p>
                We do not use mandatory registration data for unrelated marketing, profiling, or
                other secondary purposes.
              </p>
            </div>
          </section>

          {/* 5. Who May Receive the Data */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Who May Receive Your Data</h2>
            <p className="mt-3 text-gray-700">
              Your personal data may be accessed by or disclosed to:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-700">
              <li>
                <strong>Authorized system administrators and staff</strong> — who manage and
                operate the system, subject to confidentiality obligations
              </li>
              <li>
                <strong>Technology service providers</strong> — third-party infrastructure
                providers (such as database and hosting services) used to operate the system,
                who process data on our behalf under appropriate agreements
              </li>
              <li>
                <strong>Government authorities</strong> — where required by law, court order, or
                other valid legal process
              </li>
            </ul>
            <p className="mt-3 text-gray-700">
              We do not sell or share your personal data for commercial purposes.
            </p>
          </section>

          {/* 6. Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Data Retention</h2>
            <div className="mt-3 space-y-3 text-gray-700">
              <p>
                Account data is retained for as long as your account remains active. If your
                account is deactivated or deleted, personal data associated with the account
                will be retained for a reasonable period as required for legal, audit, and
                security purposes, after which it will be securely deleted or anonymized.
              </p>
              <p>
                Security-related logs (such as login records and IP addresses) are retained for
                a limited period consistent with security and audit requirements.
              </p>
            </div>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Your Rights</h2>
            <p className="mt-3 text-gray-700">
              Under the Data Privacy Act of 2012, you have the following rights regarding your
              personal data:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700">
              <li>
                <strong>Right to be informed</strong> — to be informed of how your personal data
                is collected and processed (this Notice fulfills that obligation)
              </li>
              <li>
                <strong>Right to access</strong> — to request a copy of the personal data we
                hold about you
              </li>
              <li>
                <strong>Right to correction</strong> — to request correction of inaccurate or
                outdated personal data
              </li>
              <li>
                <strong>Right to erasure or blocking</strong> — to request that your personal
                data be deleted or blocked, subject to applicable legal retention requirements
              </li>
              <li>
                <strong>Right to data portability</strong> — to request your personal data in a
                structured, commonly used format
              </li>
              <li>
                <strong>Right to lodge a complaint</strong> — to file a complaint with the
                National Privacy Commission (NPC) if you believe your data privacy rights have
                been violated
              </li>
            </ul>
            <p className="mt-3 text-gray-700">
              To exercise any of these rights, please contact the responsible office or system
              administrator through the official channels available within the application.
            </p>
          </section>

          {/* 8. Changes to This Notice */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Changes to This Notice</h2>
            <div className="mt-3 space-y-3 text-gray-700">
              <p>
                We may update this Privacy Notice from time to time to reflect changes in our
                practices or applicable law. When we make material changes, we will update the
                version date shown at the top of this page and, where appropriate, notify
                registered users through the application.
              </p>
              <p>
                The current version of this Privacy Notice is{' '}
                <strong>{CURRENT_PRIVACY_NOTICE_VERSION}</strong>.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          Basey Fare Check &mdash; Transportation Fare Reference System
          <br />
          Privacy Notice version {CURRENT_PRIVACY_NOTICE_VERSION}
        </div>
      </div>
    </div>
  )
}
