import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, RotateCcw, Save, Truck, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { resolveImageUrl } from '../lib/format';
import { compressImageFile } from '../lib/imageCompression';

export default function StoreSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: async () => {
      const res = await api.get('/v1/admin/site-settings');
      return res.data?.data;
    },
  });

  const [heroUrl, setHeroUrl] = useState('');
  const [heroPublicId, setHeroPublicId] = useState('');
  const [heroAlt, setHeroAlt] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const [savingHero, setSavingHero] = useState(false);

  const [shippingForm, setShippingForm] = useState({
    soapWeightG: 125,
    creamWeightG: 40,
    lipBalmWeightG: 40,
    outerPackagingG: 200,
    zone1RatePerKg: 50,
    zone2RatePerKg: 90,
    zone3RatePerKg: 120,
  });
  const [savingShipping, setSavingShipping] = useState(false);

  useEffect(() => {
    if (data?.heroImage) {
      setHeroUrl(data.heroImage.url || '');
      setHeroPublicId(data.heroImage.publicId || '');
      setHeroAlt(data.heroImage.alt || '');
    }
    if (data?.shipping) {
      setShippingForm({
        soapWeightG: data.shipping.soapWeightG ?? 125,
        creamWeightG: data.shipping.creamWeightG ?? 40,
        lipBalmWeightG: data.shipping.lipBalmWeightG ?? 40,
        outerPackagingG: data.shipping.outerPackagingG ?? 200,
        zone1RatePerKg: data.shipping.zone1RatePerKg ?? 50,
        zone2RatePerKg: data.shipping.zone2RatePerKg ?? 90,
        zone3RatePerKg: data.shipping.zone3RatePerKg ?? 120,
      });
    }
  }, [data]);

  const handleHeroFileSelect = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploadingHero(true);
    try {
      const compressed = await compressImageFile(rawFile, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.84,
      });
      const fd = new FormData();
      fd.append('image', compressed);
      fd.append('folder', 'hero');
      const res = await api.post('/v1/admin/upload', fd);
      const uploaded = res.data?.data;
      setHeroUrl(uploaded.url || '');
      setHeroPublicId(uploaded.publicId || '');
      toast.success('Hero image compressed & uploaded. Click Save Hero Image to apply.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingHero(false);
    }
  };

  const handleSaveHero = async (e) => {
    e.preventDefault();
    setSavingHero(true);
    try {
      await api.put('/v1/admin/site-settings/hero', {
        url: heroUrl,
        publicId: heroPublicId,
        alt: heroAlt,
      });
      toast.success('Hero image settings saved');
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingHero(false);
    }
  };

  const handleResetHeroFallback = async () => {
    setSavingHero(true);
    try {
      await api.put('/v1/admin/site-settings/hero', { url: '', publicId: '', alt: heroAlt });
      setHeroUrl('');
      setHeroPublicId('');
      toast.success('Reverted to default storefront hero image');
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingHero(false);
    }
  };

  const handleSaveShipping = async (e) => {
    e.preventDefault();
    setSavingShipping(true);
    try {
      await api.put('/v1/admin/site-settings/shipping', {
        soapWeightG: Number(shippingForm.soapWeightG),
        creamWeightG: Number(shippingForm.creamWeightG),
        lipBalmWeightG: Number(shippingForm.lipBalmWeightG),
        outerPackagingG: Number(shippingForm.outerPackagingG),
        zone1RatePerKg: Number(shippingForm.zone1RatePerKg),
        zone2RatePerKg: Number(shippingForm.zone2RatePerKg),
        zone3RatePerKg: Number(shippingForm.zone3RatePerKg),
      });
      toast.success('Shipping rules saved');
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingShipping(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-text-muted">Loading settings...</div>;
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div>
        <span className="label-micro">Configuration</span>
        <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
          Store Settings
        </h1>
      </div>

      {/* Hero Image */}
      <form onSubmit={handleSaveHero} className="admin-card p-3.5 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={17} className="text-primary" />
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-text">Homepage Hero Image</h2>
        </div>
        <p className="text-xs text-text-muted">
          Upload a custom studio banner (automatically compressed for fast loading). If cleared or nothing is uploaded, the storefront displays the default product banner.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-5">
            <div className="aspect-[5/4] overflow-hidden rounded-2xl border border-border bg-surface-muted flex items-center justify-center">
              {heroUrl ? (
                <img
                  src={resolveImageUrl(heroUrl, 900)}
                  alt={heroAlt || 'Hero preview'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="p-4 text-center text-xs text-text-muted">
                  Using default storefront hero image
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-7 space-y-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="btn-ghost cursor-pointer text-xs">
                <Upload size={14} />
                {uploadingHero ? 'Compressing & uploading...' : 'Upload Hero Image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleHeroFileSelect}
                  className="hidden"
                />
              </label>
              {heroUrl && (
                <button
                  type="button"
                  disabled={savingHero}
                  onClick={handleResetHeroFallback}
                  className="btn-ghost text-xs text-text-muted"
                >
                  <RotateCcw size={13} /> Use Default Fallback
                </button>
              )}
            </div>

            <div>
              <label className="label-micro block mb-1.5">Image URL</label>
              <input
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                placeholder="Uploaded automatically or paste image URL..."
                className="input-field"
              />
            </div>

            <div>
              <label className="label-micro block mb-1.5">Alt Text (Optional)</label>
              <input
                value={heroAlt}
                onChange={(e) => setHeroAlt(e.target.value)}
                maxLength={200}
                placeholder="ORGION handcrafted skincare collection..."
                className="input-field"
              />
            </div>

            <button type="submit" disabled={savingHero || uploadingHero} className="btn-primary">
              <Save size={15} /> {savingHero ? 'Saving...' : 'Save Hero Image'}
            </button>
          </div>
        </div>
      </form>

      {/* Shipping Packed Weights & Zone Rates */}
      <form onSubmit={handleSaveShipping} className="admin-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-primary" />
          <h2 className="font-serif text-xl font-semibold text-text">
            Shipping Weights &amp; Zone Rates
          </h2>
        </div>
        <p className="text-xs text-text-muted">
          Total weight sums packed item weights plus outer packaging, rounded up to the next 1 kg slab.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label-micro block mb-1.5">Soap Weight (g)</label>
            <input
              type="number"
              min="0"
              value={shippingForm.soapWeightG}
              onChange={(e) => setShippingForm({ ...shippingForm, soapWeightG: e.target.value })}
              className="input-field font-sans tabular-nums"
            />
          </div>
          <div>
            <label className="label-micro block mb-1.5">Cream Weight (g)</label>
            <input
              type="number"
              min="0"
              value={shippingForm.creamWeightG}
              onChange={(e) => setShippingForm({ ...shippingForm, creamWeightG: e.target.value })}
              className="input-field font-sans tabular-nums"
            />
          </div>
          <div>
            <label className="label-micro block mb-1.5">Lip Balm Weight (g)</label>
            <input
              type="number"
              min="0"
              value={shippingForm.lipBalmWeightG}
              onChange={(e) =>
                setShippingForm({ ...shippingForm, lipBalmWeightG: e.target.value })
              }
              className="input-field font-sans tabular-nums"
            />
          </div>
          <div>
            <label className="label-micro block mb-1.5">Outer Packaging (g)</label>
            <input
              type="number"
              min="0"
              value={shippingForm.outerPackagingG}
              onChange={(e) =>
                setShippingForm({ ...shippingForm, outerPackagingG: e.target.value })
              }
              className="input-field font-sans tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="flex flex-col justify-between">
            <label className="label-micro block mb-1.5">Zone 1 — Tamil Nadu (₹/kg)</label>
            <input
              type="number"
              min="0"
              value={shippingForm.zone1RatePerKg}
              onChange={(e) =>
                setShippingForm({ ...shippingForm, zone1RatePerKg: e.target.value })
              }
              className="input-field font-sans tabular-nums"
            />
          </div>
          <div className="flex flex-col justify-between">
            <label className="label-micro block mb-1.5">
              Zone 2 — Karnataka, AP, Kerala, Puducherry, Telangana (₹/kg)
            </label>
            <input
              type="number"
              min="0"
              value={shippingForm.zone2RatePerKg}
              onChange={(e) =>
                setShippingForm({ ...shippingForm, zone2RatePerKg: e.target.value })
              }
              className="input-field font-sans tabular-nums"
            />
          </div>
          <div className="flex flex-col justify-between">
            <label className="label-micro block mb-1.5">
              Zone 3 — All Other States (₹/kg)
            </label>
            <input
              type="number"
              min="0"
              value={shippingForm.zone3RatePerKg}
              onChange={(e) =>
                setShippingForm({ ...shippingForm, zone3RatePerKg: e.target.value })
              }
              className="input-field font-sans tabular-nums"
            />
          </div>
        </div>

        <button type="submit" disabled={savingShipping} className="btn-primary">
          <Save size={15} /> {savingShipping ? 'Saving...' : 'Save Shipping Rules'}
        </button>
      </form>
    </div>
  );
}
