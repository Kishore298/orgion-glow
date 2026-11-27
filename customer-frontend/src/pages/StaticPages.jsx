import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Mail, Phone, MapPin } from 'lucide-react';
import { STATIC_PAGES_CONTENT } from '../content/staticContent';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { OfficialInstagramIcon, OfficialWhatsAppIcon } from '../components/common/BrandIcons';

function LegalPolicyTemplate({ doc }) {
  return (
    <>
      <Helmet>
        <title>{doc.title}</title>
        <meta name="description" content={doc.description} />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-4 sm:pt-6 pb-10 sm:pb-16">
        <span className="label-micro">{doc.updated}</span>
        <h1 className="mt-1.5 font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary-dark">{doc.heading}</h1>
        <div className="mt-5 sm:mt-10 luxury-card p-4 sm:p-7 lg:p-10 space-y-4 sm:space-y-7">
          {doc.clauses.map((cl) => (
            <div key={cl.heading}>
              <h2 className="font-serif text-lg sm:text-xl font-semibold text-text">{cl.heading}</h2>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-base leading-relaxed text-text-muted">{cl.text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function TermsPage() {
  return <LegalPolicyTemplate doc={STATIC_PAGES_CONTENT.terms} />;
}

export function PrivacyPage() {
  return <LegalPolicyTemplate doc={STATIC_PAGES_CONTENT.privacy} />;
}

export function ShippingReturnsPage() {
  return <LegalPolicyTemplate doc={STATIC_PAGES_CONTENT.shipping} />;
}

export function ContactPage() {
  const siteConfig = useSiteConfig();
  const addr = siteConfig.businessAddress || {};

  return (
    <>
      <Helmet>
        <title>Contact Us — ORGION</title>
        <meta
          name="description"
          content="Reach ORGION in Nagercoil via WhatsApp, phone, email, or Instagram."
        />
      </Helmet>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-4 sm:pt-6 pb-10 sm:pb-16">
        <span className="label-micro">We Are Here To Help</span>
        <h1 className="mt-1.5 font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary-dark">Contact ORGION</h1>
        <p className="mt-2 text-xs sm:text-base text-text-muted max-w-xl">
          Have a question about our handmade skincare formulations, lip balms, or your order? Reach us directly through any of the channels below.
        </p>

        <div className="mt-5 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-6">
          <div className="luxury-card p-4 sm:p-6 flex items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Mail size={19} />
            </div>
            <div>
              <p className="label-micro">Email</p>
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="mt-1 block text-base font-medium text-text hover:text-primary"
              >
                {siteConfig.supportEmail}
              </a>
            </div>
          </div>

          <div className="luxury-card p-6 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Phone size={19} />
            </div>
            <div>
              <p className="label-micro">Mobile / Phone</p>
              <a
                href={`tel:${siteConfig.supportPhone.replace(/\s+/g, '')}`}
                className="mt-1 block text-base font-medium text-text hover:text-primary"
              >
                {siteConfig.supportPhone}
              </a>
            </div>
          </div>

          <div className="luxury-card p-6 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted">
              <OfficialWhatsAppIcon size={28} />
            </div>
            <div>
              <p className="label-micro">WhatsApp</p>
              <a
                href={`https://wa.me/${siteConfig.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-base font-medium text-primary hover:underline"
              >
                Chat with us on WhatsApp
              </a>
            </div>
          </div>

          <div className="luxury-card p-6 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted">
              <OfficialInstagramIcon size={26} />
            </div>
            <div>
              <p className="label-micro">Instagram</p>
              <a
                href={siteConfig.socialLinks?.instagram || 'https://www.instagram.com/orgion.we'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-base font-medium text-primary hover:underline"
              >
                @orgion.we
              </a>
            </div>
          </div>

          <div className="luxury-card p-6 flex items-start gap-4 sm:col-span-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <MapPin size={19} />
            </div>
            <div>
              <p className="label-micro">Location</p>
              <p className="mt-1 text-base font-medium text-text">
                {addr.companyName || 'ORGION'} — {addr.line1 || 'Nagercoil'},{' '}
                {addr.line2 || 'Tamil Nadu, India'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
