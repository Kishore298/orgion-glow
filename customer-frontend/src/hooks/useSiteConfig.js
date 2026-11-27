import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

const FALLBACK_CONFIG = {
  storeName: 'ORGION',
  tagline: 'Quiet Luxury Meets Nature',
  whatsappNumber: '919360910640',
  whatsappDefaultMessage:
    'Hello ORGION! I would love to know more about your herbal skincare and lip care.',
  supportEmail: 'orgion.we@gmail.com',
  supportPhone: '+91 93609 10640',
  businessAddress: {
    companyName: 'ORGION',
    line1: 'Nagercoil',
    line2: 'Tamil Nadu, India',
    country: 'India',
  },
  socialLinks: {
    instagram: 'https://www.instagram.com/orgion.we',
  },
  freeShippingThreshold: null,
  stCourierTrackingUrl: 'https://stcourier.com',
  heroImage: { url: '', alt: '' },
  announcements: [],
  shippingRules: {
    soapWeightG: 125,
    creamWeightG: 40,
    lipBalmWeightG: 40,
    outerPackagingG: 200,
    zone1RatePerKg: 50,
    zone2RatePerKg: 90,
    zone3RatePerKg: 120,
  },
};

export function useSiteConfig() {
  const query = useQuery({
    queryKey: ['site-config'],
    queryFn: async () => {
      const res = await api.get('/v1/site-config');
      return res.data?.data || FALLBACK_CONFIG;
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: FALLBACK_CONFIG,
  });

  return query.data || FALLBACK_CONFIG;
}
