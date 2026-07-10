// Shared form-control class strings.
// Explicit text-gray-900 + bg-white prevents iOS Safari's washed-out defaults
// and OS dark-mode auto-inversion (the app has no dark theme).

const inputBase =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm ' +
  'text-gray-900 bg-white placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2'

/** Default: amber ring — used by piggyback, my-institution, admin/contracts, admin/institution-contracts */
export const inputCls       = `${inputBase} focus:ring-amber-400`
/** admin/entities */
export const inputClsBlue   = `${inputBase} focus:ring-blue-400`
/** admin/cooperatives */
export const inputClsPurple = `${inputBase} focus:ring-purple-400`
/** admin/vendors */
export const inputClsTeal   = `${inputBase} focus:ring-teal-400`
/** admin/memberships */
export const inputClsGreen  = `${inputBase} focus:ring-green-400`

export const labelCls =
  'text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1'
