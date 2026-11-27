import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { INDIAN_STATES, lookupIndianPincode } from '../../lib/pincode';

const addressFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile required'),
  line1: z.string().trim().min(3, 'House / Street address is required'),
  line2: z.string().trim().optional().default(''),
  landmark: z.string().trim().optional().default(''),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Valid 6-digit pincode required'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  type: z.enum(['Home', 'Work', 'Other']).default('Home'),
  isDefault: z.boolean().default(false),
});

export default function PincodeAddressForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save Address',
  showDefaultCheckbox = true,
  onPincodeCityStateChange,
  extraControls = null,
}) {
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [pinLookupFailed, setPinLookupFailed] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      fullName: initialValues?.fullName || '',
      mobile: initialValues?.mobile || '',
      line1: initialValues?.line1 || '',
      line2: initialValues?.line2 || '',
      landmark: initialValues?.landmark || '',
      pincode: initialValues?.pincode || '',
      city: initialValues?.city || '',
      state: initialValues?.state || '',
      type: initialValues?.type || 'Home',
      isDefault: initialValues?.isDefault || false,
    },
  });

  const pincode = watch('pincode');
  const state = watch('state');

  useEffect(() => {
    if (/^[1-9]\d{5}$/.test(pincode)) {
      let active = true;
      setLookingUpPin(true);
      setPinLookupFailed(false);
      lookupIndianPincode(pincode)
        .then((result) => {
          if (!active) return;
          if (result.ok) {
            if (result.city) setValue('city', result.city, { shouldValidate: true });
            if (result.state) setValue('state', result.state, { shouldValidate: true });
            if (onPincodeCityStateChange) {
              onPincodeCityStateChange({ pincode, state: result.state });
            }
          } else {
            setPinLookupFailed(true);
            if (onPincodeCityStateChange) {
              onPincodeCityStateChange({ pincode, state });
            }
          }
        })
        .finally(() => {
          if (active) setLookingUpPin(false);
        });
      return () => {
        active = false;
      };
    }
    setPinLookupFailed(false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  useEffect(() => {
    if (onPincodeCityStateChange && /^[1-9]\d{5}$/.test(pincode) && state) {
      onPincodeCityStateChange({ pincode, state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label-micro block mb-1.5">Full Name</label>
          <input {...register('fullName')} className="input-field" placeholder="Ananya Sharma" />
          {errors.fullName && (
            <p className="mt-1 text-xs text-status-danger">{errors.fullName.message}</p>
          )}
        </div>
        <div>
          <label className="label-micro block mb-1.5">Mobile Number</label>
          <input
            type="tel"
            maxLength={10}
            {...register('mobile')}
            className="input-field"
            placeholder="10-digit mobile number"
          />
          {errors.mobile && (
            <p className="mt-1 text-xs text-status-danger">{errors.mobile.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="label-micro block mb-1.5">Address Line 1</label>
        <input
          {...register('line1')}
          className="input-field"
          placeholder="Flat / House No., Building, Street"
        />
        {errors.line1 && <p className="mt-1 text-xs text-status-danger">{errors.line1.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label-micro block mb-1.5">Address Line 2 (Optional)</label>
          <input {...register('line2')} className="input-field" placeholder="Area / Colony" />
        </div>
        <div>
          <label className="label-micro block mb-1.5">Landmark (Optional)</label>
          <input {...register('landmark')} className="input-field" placeholder="Near Park" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label-micro block mb-1.5">
            Pincode {lookingUpPin && <span className="text-primary">(looking up...)</span>}
          </label>
          <input maxLength={6} {...register('pincode')} className="input-field" placeholder="629001" />
          {errors.pincode && (
            <p className="mt-1 text-xs text-status-danger">{errors.pincode.message}</p>
          )}
        </div>
        <div>
          <label className="label-micro block mb-1.5">City</label>
          <input {...register('city')} className="input-field" placeholder="Nagercoil" />
          {errors.city && <p className="mt-1 text-xs text-status-danger">{errors.city.message}</p>}
        </div>
        <div>
          <label className="label-micro block mb-1.5">State</label>
          <select {...register('state')} className="input-field">
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {pinLookupFailed && !state && (
            <p className="mt-1 text-[11px] text-text-muted">
              Pincode lookup slow — select your state manually.
            </p>
          )}
          {errors.state && <p className="mt-1 text-xs text-status-danger">{errors.state.message}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          {['Home', 'Work', 'Other'].map((t) => (
            <label key={t} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                value={t}
                {...register('type')}
                className="text-primary focus:ring-primary"
              />
              <span>{t}</span>
            </label>
          ))}
        </div>

        {showDefaultCheckbox && (
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              {...register('isDefault')}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Set as default address</span>
          </label>
        )}
      </div>

      {extraControls}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
